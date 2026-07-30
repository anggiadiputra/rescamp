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
        invoice_option: "KeepInvoice",
      });
      liquidOrderId = typeof liquidRes === "string" ? liquidRes : liquidRes?.order_id || liquidRes?.id || null;
      // Get the pending transaction ID from Resellercamp
      liquidTransactionId = liquidRes?.transaction_id || null;
      if (!liquidTransactionId) {
        // Fetch pending transactions to find the one we just created
        try {
          const txList = await liquid.listCustomerTransactions(targetLiquidCustomerId, true);
          const pendingList = Array.isArray(txList) ? txList : txList?.data || txList?.transactions || [];
          if (pendingList.length > 0) {
            // Get the most recent pending transaction
            liquidTransactionId = String(pendingList[pendingList.length - 1]?.transaction_id || pendingList[pendingList.length - 1]?.id || "");
          }
        } catch {}
      }
    } else if (payload.type === "transfer") {
      const liquidRes = await liquid.transferDomain({
        domain_name: fullDomain,
        auth_code: payload.authCode || "",
        customer_id: targetLiquidCustomerId,
        invoice_option: "KeepInvoice",
      });
      liquidOrderId = typeof liquidRes === "string" ? liquidRes : liquidRes?.order_id || liquidRes?.id || null;
      liquidTransactionId = liquidRes?.transaction_id || null;
      if (!liquidTransactionId) {
        try {
          const txList = await liquid.listCustomerTransactions(targetLiquidCustomerId, true);
          const pendingList = Array.isArray(txList) ? txList : txList?.data || txList?.transactions || [];
          if (pendingList.length > 0) {
            liquidTransactionId = String(pendingList[pendingList.length - 1]?.transaction_id || pendingList[pendingList.length - 1]?.id || "");
          }
        } catch {}
      }
    } else if (payload.type === "renew") {
      const domainId = payload.domainId;
      if (!domainId) throw new AppError("Missing domain ID for renewal", 400);
      const [targetDomain] = await db.select().from(domains).where(eq(domains.id, domainId));
      if (!targetDomain) throw new AppError(`Domain ID ${domainId} not found`, 404);

      const liquidRes = await liquid.renewDomain(
        String(targetDomain.liquidOrderId || targetDomain.domainName), years, "KeepInvoice"
      );
      liquidOrderId = typeof liquidRes === "string" ? liquidRes : liquidRes?.order_id || liquidRes?.id || null;
      liquidTransactionId = liquidRes?.transaction_id || null;
      if (!liquidTransactionId) {
        try {
          const txList = await liquid.listCustomerTransactions(targetLiquidCustomerId, true);
          const pendingList = Array.isArray(txList) ? txList : txList?.data || txList?.transactions || [];
          if (pendingList.length > 0) {
            liquidTransactionId = String(pendingList[pendingList.length - 1]?.transaction_id || pendingList[pendingList.length - 1]?.id || "");
          }
        } catch {}
      }
    }
  } catch (err: any) {
    console.error(`[order] Failed to create KeepInvoice on Resellercamp for ${fullDomain}:`, err?.message || err);
    throw new AppError(`Resellercamp order failed: ${err?.message || "Unknown error"}`, 502);
  }

  console.log(`[order] Resellercamp KeepInvoice created for ${fullDomain} | liquidTransactionId=${liquidTransactionId} | liquidOrderId=${liquidOrderId}`);

  // --- Step 3: Create local transaction record ---
  const validDomainId = (payload.domainId && Number(payload.domainId) > 0) ? Number(payload.domainId) : null;

  const metadataJson = JSON.stringify({
    orderId,
    type: payload.type,
    domainName: fullDomain,
    tld: payload.tld || fullDomain.split(".").slice(1).join("."),
    years,
    customerId: validCustomerId,
    nameservers: payload.nameservers || [],
    autoRenew: payload.autoRenew ? true : false,
    privacyProtection: payload.privacyProtection ? true : false,
    authCode: payload.authCode || null,
    domainId: payload.domainId || null,
    liquidTransactionId,
    liquidOrderId,
    liquidCustomerId: targetLiquidCustomerId,
  });

  const result: any = await db.insert(transactions).values({
    userId: payload.userId,
    customerId: validCustomerId,
    domainId: validDomainId,
    type: payload.type,
    amount: String(payload.amount),
    currency: "IDR",
    status: "pending_payment",
    paymentGateway: "sumopod",
    paymentStatus: "pending",
    metadata: metadataJson,
    description: `Order ${payload.type} domain: ${fullDomain} (${years} yr) - ${orderId}`,
  });

  const transactionId = Number(result[0]?.insertId || result.insertId);

  // --- Step 4: Create Sumopod payment link ---
  const sumopodRes = await sumopodClient.createPayment({
    orderId,
    amount: payload.amount,
    currency: "IDR",
    expiresInHours: 1,
  });

  const expiresAt = sumopodRes.expires_at || new Date(Date.now() + 60 * 60 * 1000).toISOString();

  // Update transaction record with payment ID & URL & enriched metadata
  let updatedMeta = metadataJson;
  try {
    const metaObj = JSON.parse(metadataJson);
    metaObj.fee = sumopodRes.fee || Math.round(payload.amount * 0.007 + 300);
    metaObj.paymentLinkUrl = sumopodRes.payment_link_url;
    metaObj.expiresAt = expiresAt;
    updatedMeta = JSON.stringify(metaObj);
  } catch (e) {}

  await db.update(transactions).set({
    paymentId: sumopodRes.payment_id,
    paymentLinkUrl: sumopodRes.payment_link_url,
    metadata: updatedMeta,
  }).where(eq(transactions.id, transactionId));

  return {
    transactionId,
    orderId,
    paymentId: sumopodRes.payment_id,
    paymentLinkUrl: sumopodRes.payment_link_url,
    amount: payload.amount,
    fee: sumopodRes.fee || 0,
    netAmount: sumopodRes.net_amount || payload.amount,
    currency: "IDR",
    status: "pending_payment",
    domain: fullDomain,
    expiresAt,
  };
}

export async function processWebhookPayload(event: any) {
  const eventType = event.event_type;
  const data = event.data;

  if (!data || !data.order_id) {
    console.warn("[sumopod webhook] Missing data or order_id in event:", eventType);
    return { status: "ignored" };
  }

  const orderId = data.order_id;
  console.log(`[sumopod webhook] Received event '${eventType}' for orderId '${orderId}'`);

  // Direct indexed SQL lookup instead of in-memory .find()
  const [tx] = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.paymentGateway, "sumopod"),
        like(transactions.description, `%${orderId}%`)
      )
    )
    .limit(1);

  if (!tx) {
    console.error(`[sumopod webhook] Transaction not found for orderId '${orderId}'`);
    return { status: "transaction_not_found" };
  }

  // Out-of-Order Webhook Guard: Don't overwrite if transaction is already completed or in-progress
  if (eventType === "payment.failed" || eventType === "payment.expired") {
    if (tx.paymentStatus === "completed" || tx.status === "completed" || tx.status === "processing_domain") {
      console.log(`[sumopod webhook] Ignoring '${eventType}' for orderId '${orderId}' because transaction is already completed/processing.`);
      return { status: "ignored_already_completed" };
    }
    await db.update(transactions).set({
      paymentStatus: eventType === "payment.failed" ? "failed" : "expired",
      status: eventType === "payment.failed" ? "failed" : "expired",
    }).where(eq(transactions.id, tx.id));
    return { status: "updated_failed" };
  }

  if (eventType !== "payment.completed") {
    return { status: "ignored_event_type" };
  }

  // Race Condition Fix #1: Atomic Conditional Update (Idempotency Guard)
  // Only update if status is still 'pending_payment' to prevent concurrent duplicate LIQUID API calls
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
  if (affectedRows === 0) {
    console.log(`[sumopod webhook] Transaction ID ${tx.id} is already being processed or completed. Skipping duplicate execution.`);
    return { status: "already_processing_or_completed" };
  }

  // Parse metadata to execute actual domain action on LIQUID API
  if (!tx.metadata) {
    console.error("[sumopod webhook] No metadata stored for transaction ID", tx.id);
    return { status: "missing_metadata" };
  }

  let meta: any;
  try {
    meta = JSON.parse(tx.metadata);
  } catch (e) {
    console.error("[sumopod webhook] Invalid JSON metadata for transaction ID", tx.id);
    return { status: "invalid_metadata" };
  }

  // Resolve reseller credentials for Liquid API
  const [user] = await db.select().from(users).where(eq(users.id, tx.userId));
  if (!user) {
    console.error("[sumopod webhook] User not found for transaction ID", tx.id);
    return { status: "user_not_found" };
  }

  let resellerId = user.resellerId || "";
  let apiKey = user.apiKey || "";

  if (user.role === "customer" && user.parentResellerId) {
    const [reseller] = await db.select().from(users).where(eq(users.id, user.parentResellerId));
    if (reseller) {
      resellerId = reseller.resellerId || "";
      apiKey = reseller.apiKey || "";
    }
  }

  if (!resellerId || !apiKey) {
    const [defaultReseller] = await db.select().from(users).where(eq(users.role, "reseller")).limit(1);
    if (defaultReseller) {
      resellerId = defaultReseller.resellerId || "";
      apiKey = defaultReseller.apiKey || "";
    }
  }

  const liquid = new LiquidClient(resellerId, apiKey);

  // Use stored liquidTransactionId & liquidCustomerId from order-time metadata
  const liquidTransactionId = meta.liquidTransactionId;
  const liquidCustomerId = meta.liquidCustomerId;
  const liquidOrderId = meta.liquidOrderId;
  const targetLocalCustomerId: number | null = meta.customerId || tx.customerId || null;

  try {
    if (liquidTransactionId && liquidCustomerId) {
      // --- NEW FLOW: Pay the existing KeepInvoice on Resellercamp ---
      console.log(`[sumopod webhook] Paying Resellercamp KeepInvoice | custId=${liquidCustomerId} txId=${liquidTransactionId} for ${meta.domainName}`);
      await liquid.payCustomerTransaction(liquidCustomerId, liquidTransactionId, false);
      console.log(`[sumopod webhook] Resellercamp invoice ${liquidTransactionId} PAID successfully → domain ${meta.domainName} is now active`);
    } else {
      console.warn(`[sumopod webhook] No liquidTransactionId found in metadata for ${meta.domainName}. This is a legacy order without KeepInvoice flow.`);
      // Legacy fallback: if no liquidTransactionId, skip Resellercamp pay (order was not created at order-time)
    }

    // Save domain to local DB if register or transfer
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
