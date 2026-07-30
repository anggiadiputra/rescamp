import { db } from "../../db";
import { transactions, domains, users, customers } from "../../db/schema";
import { eq, and, like, sql } from "drizzle-orm";
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
  const fullDomain = payload.domainName.includes(".") 
    ? payload.domainName 
    : `${payload.domainName}.${payload.tld || "com"}`;
  
  const orderId = `INV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

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

  // Resolve Liquid Customer ID
  let targetLiquidCustomerId: string | undefined = undefined;
  const validCustomerId = (payload.customerId && Number(payload.customerId) > 0) ? Number(payload.customerId) : null;
  if (validCustomerId) {
    const [custRecord] = await db.select().from(customers).where(eq(customers.id, validCustomerId));
    if (custRecord?.liquidCustomerId) {
      targetLiquidCustomerId = custRecord.liquidCustomerId;
    } else if (custRecord) {
      // Auto-create on Resellercamp
      try {
        const lcRes = await liquid.createCustomer({
          name: custRecord.name, email: custRecord.email, company: custRecord.company || "",
          address: custRecord.address || "", city: custRecord.city || "", state: custRecord.state || "",
          country: custRecord.country || "ID", zipcode: custRecord.zipcode || "", phone: custRecord.phone || "",
        });
        const newId = String(lcRes?.customer_id || lcRes?.id || "");
        if (newId) {
          targetLiquidCustomerId = newId;
          await db.update(customers).set({ liquidCustomerId: newId }).where(eq(customers.id, custRecord.id));
        }
      } catch (e: any) {
        // Try finding by email
        try {
          const listRes = await liquid.listCustomers();
          const list = Array.isArray(listRes) ? listRes : listRes?.data || listRes?.customers || [];
          const match = list.find((c: any) => (c.email || c.customer_email)?.toLowerCase() === custRecord.email.toLowerCase());
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

      const liquidRes = await liquid.renewDomain(
        String(targetDomain.liquidOrderId || targetDomain.domainName), years, "keep_invoice"
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
  }

  // --- Step 3: Create Payment Link on Sumopod Payment Gateway ---
  const orderId = `EXT-${payload.type.toUpperCase().slice(0, 3)}-${Date.now()}`;
  const sumopodRes = await sumopodClient.createPayment({
    orderId,
    amount: payload.amount,
    currency: "IDR",
    expiresInHours: 24,
  });

  // --- Step 4: Save Transaction to Local DB ---
  const [insertRes] = await db.insert(transactions).values({
    userId: payload.userId,
    customerId: targetLocalCustomerId,
    type: payload.type,
    amount: String(payload.amount),
    currency: "IDR",
    paymentGateway: "sumopod",
    paymentId: sumopodRes.payment_id,
    paymentLinkUrl: sumopodRes.payment_link_url,
    status: "pending_payment",
    paymentStatus: "pending",
    description: `Domain ${payload.type} - ${fullDomain} (${years} yr)`,
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
      customerId: targetLocalCustomerId,
      domainId: payload.domainId,
    }),
  });

  const txId = Number((insertRes as any).insertId);

  return {
    transaction_id: txId,
    order_id: orderId,
    payment_id: sumopodRes.payment_id,
    payment_link_url: sumopodRes.payment_link_url,
    amount: payload.amount,
    status: "pending_payment",
    expires_at: sumopodRes.expires_at,
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

  // Multi-strategy transaction lookup
  let tx: any = null;
  if (orderId) {
    const [byDesc] = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.paymentGateway, "sumopod"), like(transactions.description, `%${orderId}%`)))
      .limit(1);
    tx = byDesc || null;
  }

  if (!tx && paymentId) {
    const [byPayId] = await db.select().from(transactions).where(eq(transactions.paymentId, paymentId)).limit(1);
    tx = byPayId || null;
  }

  if (!tx) {
    const all = await db.select().from(transactions).where(eq(transactions.paymentGateway, "sumopod"));
    tx = all.find((t) => {
      if (t.paymentId && (t.paymentId === paymentId || t.paymentId === orderId)) return true;
      if (String(t.id) === String(orderId)) return true;
      if (t.description?.includes(orderId)) return true;
      if (t.metadata) {
        const str = typeof t.metadata === "string" ? t.metadata : JSON.stringify(t.metadata);
        if (str.includes(orderId)) return true;
      }
      return false;
    }) as any;
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
  if (affectedRows === 0 && tx.status === "completed") {
    return { status: "already_completed" };
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
  const liquidOrderId = meta.liquidOrderId;
  const targetLocalCustomerId: number | null = meta.customerId || tx.customerId || null;

  if (!liquidTransactionId && liquidCustomerId) {
    try {
      const txList = await liquid.listCustomerTransactions(liquidCustomerId, true);
      const pendingList = Array.isArray(txList) ? txList : txList?.data || txList?.transactions || [];
      if (pendingList.length > 0) {
        liquidTransactionId = String(pendingList[0]?.transaction_id || pendingList[0]?.invoice_id || pendingList[0]?.id || "");
      }
    } catch {}
  }

  try {
    if (liquidTransactionId && liquidCustomerId) {
      await liquid.payCustomerTransaction(liquidCustomerId, liquidTransactionId, true);
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
        });
      }
    } else if (meta.type === "renew") {
      const domainId = meta.domainId || tx.domainId;
      if (domainId) {
        const [targetDomain] = await db.select().from(domains).where(eq(domains.id, domainId));
        if (targetDomain) {
          await db.update(domains).set({
            years: sql`${domains.years} + ${meta.years || 1}`,
          }).where(eq(domains.id, domainId));
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
