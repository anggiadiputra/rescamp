import { db } from "../../db";
import { transactions, domains, users, customers } from "../../db/schema";
import { eq, and, sql, or } from "drizzle-orm";
import { sumopodClient } from "../../lib/sumopod";
import { LiquidClient } from "../../lib/liquid";
import { AppError } from "../../lib/error";

export interface CreateDomainOrderPayload {
  userId: number;
  type: "register" | "transfer" | "renew";
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
  const fullDomain = payload.domainName.includes(".") 
    ? payload.domainName 
    : `${payload.domainName}.${tld}`;

  // --- Step 1: Resolve Liquid credentials & customer ---
  const [user] = await db.select().from(users).where(eq(users.id, payload.userId));
  if (!user) throw new AppError("User not found", 404);

  let resellerId = user.resellerId || "";
  let apiKey = user.apiKey || "";
  if (user.role === "customer" && user.parentResellerId) {
    const [reseller] = await db.select().from(users).where(eq(users.id, user.parentResellerId));
    if (reseller) { resellerId = reseller.resellerId || ""; apiKey = reseller.apiKey || ""; }
  }
  if (!resellerId || !apiKey) {
    const [defaultReseller] = await db.select().from(users).where(eq(users.role, "reseller")).limit(1);
    if (defaultReseller) { resellerId = defaultReseller.resellerId || ""; apiKey = defaultReseller.apiKey || ""; }
  }

  const liquid = new LiquidClient(resellerId, apiKey);

  // Resolve Liquid Customer ID (auto-lookup & auto-create if missing for user)
  let targetLiquidCustomerId: string | undefined = undefined;
  let validCustomerId = (payload.customerId && Number(payload.customerId) > 0) ? Number(payload.customerId) : null;
  let custRecord: any = null;

  if (validCustomerId) {
    [custRecord] = await db.select().from(customers).where(eq(customers.id, validCustomerId));
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
    throw new AppError("Resellercamp Customer ID could not be resolved. Please set up customer first.", 400);
  }

  // --- Step 2: Send order to Resellercamp with KeepInvoice (creates pending invoice) ---
  let liquidTransactionId: string | null = null;
  let liquidOrderId: string | null = null;

  try {
    if (payload.type === "register") {
      const liquidRes = await liquid.registerDomain({
        domain_name: fullDomain,
        years,
        ns: payload.nameservers?.join(",") || "",
        customer_id: targetLiquidCustomerId,
        privacy_protection: payload.privacyProtection,
        invoice_option: "keep_invoice",
      });
      liquidOrderId = typeof liquidRes === "string" ? liquidRes : liquidRes?.order_id || liquidRes?.id || null;
      liquidTransactionId = String(
        liquidRes?.transaction_id ||
        liquidRes?.invoice_id ||
        liquidRes?.entity_id ||
        liquidRes?.id ||
        liquidRes?.data?.transaction_id ||
        liquidRes?.data?.invoice_id ||
        ""
      ) || null;

      if (!liquidTransactionId) {
        try {
          const txList = await liquid.listCustomerTransactions(targetLiquidCustomerId, true);
          const pendingList = Array.isArray(txList) ? txList : txList?.data || txList?.transactions || [];
          if (pendingList.length > 0) {
            liquidTransactionId = String(pendingList[0]?.transaction_id || pendingList[0]?.invoice_id || pendingList[0]?.id || "");
          }
        } catch {}
      }
    } else if (payload.type === "transfer") {
      const liquidRes = await liquid.transferDomain({
        domain_name: fullDomain,
        auth_code: payload.authCode || "",
        customer_id: targetLiquidCustomerId,
        invoice_option: "keep_invoice",
      });
      liquidOrderId = typeof liquidRes === "string" ? liquidRes : liquidRes?.order_id || liquidRes?.id || null;
      liquidTransactionId = String(
        liquidRes?.transaction_id ||
        liquidRes?.invoice_id ||
        liquidRes?.entity_id ||
        liquidRes?.id ||
        ""
      ) || null;

      if (!liquidTransactionId) {
        try {
          const txList = await liquid.listCustomerTransactions(targetLiquidCustomerId, true);
          const pendingList = Array.isArray(txList) ? txList : txList?.data || txList?.transactions || [];
          if (pendingList.length > 0) {
            liquidTransactionId = String(pendingList[0]?.transaction_id || pendingList[0]?.invoice_id || pendingList[0]?.id || "");
          }
        } catch {}
      }
    } else if (payload.type === "renew") {
      const domainId = payload.domainId;
      if (!domainId) throw new AppError("Missing domain ID for renewal", 400);
      const [targetDomain] = await db.select().from(domains).where(eq(domains.id, domainId));
      if (!targetDomain) throw new AppError(`Domain ID ${domainId} not found`, 404);

      console.log(`[renew] domain=${targetDomain.domainName} liquidOrderId=${targetDomain.liquidOrderId} expiryDate=${targetDomain.expiryDate}`);
      const liquidRes = await liquid.renewDomain(
        String(targetDomain.liquidOrderId || targetDomain.domainName), years, "keep_invoice", targetDomain.expiryDate
      );
      liquidOrderId = typeof liquidRes === "string" ? liquidRes : liquidRes?.order_id || liquidRes?.id || null;
      liquidTransactionId = String(
        liquidRes?.transaction_id ||
        liquidRes?.invoice_id ||
        liquidRes?.entity_id ||
        liquidRes?.id ||
        ""
      ) || null;

      if (!liquidTransactionId) {
        try {
          const txList = await liquid.listCustomerTransactions(targetLiquidCustomerId, true);
          const pendingList = Array.isArray(txList) ? txList : txList?.data || txList?.transactions || [];
          if (pendingList.length > 0) {
            liquidTransactionId = String(pendingList[0]?.transaction_id || pendingList[0]?.invoice_id || pendingList[0]?.id || "");
          }
        } catch {}
      }
    }
  } catch (err: any) {
    console.error("[payments] Resellercamp initial invoice creation error:", err);
    let rawMsg = String(err?.message || err || "");
    let userMsg = rawMsg;
    if (rawMsg.toLowerCase().includes("balance") || rawMsg.toLowerCase().includes("insufficient")) {
      userMsg = "Saldo reseller di Resellercamp tidak mencukupi untuk memproses order ini. Silakan top up saldo reseller Anda terlebih dahulu.";
    }
    throw new AppError(`Gagal membuat order domain di Resellercamp: ${userMsg}`, 502);
  }

  // Guard: never let customer pay if Resellercamp invoice was not created
  if (!liquidTransactionId) {
    throw new AppError("Order domain berhasil dibuat tapi tidak mendapat ID invoice dari Resellercamp. Silakan coba lagi atau hubungi admin.", 502);
  }

  // --- Step 3: Create Payment Link on Sumopod Payment Gateway ---
  // N21: append UUID entropy so concurrent same-ms submits never collide
  const orderId = `EXT-${payload.type.toUpperCase().slice(0, 3)}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
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

  // --- Step 4: Save Transaction to Local DB ---
  // Use customer's userId (not reseller) so customer sees invoice in their billing
  let transactionUserId = payload.userId;
  if (validCustomerId) {
    const [cust] = await db.select({ userId: customers.userId }).from(customers).where(eq(customers.id, validCustomerId));
    if (cust?.userId) transactionUserId = cust.userId;
  }
  let txId: number;
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
    }),
  };

  const [existingTx] = liquidTransactionId
    ? await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.liquidTransactionId, String(liquidTransactionId))).limit(1)
    : [null];

  if (existingTx) {
    await db.update(transactions).set(transactionData).where(eq(transactions.id, existingTx.id));
    txId = existingTx.id;
  } else {
    try {
      const [insertRes] = await db.insert(transactions).values(transactionData);
      txId = Number((insertRes as any).insertId);
    } catch (err: any) {
      const isDup = err?.errno === 1062 || String(err?.code || "").includes("ER_DUP_ENTRY") || String(err?.message || "").includes("Duplicate entry");
      if (isDup && liquidTransactionId) {
        const [dupTx] = await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.liquidTransactionId, String(liquidTransactionId))).limit(1);
        if (dupTx) {
          await db.update(transactions).set(transactionData).where(eq(transactions.id, dupTx.id));
          txId = dupTx.id;
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }
  }

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
  if (eventType === "payment.failed" || eventType === "payment.expired") {
    if (tx.paymentStatus === "completed" || tx.status === "completed" || tx.status === "processing_domain") {
      return { status: "ignored_already_completed" };
    }
    await db.update(transactions).set({
      paymentStatus: eventType === "payment.failed" ? "failed" : "expired",
      status: eventType === "payment.failed" ? "failed" : "expired",
    }).where(eq(transactions.id, tx.id));
    return { status: "updated_failed" };
  }

  if (eventType !== "payment.completed" && eventType !== "payment.success" && eventType !== "payment_completed") {
    return { status: "ignored_event_type" };
  }

  // Race Condition Fix: Idempotency Guard
  const updateResult: any = await db
    .update(transactions)
    .set({
      paymentStatus: "completed",
      status: "processing_domain",
    })
    .where(
      and(
        eq(transactions.id, tx.id),
        eq(transactions.status, "pending_payment")
      )
    );

  const affectedRows = updateResult[0]?.affectedRows ?? updateResult?.affectedRows ?? 0;
  // Whoever wins the CAS (pending_payment -> processing_domain) processes the payment;
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

  let resellerId = user.resellerId || "";
  let apiKey = user.apiKey || "";
  if (user.role === "customer" && user.parentResellerId) {
    const [reseller] = await db.select().from(users).where(eq(users.id, user.parentResellerId));
    if (reseller) { resellerId = reseller.resellerId || ""; apiKey = reseller.apiKey || ""; }
  }
  if (!resellerId || !apiKey) {
    const [defaultReseller] = await db.select().from(users).where(eq(users.role, "reseller")).limit(1);
    if (defaultReseller) { resellerId = defaultReseller.resellerId || ""; apiKey = defaultReseller.apiKey || ""; }
  }

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

  // Fallback 2: Re-create the order on Resellercamp if it was never created (Step 2 failed originally)
  if (!liquidTransactionId && liquidCustomerId && meta.domainName) {
    console.log(`[sumopod webhook] liquidTransactionId missing for tx ${tx.id} — attempting to re-create order on Resellercamp...`);
    try {
      if (meta.type === "register") {
        const liquidRes = await liquid.registerDomain({
          domain_name: meta.domainName,
          years: meta.years || 1,
          ns: (meta.nameservers || []).join(","),
          customer_id: liquidCustomerId,
          privacy_protection: meta.privacyProtection || false,
          invoice_option: "keep_invoice",
        });
        liquidOrderId = typeof liquidRes === "string" ? liquidRes : liquidRes?.order_id || liquidRes?.id || null;
        liquidTransactionId = String(
          liquidRes?.transaction_id || liquidRes?.invoice_id || liquidRes?.entity_id || liquidRes?.id || liquidRes?.data?.transaction_id || liquidRes?.data?.invoice_id || ""
        ) || null;
      } else if (meta.type === "transfer") {
        const liquidRes = await liquid.transferDomain({
          domain_name: meta.domainName,
          auth_code: meta.authCode || "",
          customer_id: liquidCustomerId,
          invoice_option: "keep_invoice",
        });
        liquidOrderId = typeof liquidRes === "string" ? liquidRes : liquidRes?.order_id || liquidRes?.id || null;
        liquidTransactionId = String(
          liquidRes?.transaction_id || liquidRes?.invoice_id || liquidRes?.entity_id || liquidRes?.id || ""
        ) || null;
      } else if (meta.type === "renew" && (meta.domainId || tx.domainId)) {
        const domainId = meta.domainId || tx.domainId;
        const [targetDomain] = await db.select().from(domains).where(eq(domains.id, domainId));
        if (targetDomain) {
          const liquidRes = await liquid.renewDomain(
            String(targetDomain.liquidOrderId || targetDomain.domainName), meta.years || 1, "keep_invoice"
          );
          liquidOrderId = typeof liquidRes === "string" ? liquidRes : liquidRes?.order_id || liquidRes?.id || null;
          liquidTransactionId = String(
            liquidRes?.transaction_id || liquidRes?.invoice_id || liquidRes?.entity_id || liquidRes?.id || ""
          ) || null;
        }
      }

      // Fallback search if still no transaction ID after re-creation
      if (!liquidTransactionId && liquidCustomerId) {
        const txList = await liquid.listCustomerTransactions(liquidCustomerId, true);
        const pendingList = Array.isArray(txList) ? txList : txList?.data || txList?.transactions || [];
        if (pendingList.length > 0) {
          liquidTransactionId = String(pendingList[0]?.transaction_id || pendingList[0]?.invoice_id || pendingList[0]?.id || "");
        }
      }

      // Update metadata with newly obtained IDs
      if (liquidTransactionId || liquidOrderId) {
        const updatedMeta = { ...meta, liquidTransactionId, liquidOrderId };
        await db.update(transactions)
          .set({ metadata: JSON.stringify(updatedMeta), liquidTransactionId: liquidTransactionId ? String(liquidTransactionId) : null })
          .where(eq(transactions.id, tx.id));
        console.log(`[sumopod webhook] Re-created order for tx ${tx.id}: liquidTxnId=${liquidTransactionId}, liquidOrderId=${liquidOrderId}`);
      }
    } catch (reCreateErr: any) {
      console.error(`[sumopod webhook] Failed to re-create order for tx ${tx.id}:`, reCreateErr?.message || reCreateErr);
    }
  }

  try {
    if (liquidTransactionId && liquidCustomerId) {
      await liquid.payCustomerTransaction(liquidCustomerId, liquidTransactionId, true);
    } else {
      throw new Error(`Cannot pay Resellercamp invoice: liquidTransactionId=${liquidTransactionId}, liquidCustomerId=${liquidCustomerId}`);
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
            await db.update(domains)
              .set({ years: sql`${domains.years} + ${yearsToAdd}` })
              .where(eq(domains.id, domainId));
          }
        }
      }
    }

    await db.update(transactions).set({ status: "completed" }).where(eq(transactions.id, tx.id));
    console.log(`[sumopod webhook] Transaction ${tx.id} completed for ${meta.domainName}`);

    return { status: "processed_successfully" };
  } catch (err: any) {
    console.error(`[sumopod webhook] Error paying Resellercamp invoice for ${meta.domainName}:`, err?.message || err);
    // Enrich metadata with exact liquid error for admin review
    let updatedMetaStr = tx.metadata;
    try {
      const metaObj = JSON.parse(tx.metadata);
      metaObj.lastError = err?.message || String(err);
      updatedMetaStr = JSON.stringify(metaObj);
    } catch {}

    await db.update(transactions).set({ status: "action_required", metadata: updatedMetaStr }).where(eq(transactions.id, tx.id));
    return { status: "action_failed", error: err?.message || String(err) };
  }
}
