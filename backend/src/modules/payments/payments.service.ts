import { db, withMutexLock } from "../../db";
import { transactions, domains, users, customers } from "../../db/schema";
import { eq, and, sql, or, inArray, ne } from "drizzle-orm";
import { createHash } from "node:crypto";
import { sumopodClient } from "../../lib/sumopod";
import { LiquidClient } from "../../lib/liquid";
import { AppError } from "../../lib/error";
import { resolveResellerCreds } from "../../lib/reseller-creds";
import { canAccessTenantResource, loadTenantScope } from "../../lib/tenant-access";

export interface CreateDomainOrderPayload {
  userId: number;
  type: "register" | "transfer" | "renew" | "privacy";
  domainName: string;
  tld?: string;
  years?: number;
  customerId?: number;
  nameservers?: string[];
  autoRenew?: boolean;
  privacyProtection?: boolean;
  authCode?: string;
  domainId?: number;
  amount: number;
}

export async function createDomainOrderPayment(payload: CreateDomainOrderPayload) {
  const years = payload.years || 1;
  const tld = payload.tld || payload.domainName.split(".").slice(1).join(".") || "com";
  const fullDomain = (payload.domainName.includes(".")
    ? payload.domainName
    : `${payload.domainName}.${tld}`).toLowerCase().trim();

  // R1: The cross-user protection below is entirely SELECT-then-INSERT with no
  // atomicity — two different users can both pass the "is this domain already
  // being ordered?" pre-check before either inserts a claim row, and because
  // orderId is derived from intent that includes userId, the order_id UNIQUE
  // gate only collapses duplicate submissions from the SAME user. Wrap the
  // pre-check + claim INSERT in a per-domain MySQL advisory lock (works across
  // processes/instances) so the second concurrent user sees the first one's
  // fresh claim row and gets a 409 instead of a second payment link.
  return withMutexLock(`lock:order:${fullDomain}`, async () => {
    // Check if there's already an active transaction for this domain and order type
    const allowedTypes: ("register" | "renew" | "transfer" | "restore" | "privacy" | "fund" | "debit")[] =
    (payload.type === "register" || payload.type === "transfer")
      ? ["register", "transfer"]
      : [payload.type];

  const [existingActiveTx] = await db.select().from(transactions).where(
    and(
      inArray(transactions.type, allowedTypes),
      sql`JSON_UNQUOTE(JSON_EXTRACT(${transactions.metadata}, '$.domainName')) = ${fullDomain}`,
      or(
        eq(transactions.status, "pending_payment"),
        eq(transactions.status, "processing_domain")
      ),
      sql`(${transactions.expiresAt} IS NULL OR ${transactions.expiresAt} > NOW())`,
      sql`${transactions.createdAt} >= ${new Date(Date.now() - 60 * 60 * 1000)}`
    )
  ).limit(1);

  if (existingActiveTx) {
    if (existingActiveTx.userId === payload.userId && existingActiveTx.paymentLinkUrl) {
      // Same user, return existing payment link (idempotency)
      return {
        transaction_id: existingActiveTx.id,
        transactionId: existingActiveTx.id,
        order_id: existingActiveTx.orderId || "",
        orderId: existingActiveTx.orderId || "",
        payment_id: existingActiveTx.paymentId || "",
        paymentId: existingActiveTx.paymentId || "",
        payment_link_url: existingActiveTx.paymentLinkUrl,
        paymentLinkUrl: existingActiveTx.paymentLinkUrl,
        amount: Number(existingActiveTx.amount),
        status: existingActiveTx.status,
        expires_at: existingActiveTx.expiresAt ? new Date(existingActiveTx.expiresAt).toISOString() : "",
        expiresAt: existingActiveTx.expiresAt ? new Date(existingActiveTx.expiresAt).toISOString() : "",
      };
    } else if (existingActiveTx.userId === payload.userId) {
      // Same user, mid-flight without paymentLinkUrl yet — wait briefly
      for (let attempt = 0; attempt < 10; attempt++) {
        const [refreshed] = await db.select().from(transactions).where(eq(transactions.id, existingActiveTx.id)).limit(1);
        if (refreshed?.paymentLinkUrl) {
          return {
            transaction_id: refreshed.id,
            transactionId: refreshed.id,
            order_id: refreshed.orderId || "",
            orderId: refreshed.orderId || "",
            payment_id: refreshed.paymentId || "",
            paymentId: refreshed.paymentId || "",
            payment_link_url: refreshed.paymentLinkUrl,
            paymentLinkUrl: refreshed.paymentLinkUrl,
            amount: Number(refreshed.amount),
            status: refreshed.status,
            expires_at: refreshed.expiresAt ? new Date(refreshed.expiresAt).toISOString() : "",
            expiresAt: refreshed.expiresAt ? new Date(refreshed.expiresAt).toISOString() : "",
          };
        }
        await new Promise((r) => setTimeout(r, 200));
      }
    } else {
      // Different user owns the active transaction, reject to prevent double charging
      throw new AppError(`Domain ${fullDomain} sedang dalam proses pemesanan oleh pengguna lain. Silakan coba beberapa saat lagi.`, 409);
    }
  }

  // A-4 (race condition fix): the idempotency key is derived from the ORDER
  // INTENT (user + type + domain + years + customer), NOT from this attempt.
  // Concurrent identical submissions therefore compute the SAME orderId, and
  // the UNIQUE index on order_id turns the INSERT into the atomic gate.
  // The loser of the race gets ER_DUP_ENTRY and returns the winner's payment
  // link instead of creating a second Sumopod payment + transaction.
  const intentKey = `${payload.userId}:${payload.type}:${fullDomain}:${years}:${payload.customerId ?? 0}:${payload.domainId ?? 0}`;
  const intentHash = createHash("sha256").update(intentKey).digest("hex").slice(0, 24);
  const orderId = `INV-${payload.type.toUpperCase().slice(0, 3)}-${intentHash}`;

  // Claim gate: try to insert a placeholder transaction row FIRST (before any
  // external API call). Only the winner proceeds to create the payment link.
  let txId: number;
  let winnerRow: typeof transactions.$inferSelect | null = null;
  try {
    const [claim] = await db.insert(transactions).values({
      userId: payload.userId,
      customerId: payload.customerId ?? null,
      type: payload.type,
      amount: String(payload.amount),
      currency: "IDR",
      paymentGateway: "sumopod",
      orderId,
      status: "pending_payment" as const,
      paymentStatus: "pending" as const,
      description: `Domain ${payload.type} - ${fullDomain} (${years} yr) - ${orderId}`,
      metadata: JSON.stringify({ orderId, domainName: fullDomain, tld, years, type: payload.type }),
    });
    txId = Number((claim as any).insertId);
  } catch (err: any) {
    const isDup = err?.errno === 1062 || String(err?.code || "").includes("ER_DUP_ENTRY") || String(err?.message || "").includes("Duplicate entry");
    if (!isDup) throw err;
    // Lost the race: fetch the winner's transaction. If it already has a
    // payment link, return it directly. If the winner is still mid-flight
    // (no link yet), wait briefly and re-read before falling back.
    for (let attempt = 0; attempt < 10; attempt++) {
      const [existing] = await db.select().from(transactions).where(eq(transactions.orderId, orderId)).limit(1);
      if (existing?.paymentLinkUrl) {
        return {
          transaction_id: existing.id,
          transactionId: existing.id,
          order_id: existing.orderId || "",
          orderId: existing.orderId || "",
          payment_id: existing.paymentId || "",
          paymentId: existing.paymentId || "",
          payment_link_url: existing.paymentLinkUrl,
          paymentLinkUrl: existing.paymentLinkUrl,
          amount: Number(existing.amount),
          status: existing.status,
          expires_at: existing.expiresAt ? new Date(existing.expiresAt).toISOString() : "",
          expiresAt: existing.expiresAt ? new Date(existing.expiresAt).toISOString() : "",
        };
      }
      if (existing && existing.status !== "pending_payment") {
        // winner finished with a terminal state — return it as-is
        winnerRow = existing;
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    const [finalRow] = winnerRow
      ? [winnerRow]
      : await db.select().from(transactions).where(eq(transactions.orderId, orderId)).limit(1);
    if (!finalRow) throw err;
    return {
      transaction_id: finalRow.id,
      transactionId: finalRow.id,
      order_id: finalRow.orderId || "",
      orderId: finalRow.orderId || "",
      payment_id: finalRow.paymentId || "",
      paymentId: finalRow.paymentId || "",
      payment_link_url: finalRow.paymentLinkUrl || "",
      paymentLinkUrl: finalRow.paymentLinkUrl || "",
      amount: Number(finalRow.amount),
      status: finalRow.status,
      expires_at: finalRow.expiresAt ? new Date(finalRow.expiresAt).toISOString() : "",
      expiresAt: finalRow.expiresAt ? new Date(finalRow.expiresAt).toISOString() : "",
    };
  }

  // Deduplication & Concurrent Double-Submit Lock:
  // If user submits exact same domain order within 10s and has active pending_payment transaction, return existing payment link.
  const tenSecondsAgo = new Date(Date.now() - 10 * 1000);
  const [recentPendingTx] = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, payload.userId),
        eq(transactions.type, payload.type),
        eq(transactions.status, "pending_payment"),
        sql`JSON_UNQUOTE(JSON_EXTRACT(${transactions.metadata}, '$.domainName')) = ${fullDomain}`,
        sql`${transactions.createdAt} >= ${tenSecondsAgo}`,
        // A-4: the claim row we just inserted must not match itself
        sql`${transactions.id} <> ${txId}`
      )
    )
    .limit(1);

  if (recentPendingTx && recentPendingTx.paymentLinkUrl) {
    return {
      transaction_id: recentPendingTx.id,
      transactionId: recentPendingTx.id,
      order_id: recentPendingTx.orderId || "",
      orderId: recentPendingTx.orderId || "",
      payment_id: recentPendingTx.paymentId || "",
      paymentId: recentPendingTx.paymentId || "",
      payment_link_url: recentPendingTx.paymentLinkUrl,
      paymentLinkUrl: recentPendingTx.paymentLinkUrl,
      amount: Number(recentPendingTx.amount),
      status: recentPendingTx.status,
      expires_at: recentPendingTx.expiresAt ? new Date(recentPendingTx.expiresAt).toISOString() : "",
      expiresAt: recentPendingTx.expiresAt ? new Date(recentPendingTx.expiresAt).toISOString() : "",
    };
  }

  // --- Step 1: Resolve Liquid credentials & customer ---
  const [user] = await db.select().from(users).where(eq(users.id, payload.userId));
  if (!user) throw new AppError("User not found", 404);

  let resellerId = "";
  let apiKey = "";
  const paymentCreds = await resolveResellerCreds(payload.userId);
  resellerId = paymentCreds.resellerId;
  apiKey = paymentCreds.apiKey;

  const liquid = new LiquidClient(resellerId, apiKey);

  // Resolve Liquid Customer ID (auto-lookup & auto-create if missing for user)
  let targetLiquidCustomerId: string | undefined = undefined;
  let validCustomerId = (payload.customerId && Number(payload.customerId) > 0) ? Number(payload.customerId) : null;
  let custRecord: any = null;

  if (validCustomerId) {
    [custRecord] = await db.select().from(customers).where(eq(customers.id, validCustomerId));
    const scope = await loadTenantScope(user);
    if (!custRecord || !canAccessTenantResource(scope, { userId: custRecord.userId, customerId: custRecord.id })) {
      throw new AppError("Customer not found", 404);
    }
  }

  if (!custRecord && payload.userId) {
    [custRecord] = await db.select().from(customers).where(or(eq(customers.userId, payload.userId), eq(customers.email, user.email)));
  }

  // Auto-create local customer record if missing for this user
  if (!custRecord) {
    try {
      const [insertedCust] = await db.insert(customers).values({
        userId: user.id,
        name: user.name || user.email.split("@")[0] || "Customer",
        email: user.email,
        company: "Personal",
        address: "Indonesia",
        city: "Jakarta",
        state: "DKI Jakarta",
        country: "ID",
        zipcode: "10110",
        phone: "8123456789",
      } as any);
      const newCustId = Number((insertedCust as any).insertId);
      [custRecord] = await db.select().from(customers).where(eq(customers.id, newCustId));
    } catch (e: any) {
      console.warn("[payments] Local customer auto-creation warning:", e?.message);
    }
  }

  if (custRecord) {
    validCustomerId = custRecord.id;
    if (custRecord.liquidCustomerId) {
      targetLiquidCustomerId = custRecord.liquidCustomerId;
    } else {
      // Auto-create customer profile on Resellercamp
      try {
        const lcRes = await liquid.createCustomer({
          name: custRecord.name || user.name || user.email.split("@")[0],
          email: custRecord.email || user.email,
          company: custRecord.company || "Personal",
          address: custRecord.address || "Indonesia",
          city: custRecord.city || "Jakarta",
          state: custRecord.state || "DKI Jakarta",
          country: custRecord.country || "ID",
          zipcode: custRecord.zipcode || "10110",
          phone: custRecord.phone || "8123456789",
        });
        const newId = String(lcRes?.customer_id || lcRes?.id || "");
        if (newId) {
          targetLiquidCustomerId = newId;
          await db.update(customers).set({ liquidCustomerId: newId }).where(eq(customers.id, custRecord.id));
        }
      } catch (e: any) {
        // Try finding existing customer by email on Resellercamp
        try {
          const listRes = await liquid.listCustomers();
          const list = Array.isArray(listRes) ? listRes : listRes?.data || listRes?.customers || [];
          const match = list.find((c: any) => (c.email || c.customer_email)?.toLowerCase() === (custRecord.email || user.email).toLowerCase());
          if (match) {
            targetLiquidCustomerId = String(match.customer_id || match.id || "");
            await db.update(customers).set({ liquidCustomerId: targetLiquidCustomerId }).where(eq(customers.id, custRecord.id));
          }
        } catch {}
      }
    }
  }

  if (!targetLiquidCustomerId) {
    if (payload.type === "renew") {
      // Last-resort for renew: the Resellercamp renewDomain(domainId, ...) call itself
      // does not require customer_id, so we try one more email-match against the
      // reseller's full customer list (which scopes across the whole reseller account,
      // unlike the per-customer lookup above) and self-heal the local row.
      try {
        const listRes = await liquid.listCustomers();
        const list = Array.isArray(listRes) ? listRes : listRes?.data || listRes?.customers || [];
        const ownerEmail = (custRecord?.email || user.email || "").toLowerCase();
        const match = list.find((c: any) =>
          String(c.email || c.customer_email || "").toLowerCase() === ownerEmail
        );
        if (match) {
          targetLiquidCustomerId = String(match.customer_id || match.id || "");
          if (custRecord && targetLiquidCustomerId) {
            await db.update(customers)
              .set({ liquidCustomerId: targetLiquidCustomerId })
              .where(eq(customers.id, custRecord.id));
            console.log(`[payments] renew: self-healed liquidCustomerId=${targetLiquidCustomerId} for customer=${custRecord.id}`);
          }
        }
      } catch (e: any) {
        console.warn("[payments] renew: listCustomers fallback failed:", e?.message);
      }
      if (!targetLiquidCustomerId) {
        // renewDomain doesn't require customer_id; downstream listCustomerTransactions
        // fallback is already wrapped in try/catch, so proceeding is safe.
        console.warn(`[payments] renew: no Resellercamp customer resolved for user=${user.id} domain=${fullDomain}; proceeding anyway`);
      }
    } else {
      throw new AppError("Resellercamp Customer ID could not be resolved. Please set up customer first.", 400);
    }
  }

  // --- Step 2: Skip premature Resellercamp API call ---
  // Domain creation/transfer/renewal on Resellercamp is executed post-payment in the Sumopod webhook
  // using invoice_option: "no_invoice" (deducting wholesale cost from reseller balance).
  let liquidTransactionId: string | null = null;
  let liquidOrderId: string | null = null;

  if (payload.type === "privacy" || payload.type === "renew") {
    if (!payload.domainId) throw new AppError(`Missing domain ID for ${payload.type}`, 400);
    const [targetDomain] = await db.select().from(domains).where(eq(domains.id, payload.domainId));
    if (!targetDomain) throw new AppError(`Domain ID ${payload.domainId} not found`, 404);
    liquidOrderId = targetDomain.liquidOrderId ? String(targetDomain.liquidOrderId) : null;
  }

  // --- Step 3: Create Payment Link on Sumopod Payment Gateway ---
  // A-4: orderId was already derived from the order INTENT at the top of this
  // function (deterministic hash), so a concurrent duplicate submission can
  // never create a second payment link for the same intent.
  const sumopodRes = await sumopodClient.createPayment({
    orderId,
    amount: payload.amount,
    currency: "IDR",
    expiresInHours: 1,
  });

  const formattedExpiresAt = sumopodRes.expires_at
    ? (sumopodRes.expires_at.includes("Z") || /[+-]\d{2}:\d{2}$/.test(sumopodRes.expires_at)
        ? sumopodRes.expires_at
        : `${sumopodRes.expires_at.replace(" ", "T")}Z`)
    : new Date(Date.now() + 60 * 60 * 1000).toISOString();

  // --- Step 4: Update the claimed transaction row with payment details ---
  // Use customer's userId (not reseller) so customer sees invoice in their billing
  let transactionUserId = payload.userId;
  if (validCustomerId) {
    const [cust] = await db.select({ userId: customers.userId }).from(customers).where(eq(customers.id, validCustomerId));
    if (cust?.userId) transactionUserId = cust.userId;
  }
  const transactionData = {
    userId: transactionUserId,
    customerId: validCustomerId,
    type: payload.type,
    amount: String(payload.amount),
    currency: "IDR",
    paymentGateway: "sumopod",
    paymentId: sumopodRes.payment_id,
    orderId,
    paymentLinkUrl: sumopodRes.payment_link_url,
    expiresAt: new Date(formattedExpiresAt),
    liquidTransactionId: liquidTransactionId ? String(liquidTransactionId) : null,
    status: "pending_payment" as const,
    paymentStatus: "pending" as const,
    description: `Domain ${payload.type} - ${fullDomain} (${years} yr) - ${orderId}`,
    metadata: JSON.stringify({
      orderId,
      domainName: fullDomain,
      tld,
      years,
      type: payload.type,
      nameservers: payload.nameservers || [],
      autoRenew: payload.autoRenew || false,
      privacyProtection: payload.privacyProtection || false,
      liquidOrderId,
      liquidTransactionId,
      liquidCustomerId: targetLiquidCustomerId,
      customerId: validCustomerId,
      domainId: payload.domainId,
      expiresAt: formattedExpiresAt,
      fee: sumopodRes.fee || 0,
      netAmount: sumopodRes.net_amount || 0,
    }),
  };

  // A-4: we own the claim row (txId) — UPDATE it instead of inserting a new one.
  await db.update(transactions).set(transactionData).where(eq(transactions.id, txId));

  return {
    transaction_id: txId,
    transactionId: txId,
    order_id: orderId,
    orderId: orderId,
    payment_id: sumopodRes.payment_id,
    paymentId: sumopodRes.payment_id,
    payment_link_url: sumopodRes.payment_link_url,
    paymentLinkUrl: sumopodRes.payment_link_url,
    amount: payload.amount,
    status: "pending_payment",
    expires_at: formattedExpiresAt,
    expiresAt: formattedExpiresAt,
  };
  }); // end withMutexLock (R1)
}

/**
 * Handle incoming webhook payload from Sumopod Payment Gateway
 */
export async function processWebhookPayload(payload: any) {
  const eventType = payload.event_type || payload.type || payload.event;
  const data = payload.data || payload;
  const orderId = data.order_id || data.orderId || data.reference_id;
  const paymentId = data.payment_id || data.paymentId;

  if (!orderId && !paymentId) {
    console.error("[sumopod webhook] Missing orderId/paymentId in payload", payload);
    return { status: "missing_order_id" };
  }

  // N16: exact-match lookup — orderId/paymentId match against dedicated columns only.
// LIKE on description was matching substring collisions across transactions.
  let tx: any = null;
  if (paymentId) {
    const [byPayId] = await db.select().from(transactions).where(eq(transactions.paymentId, paymentId)).limit(1);
    tx = byPayId || null;
  }

  if (!tx && orderId) {
    // Try the indexed orderId column (preferred)
    const [byOrderId] = await db.select().from(transactions)
      .where(and(eq(transactions.paymentGateway, "sumopod"), eq(transactions.orderId, orderId)))
      .limit(1);
    tx = byOrderId || null;
  }

  if (!tx && orderId) {
    // Fallback: exact match on metadata.orderId (for rows inserted before the column existed)
    const [byMeta] = await db.select().from(transactions)
      .where(and(
        eq(transactions.paymentGateway, "sumopod"),
        sql`JSON_UNQUOTE(JSON_EXTRACT(${transactions.metadata}, '$.orderId')) = ${orderId}`,
      ))
      .limit(1);
    tx = byMeta || null;
  }

  if (!tx && orderId) {
    const [byTxId] = await db.select().from(transactions)
      .where(and(eq(transactions.paymentGateway, "sumopod"), eq(transactions.id, parseInt(String(orderId), 10) || -1)))
      .limit(1);
    tx = byTxId || null;
  }

  if (!tx) {
    console.error(`[sumopod webhook] Transaction not found for orderId '${orderId}' paymentId '${paymentId}'`);
    return { status: "transaction_not_found" };
  }

  // Out-of-Order Webhook Guard
  if (eventType === "payment.failed" || eventType === "payment.expired" || eventType === "payment.cancelled" || eventType === "payment.canceled") {
    if (tx.paymentStatus === "completed" || tx.status === "completed" || tx.status === "processing_domain") {
      return { status: "ignored_already_completed" };
    }
    const finalStatus = eventType.includes("cancel") ? "cancelled" : eventType === "payment.failed" ? "failed" : "expired";
    const updateRes: any = await db.update(transactions).set({
      paymentStatus: finalStatus as any,
      status: finalStatus as any,
    }).where(
      and(
        eq(transactions.id, tx.id),
        ne(transactions.status, "completed"),
        ne(transactions.status, "processing_domain")
      )
    );

    if ((updateRes[0]?.affectedRows ?? 0) === 0) {
      return { status: "ignored_already_completed" };
    }

    // Only cancel domain record if this was a new registration order and the domain is still pending.
    // For renewal ("renew") or privacy ("privacy"), tx.domainId points to an already active domain
    // which must NEVER be cancelled due to an unpaid renewal/privacy invoice.
    if (tx.domainId && tx.type === "register") {
      await db.update(domains)
        .set({ status: finalStatus as any })
        .where(and(eq(domains.id, tx.domainId), eq(domains.status, "pending")));
    }
    return { status: `updated_${finalStatus}` };
  }

  if (eventType !== "payment.completed" && eventType !== "payment.success" && eventType !== "payment_completed") {
    return { status: "ignored_event_type" };
  }

  // Race Condition Fix: Idempotency Guard
  // Allow reclaim from pending_payment OR expired/failed (e.g. auto-expire fired before Sumopod webhook arrived).
  // Ignore only if already in a terminal/locked state (completed/processing_domain).
  const reclaimResult: any = await db
    .update(transactions)
    .set({
      paymentStatus: "completed",
      status: "processing_domain",
    })
    .where(
      and(
        eq(transactions.id, tx.id),
        or(
          eq(transactions.status, "pending_payment"),
          eq(transactions.status, "expired"),
          eq(transactions.status, "failed"),
        ) as any
      )
    );

  const affectedRows = reclaimResult[0]?.affectedRows ?? reclaimResult?.affectedRows ?? 0;
  // Whoever wins the CAS (→ processing_domain) processes the payment;
  // a concurrent duplicate webhook/poll that loses must bail regardless of its stale read.
  if (affectedRows === 0) {
    return { status: "already_processing" };
  }

  if (!tx.metadata) {
    return { status: "missing_metadata" };
  }

  let meta: any;
  try {
    meta = typeof tx.metadata === "string" ? JSON.parse(tx.metadata) : tx.metadata;
  } catch (e) {
    return { status: "invalid_metadata" };
  }

  // Resolve reseller credentials
  const [user] = await db.select().from(users).where(eq(users.id, tx.userId));
  if (!user) return { status: "user_not_found" };

  const webhookCreds = await resolveResellerCreds(tx.userId);
  const resellerId = webhookCreds.resellerId;
  const apiKey = webhookCreds.apiKey;

  const liquid = new LiquidClient(resellerId, apiKey);

  let liquidTransactionId = meta.liquidTransactionId;
  const liquidCustomerId = meta.liquidCustomerId;
  let liquidOrderId = meta.liquidOrderId;
  const targetLocalCustomerId: number | null = meta.customerId || tx.customerId || null;

  // Fallback 1: search for pending transactions if we don't have a transaction ID
  if (!liquidTransactionId && liquidCustomerId) {
    try {
      const txList = await liquid.listCustomerTransactions(liquidCustomerId, true);
      const pendingList = Array.isArray(txList) ? txList : txList?.data || txList?.transactions || [];
      if (pendingList.length > 0) {
        liquidTransactionId = String(pendingList[0]?.transaction_id || pendingList[0]?.invoice_id || pendingList[0]?.id || "");
      }
    } catch {}
  }

  // Execute domain action on Resellercamp using invoice_option: "no_invoice"
  // This deducts wholesale cost from reseller balance while customer paid retail price via Sumopod.
  try {
    if (meta.type === "register") {
      const liquidRes = await liquid.registerDomain({
        domain_name: meta.domainName,
        years: meta.years || 1,
        ns: (meta.nameservers || []).join(","),
        customer_id: liquidCustomerId,
        privacy_protection: meta.privacyProtection || false,
        invoice_option: "no_invoice",
      });
      liquidOrderId = typeof liquidRes === "string" ? liquidRes : liquidRes?.order_id || liquidRes?.id || null;
      liquidTransactionId = String(
        liquidRes?.transaction_id || liquidRes?.invoice_id || liquidRes?.entity_id || liquidRes?.id || liquidRes?.data?.transaction_id || liquidRes?.data?.invoice_id || ""
      ) || null;

      const [existingDomain] = await db.select().from(domains).where(eq(domains.domainName, meta.domainName));
      if (existingDomain) {
        await db.update(domains).set({
          userId: tx.userId,
          customerId: targetLocalCustomerId || existingDomain.customerId,
          status: "active",
          liquidOrderId: liquidOrderId ? String(liquidOrderId) : existingDomain.liquidOrderId,
          autoRenew: meta.autoRenew ? 1 : existingDomain.autoRenew,
          privacyProtection: meta.privacyProtection ? 1 : existingDomain.privacyProtection,
          nameservers: meta.nameservers || existingDomain.nameservers,
        }).where(eq(domains.id, existingDomain.id));
      } else {
        await db.insert(domains).values({
          userId: tx.userId,
          customerId: targetLocalCustomerId,
          domainName: meta.domainName,
          tld: meta.tld || meta.domainName.split(".").slice(1).join("."),
          years: meta.years || 1,
          status: "active",
          autoRenew: meta.autoRenew ? 1 : 0,
          privacyProtection: meta.privacyProtection ? 1 : 0,
          liquidOrderId: liquidOrderId ? String(liquidOrderId) : null,
          nameservers: meta.nameservers || [],
        }).onDuplicateKeyUpdate({
          set: {
            userId: tx.userId,
            customerId: targetLocalCustomerId || sql`${domains.customerId}`,
            status: "active",
            liquidOrderId: liquidOrderId ? String(liquidOrderId) : sql`${domains.liquidOrderId}`,
            autoRenew: meta.autoRenew ? 1 : sql`${domains.autoRenew}`,
            privacyProtection: meta.privacyProtection ? 1 : sql`${domains.privacyProtection}`,
          }
        });
      }
    } else if (meta.type === "transfer") {
      const liquidRes = await liquid.transferDomain({
        domain_name: meta.domainName,
        auth_code: meta.authCode || "",
        customer_id: liquidCustomerId,
        invoice_option: "no_invoice",
      });
      liquidOrderId = typeof liquidRes === "string" ? liquidRes : liquidRes?.order_id || liquidRes?.id || null;
      liquidTransactionId = String(
        liquidRes?.transaction_id || liquidRes?.invoice_id || liquidRes?.entity_id || liquidRes?.id || ""
      ) || null;

      const [existingDomain] = await db.select().from(domains).where(eq(domains.domainName, meta.domainName));
      if (existingDomain) {
        await db.update(domains).set({
          userId: tx.userId,
          customerId: targetLocalCustomerId || existingDomain.customerId,
          status: "pending",
          liquidOrderId: liquidOrderId ? String(liquidOrderId) : existingDomain.liquidOrderId,
          autoRenew: meta.autoRenew ? 1 : existingDomain.autoRenew,
          privacyProtection: meta.privacyProtection ? 1 : existingDomain.privacyProtection,
          nameservers: meta.nameservers || existingDomain.nameservers,
        }).where(eq(domains.id, existingDomain.id));
      } else {
        await db.insert(domains).values({
          userId: tx.userId,
          customerId: targetLocalCustomerId,
          domainName: meta.domainName,
          tld: meta.tld || meta.domainName.split(".").slice(1).join("."),
          years: meta.years || 1,
          status: "pending",
          autoRenew: meta.autoRenew ? 1 : 0,
          privacyProtection: meta.privacyProtection ? 1 : 0,
          liquidOrderId: liquidOrderId ? String(liquidOrderId) : null,
          nameservers: meta.nameservers || [],
        }).onDuplicateKeyUpdate({
          set: {
            userId: tx.userId,
            customerId: targetLocalCustomerId || sql`${domains.customerId}`,
            status: "pending",
            liquidOrderId: liquidOrderId ? String(liquidOrderId) : sql`${domains.liquidOrderId}`,
            autoRenew: meta.autoRenew ? 1 : sql`${domains.autoRenew}`,
            privacyProtection: meta.privacyProtection ? 1 : sql`${domains.privacyProtection}`,
          }
        });
      }
    } else if (meta.type === "renew") {
      const domainId = meta.domainId || tx.domainId;
      if (domainId) {
        const [targetDomain] = await db.select().from(domains).where(eq(domains.id, domainId));
        if (targetDomain) {
          const liquidRes = await liquid.renewDomain(
            String(targetDomain.liquidOrderId || targetDomain.domainName),
            meta.years || 1,
            "no_invoice",
            targetDomain.expiryDate,
            Boolean(meta.privacyProtection)
          );
          liquidOrderId = typeof liquidRes === "string" ? liquidRes : liquidRes?.order_id || liquidRes?.id || null;

          const yearsToAdd = meta.years || 1;
          if (meta.yearsRenewed !== yearsToAdd) {
            meta.yearsRenewed = yearsToAdd;
            await db.update(transactions)
              .set({ metadata: JSON.stringify(meta) })
              .where(and(eq(transactions.id, tx.id), sql`JSON_EXTRACT(${transactions.metadata}, '$.yearsRenewed') IS NULL`));

            const domainUpdate: Record<string, any> = {
              years: sql`${domains.years} + ${yearsToAdd}`,
              status: "active",
            };
            if (meta.privacyProtection) {
              domainUpdate.privacyProtection = 1;
            }

            try {
              const updatedInfo: any = await liquid.getDomain(targetDomain.liquidOrderId || targetDomain.domainName);
              if (updatedInfo?.expiry_date) {
                domainUpdate.expiryDate = String(updatedInfo.expiry_date).split(" ")[0];
              }
            } catch {}

            await db.update(domains)
              .set(domainUpdate)
              .where(eq(domains.id, domainId));
          }
        }
      }
    }

    if (meta.type === "register" || meta.type === "transfer") {
      const [existingDomain] = await db.select().from(domains).where(eq(domains.domainName, meta.domainName));
      if (!existingDomain) {
        await db.insert(domains).values({
          userId: tx.userId,
          customerId: targetLocalCustomerId,
          domainName: meta.domainName,
          tld: meta.tld || meta.domainName.split(".").slice(1).join("."),
          years: meta.years || 1,
          status: "active",
          autoRenew: meta.autoRenew ? 1 : 0,
          privacyProtection: meta.privacyProtection ? 1 : 0,
          liquidOrderId: liquidOrderId ? String(liquidOrderId) : null,
          nameservers: meta.nameservers || [],
        }).onDuplicateKeyUpdate({ set: { domainName: sql`${domains.domainName}` } });
      }
    } else if (meta.type === "privacy") {
      // Privacy purchases skip Resellercamp order creation — call buyPrivacyProtection now
      const domainId = meta.domainId || tx.domainId;
      if (domainId) {
        const [targetDomain] = await db.select().from(domains).where(eq(domains.id, domainId));
        if (targetDomain) {
          let domainRef = String(targetDomain.liquidOrderId || "").trim();
          if (!domainRef || !/^\d+$/.test(domainRef)) {
            if (targetDomain.domainName) {
              try {
                const item: any = await liquid.getDomain(targetDomain.domainName);
                const orderId = String(item?.domain_id || item?.order_id || item?.id || "");
                if (orderId) {
                  domainRef = orderId;
                  await db.update(domains).set({ liquidOrderId: orderId }).where(eq(domains.id, targetDomain.id));
                }
              } catch {}
            }
          }
          if (!domainRef) domainRef = String(targetDomain.domainName || domainId);

          await liquid.buyPrivacyProtection(domainRef, "no_invoice");
          try {
            await liquid.enablePrivacyProtection(domainRef);
          } catch (e) {
            console.warn(`[payments.service] Auto-enable privacy protection after purchase warning:`, e);
          }
          await db.update(domains).set({ privacyProtection: 1 }).where(eq(domains.id, domainId));
        }
      }
    } else if (meta.type === "renew") {
      const domainId = meta.domainId || tx.domainId;
      if (domainId) {
        const [targetDomain] = await db.select().from(domains).where(eq(domains.id, domainId));
        if (targetDomain) {
          // N6: idempotency — only bump years if not already processed for this transaction
          // (prevents double-bump if a second webhook replay for the same tx arrives,
          // or if the same tx.id was processed by a concurrent webhook/poll path).
          const yearsToAdd = meta.years || 1;
          if (meta.yearsRenewed !== yearsToAdd) {
            meta.yearsRenewed = yearsToAdd;
            await db.update(transactions)
              .set({ metadata: JSON.stringify(meta) })
              .where(and(eq(transactions.id, tx.id), sql`JSON_EXTRACT(${transactions.metadata}, '$.yearsRenewed') IS NULL`));

            const domainUpdate: Record<string, any> = {
              years: sql`${domains.years} + ${yearsToAdd}`,
              status: "active",
            };
            if (meta.privacyProtection) {
              domainUpdate.privacyProtection = 1;
            }

            await db.update(domains)
              .set(domainUpdate)
              .where(eq(domains.id, domainId));
          }
        }
      }
    }

    await db.update(transactions).set({ status: "completed" }).where(eq(transactions.id, tx.id));
    console.log(`[sumopod webhook] Transaction ${tx.id} completed for ${meta.domainName}`);

    // Invalidate domain availability search cache
    try {
      const { invalidateDomainSearchCache } = await import("../domains/domains.service");
      invalidateDomainSearchCache(meta.domainName);
    } catch {}

    return { status: "processed_successfully" };
  } catch (err: any) {
    console.error(`[sumopod webhook] Error paying Resellercamp invoice for ${meta.domainName}:`, err?.message || err);

    // Enrich metadata with lastError for audit trail
    let metaObj: any = {};
    try { metaObj = typeof tx.metadata === "string" ? JSON.parse(tx.metadata) : tx.metadata || {}; } catch {}
    metaObj.lastError = err?.message || String(err);

    // Fallback: probe Resellercamp to see what the actual wholesale transaction status is.
    // The Resellercamp invoice may have already been paid, cancelled, refunded, or expired — in which case
    // our local row shouldn't sit at "action_required" forever. Map Resellercamp status → internal status
    // and reconcile. Only fall back to "action_required" if the Resellercamp invoice is still pending
    // (i.e. Sumopod paid but Resellercamp has not actually settled).
    const liquidStatusMap: Record<string, { status: string; paymentStatus: string }> = {
      paid: { status: "completed", paymentStatus: "completed" },
      completed: { status: "completed", paymentStatus: "completed" },
      success: { status: "completed", paymentStatus: "completed" },
      done: { status: "completed", paymentStatus: "completed" },
      approved: { status: "completed", paymentStatus: "completed" },
      cancelled: { status: "cancelled", paymentStatus: "cancelled" },
      canceled: { status: "cancelled", paymentStatus: "cancelled" },
      refund: { status: "cancelled", paymentStatus: "cancelled" },
      refunded: { status: "cancelled", paymentStatus: "cancelled" },
      expired: { status: "expired", paymentStatus: "expired" },
      timeout: { status: "expired", paymentStatus: "expired" },
      failed: { status: "failed", paymentStatus: "failed" },
      rejected: { status: "failed", paymentStatus: "failed" },
      pending: { status: "action_required", paymentStatus: "pending" },
      unpaid: { status: "action_required", paymentStatus: "pending" },
      processing: { status: "action_required", paymentStatus: "pending" },
    };

    let resolvedStatus = "action_required";
    let resolvedPaymentStatus = "pending";
    let probed = false;

    if (liquidTransactionId) {
      try {
        const probedTxn = await liquid.getTransaction(liquidTransactionId);
        const rawStatus = String(probedTxn?.status || "").toLowerCase();
        const mapped = liquidStatusMap[rawStatus];
        if (mapped) {
          resolvedStatus = mapped.status;
          resolvedPaymentStatus = mapped.paymentStatus;
          probed = true;
          metaObj.reconciledFromLiquidStatus = rawStatus;
          console.log(`[sumopod webhook] Reconciled tx ${tx.id} status → ${resolvedStatus} (Resellercamp reported '${rawStatus}')`);
        }
      } catch (probeErr: any) {
        console.warn(`[sumopod webhook] Liquid status probe failed for tx ${tx.id}:`, probeErr?.message || probeErr);
      }
    }

    metaObj.statusProbeAt = new Date().toISOString();
    metaObj.statusProbed = probed;
    const updatedMetaStr = JSON.stringify(metaObj);

    await db.update(transactions).set({
      status: resolvedStatus as any,
      paymentStatus: resolvedPaymentStatus as any,
      metadata: updatedMetaStr,
    }).where(eq(transactions.id, tx.id));

    // Mirror resolved status to the linked domain (if any) so the domain record stays consistent.
    // For refunds/cancellations, the domain might not exist yet (Sumopod paid but Resellercamp never created it).
    // We only update to 'active' when completed; otherwise mirror to a non-active state.
    if (tx.domainId) {
      const domainStatus = resolvedStatus === "completed" ? "active" : resolvedStatus;
      await db.update(domains).set({ status: domainStatus as any }).where(eq(domains.id, tx.domainId));
    }

    return { status: resolvedStatus === "action_required" ? "action_failed" : `reconciled_${resolvedStatus}`, error: err?.message || String(err) };
  }
}
