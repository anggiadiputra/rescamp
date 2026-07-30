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

  const metadataJson = JSON.stringify({
    orderId,
    type: payload.type,
    domainName: fullDomain,
    tld: payload.tld || fullDomain.split(".").slice(1).join("."),
    years,
    customerId: payload.customerId || null,
    nameservers: payload.nameservers || [],
    autoRenew: payload.autoRenew ? true : false,
    privacyProtection: payload.privacyProtection ? true : false,
    authCode: payload.authCode || null,
    domainId: payload.domainId || null,
  });

  // Insert local transaction record
  const validCustomerId = (payload.customerId && Number(payload.customerId) > 0) ? Number(payload.customerId) : null;
  const validDomainId = (payload.domainId && Number(payload.domainId) > 0) ? Number(payload.domainId) : null;

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

  // Call Sumopod API to generate payment link with 1 hour expiration
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

  // Resolve Liquid Customer ID string for Liquid API (convert local integer ID to Resellercamp string ID)
  let targetLiquidCustomerId: string | undefined = undefined;
  let targetLocalCustomerId: number | null = meta.customerId || tx.customerId || null;

  let custRecord: any = null;
  if (targetLocalCustomerId) {
    const [c] = await db.select().from(customers).where(eq(customers.id, targetLocalCustomerId));
    custRecord = c || null;
  }
  if (!custRecord && tx.userId) {
    const [c] = await db.select().from(customers).where(eq(customers.userId, tx.userId));
    custRecord = c || null;
    if (custRecord) targetLocalCustomerId = custRecord.id;
  }

  if (custRecord) {
    if (custRecord.liquidCustomerId) {
      targetLiquidCustomerId = custRecord.liquidCustomerId;
    } else {
      // Auto-create or find existing customer on Resellercamp Liquid API
      try {
        const liquidRes = await liquid.createCustomer({
          name: custRecord.name,
          email: custRecord.email,
          company: custRecord.company || undefined,
          address: custRecord.address || undefined,
          city: custRecord.city || undefined,
          state: custRecord.state || undefined,
          country: custRecord.country || "ID",
          zipcode: custRecord.zipcode || undefined,
          phone: custRecord.phone || undefined,
        });
        const newId = String(liquidRes?.customer_id || liquidRes?.id || "");
        if (newId) {
          targetLiquidCustomerId = newId;
          await db.update(customers).set({ liquidCustomerId: newId }).where(eq(customers.id, custRecord.id));
        }
      } catch (e: any) {
        console.warn("[sumopod webhook] Liquid create customer failed, searching by email:", e);
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

  if (!targetLiquidCustomerId && tx.userId) {
    const [userObj] = await db.select().from(users).where(eq(users.id, tx.userId));
    if (userObj) {
      try {
        const liquidRes = await liquid.createCustomer({
          name: userObj.name || userObj.email.split("@")[0],
          email: userObj.email,
          country: "ID",
        });
        targetLiquidCustomerId = String(liquidRes?.customer_id || liquidRes?.id || "");
      } catch (e) {
        console.warn("[sumopod webhook] Fallback create customer in Liquid failed:", e);
        try {
          const listRes = await liquid.listCustomers();
          const list = Array.isArray(listRes) ? listRes : listRes?.data || listRes?.customers || [];
          const match = list.find((c: any) => (c.email || c.customer_email)?.toLowerCase() === userObj.email.toLowerCase());
          if (match) {
            targetLiquidCustomerId = String(match.customer_id || match.id || "");
          }
        } catch {}
      }
    }
  }

  try {
    if (meta.type === "register") {
      console.log(`[sumopod webhook] Executing LIQUID domain registration for ${meta.domainName} with reseller ${resellerId} & liquidCustId ${targetLiquidCustomerId}`);
      if (!targetLiquidCustomerId) {
        throw new Error("Resellercamp Customer ID could not be created/resolved. Please check Reseller API Credentials.");
      }

      const liquidRes = await liquid.registerDomain({
        domain_name: meta.domainName,
        years: meta.years || 1,
        ns: meta.nameservers?.join(",") || "",
        customer_id: targetLiquidCustomerId,
        privacy_protection: meta.privacyProtection,
      });

      const liquidOrderId = typeof liquidRes === "string" ? liquidRes : liquidRes?.order_id || liquidRes?.id;

      // Save domain to local DB (check if already registered locally)
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

      await db.update(transactions).set({ status: "completed" }).where(eq(transactions.id, tx.id));
      console.log(`[sumopod webhook] Domain ${meta.domainName} registered successfully on Resellercamp`);

    } else if (meta.type === "transfer") {
      console.log(`[sumopod webhook] Executing LIQUID domain transfer for ${meta.domainName}`);
      if (!targetLiquidCustomerId) {
        throw new Error("Resellercamp Customer ID could not be created/resolved. Please check Reseller API Credentials.");
      }

      const liquidRes = await liquid.transferDomain({
        domain_name: meta.domainName,
        auth_code: meta.authCode || "",
        customer_id: targetLiquidCustomerId,
        ns: meta.nameservers?.join(",") || "",
      });

      const liquidOrderId = typeof liquidRes === "string" ? liquidRes : liquidRes?.order_id || liquidRes?.id;

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
          privacyProtection: 0,
          liquidOrderId: liquidOrderId ? String(liquidOrderId) : null,
          nameservers: meta.nameservers || [],
        });
      }

      await db.update(transactions).set({ status: "completed" }).where(eq(transactions.id, tx.id));
      console.log(`[sumopod webhook] Domain transfer for ${meta.domainName} initialized successfully on Resellercamp`);

    } else if (meta.type === "renew") {
      console.log(`[sumopod webhook] Executing LIQUID domain renewal for ${meta.domainName}`);
      const domainId = meta.domainId || tx.domainId;
      if (!domainId) throw new Error("Missing domain ID for renewal");

      const [targetDomain] = await db.select().from(domains).where(eq(domains.id, domainId));
      if (!targetDomain) throw new Error(`Domain ID ${domainId} not found`);

      const liquidRes = await liquid.renewDomain(String(targetDomain.liquidOrderId || targetDomain.domainName), meta.years || 1);

      // Atomic SQL Increment
      await db.update(domains).set({
        years: sql`${domains.years} + ${meta.years || 1}`,
        expiryDate: liquidRes?.expiry_date || targetDomain.expiryDate,
      }).where(eq(domains.id, domainId));

      await db.update(transactions).set({ status: "completed" }).where(eq(transactions.id, tx.id));
      console.log(`[sumopod webhook] Domain renewal for ${meta.domainName} completed successfully`);
    }

    return { status: "processed_successfully" };
  } catch (err: any) {
    console.error(`[sumopod webhook] Error executing LIQUID action for ${meta.domainName}:`, err?.message || err);
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
