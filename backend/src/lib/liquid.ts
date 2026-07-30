import { AppError } from "./error";
import { env } from "../config/env";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export class LiquidClient {
  private baseURL: string;
  private authHeader: string;

  constructor(resellerId: string, apiKey: string, baseURL?: string) {
    const rawUrl = baseURL || env.LIQUID_BASE_URL || "https://api.domainsas.com/v1";
    this.baseURL = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
    this.authHeader = "Basic " + btoa(`${resellerId}:${apiKey}`);
  }

  private async request<T>(method: HttpMethod, path: string, body?: Record<string, any>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000); // 30s timeout
    try {
      const res = await fetch(`${this.baseURL}${path}`, {
        method,
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body ? new URLSearchParams(body as Record<string, string>).toString() : undefined,
        signal: controller.signal,
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { message: text }; }
      if (!res.ok) {
        const status = res.status === 401 || res.status === 403 ? 502 : res.status;
        throw new AppError(data.message || "LIQUID API error", status);
      }
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  // --- Domain ---
  checkAvailability(domain: string) {
    return this.request<any>("GET", `/domains/availability?domain=${domain}`);
  }

  async resolveContactIdForDomain(customerId: string, domainName: string): Promise<string> {
    const isIdTld = domainName.toLowerCase().endsWith(".id");
    let custInfo: any = null;

    const hasIdEligibility = (c: any) => {
      if (!c || !c.eligibility_criteria) return false;
      if (Array.isArray(c.eligibility_criteria)) {
        return c.eligibility_criteria.some((e: any) => {
          const s = String(e).toLowerCase();
          return s === "co" || s === "id" || s === "mn" || s === "name" || s === "biz";
        });
      }
      const str = String(c.eligibility_criteria).toLowerCase();
      return str.includes("co") || str.includes("id") || str.includes("biz");
    };

    try {
      const list = await this.request<any>("GET", `/customers/${customerId}/contacts`);
      const arr = Array.isArray(list) ? list : list?.data || list?.contacts || [];
      if (arr.length > 0) {
        if (isIdTld) {
          const idContact = arr.find((c: any) => hasIdEligibility(c));
          if (idContact) {
            const resolvedId = String(idContact.contact_id || idContact.id || "");
            console.log(`[resolveContactIdForDomain] Found existing .id contact ${resolvedId} for customer ${customerId}`);
            return resolvedId;
          }
        } else {
          const activeContact = arr.find((c: any) => c.status === "Active" || !c.status);
          if (activeContact) return String(activeContact.contact_id || activeContact.id);
          return String(arr[0].contact_id || arr[0].id);
        }
      }
    } catch (e: any) {
      console.warn("[resolveContactIdForDomain] Failed to list customer contacts:", e?.message || e);
    }

    // If domain is .id TLD and no valid .id contact found, force auto-create one
    if (isIdTld) {
      try {
        console.log(`[resolveContactIdForDomain] Auto-creating new .id compatible contact (co eligibility) for customer ${customerId}...`);
        custInfo = await this.getCustomer(customerId).catch(() => null);
        const newContact = await this.createCustomerContact(customerId, {
          name: custInfo?.name || "Registrant",
          email: custInfo?.email || "registrant@ekstensi.id",
          company: custInfo?.company || "Personal",
          address: custInfo?.address_line_1 || "Indonesia",
          city: custInfo?.city || "Jakarta",
          state: custInfo?.state || "DKI Jakarta",
          zipcode: custInfo?.zipcode || "10110",
          phone: custInfo?.tel_no || "8123456789",
          domain_name: domainName,
          eligibility_criteria: "co",
        });
        const newContactId = String(newContact?.contact_id || newContact?.id || "");
        if (newContactId) {
          console.log(`[resolveContactIdForDomain] Successfully created .id contact ${newContactId}`);
          return newContactId;
        }
      } catch (e: any) {
        console.warn("[resolveContactIdForDomain] Auto-create .id contact failed:", e?.message || e);
      }
    }

    try {
      const defContact = await this.request<any>("GET", `/customers/${customerId}/contacts/default`);
      const cid = defContact.registrant_contact?.contact_id || defContact.registrant_contact?.id || defContact.contact_id;
      if (cid) return String(cid);
    } catch {}

    return customerId;
  }

  async createCustomerContact(customerId: string, data: Record<string, any>) {
    const phone = data.phone || data.tel_no || "";
    let tel_cc_no = data.phone_cc || data.tel_cc_no || "62";
    let tel_no = phone;
    if (phone.startsWith("+")) {
      tel_cc_no = phone.substring(1, 3);
      tel_no = phone.substring(3);
    } else if (phone.startsWith("62")) {
      tel_cc_no = "62";
      tel_no = phone.substring(2);
    } else if (phone.startsWith("0")) {
      tel_no = phone.substring(1);
    }

    return this.request<any>("POST", `/customers/${customerId}/contacts`, {
      name: data.name || "Registrant",
      company: data.company || "Personal",
      email: data.email,
      address_line_1: data.address || data.address_line_1 || "Indonesia",
      city: data.city || "Jakarta",
      state: data.state || "DKI Jakarta",
      country_code: (data.country || data.country_code || "ID").slice(0, 2).toLowerCase(),
      zipcode: data.zipcode || "10110",
      tel_cc_no,
      tel_no: tel_no || "8123456789",
      eligibility_criteria: data.eligibility_criteria || (data.domain_name?.toLowerCase().endsWith(".id") ? "co" : "com"),
    });
  }

  async registerDomain(data: Record<string, any>) {
    const customerId = String(data.customer_id || "");
    const isIdTld = data.domain_name?.toLowerCase().endsWith(".id");
    let contactId = data.registrant_contact_id ? String(data.registrant_contact_id) : "";
    
    if (!contactId || contactId === customerId || isIdTld) {
      contactId = await this.resolveContactIdForDomain(customerId, data.domain_name);
    }

    const payload = {
      domain_name: data.domain_name,
      customer_id: customerId,
      registrant_contact_id: contactId,
      admin_contact_id: data.admin_contact_id || contactId,
      billing_contact_id: data.billing_contact_id || contactId,
      tech_contact_id: data.tech_contact_id || contactId,
      years: data.years || 1,
      ns: data.ns || "",
      purchase_privacy_protection: data.purchase_privacy_protection || data.privacy_protection ? "true" : "false",
      invoice_option: data.invoice_option || "keep_invoice",
    };

    try {
      return await this.request<any>("POST", "/domains", payload);
    } catch (err: any) {
      const errMsg = String(err?.message || err || "").toLowerCase();
      if (errMsg.includes("type did not match") || errMsg.includes("registrant contact") || errMsg.includes("tld .id")) {
        console.warn(`[registerDomain] Contact type mismatch for ${data.domain_name}, force-creating new .id contact...`);
        try {
          const custInfo = await this.getCustomer(customerId).catch(() => null);
          const newContact = await this.createCustomerContact(customerId, {
            name: custInfo?.name || "Registrant",
            email: custInfo?.email || "registrant@ekstensi.id",
            company: custInfo?.company || "Personal",
            address: custInfo?.address_line_1 || "Indonesia",
            city: custInfo?.city || "Jakarta",
            state: custInfo?.state || "DKI Jakarta",
            zipcode: custInfo?.zipcode || "10110",
            phone: custInfo?.tel_no || "8123456789",
            domain_name: data.domain_name,
            eligibility_criteria: "co",
          });
          const newContactId = String(newContact?.contact_id || newContact?.id || "");
          if (newContactId) {
            payload.registrant_contact_id = newContactId;
            payload.admin_contact_id = newContactId;
            payload.billing_contact_id = newContactId;
            payload.tech_contact_id = newContactId;
            console.log(`[registerDomain] Retrying domain creation with new .id contact_id ${newContactId}...`);
            return await this.request<any>("POST", "/domains", payload);
          }
        } catch (retryErr: any) {
          console.error("[registerDomain] Force .id contact creation failed:", retryErr?.message || retryErr);
        }
      }
      throw err;
    }
  }
  getDomain(domainId: string) {
    return this.request<any>("GET", `/domains/${domainId}`);
  }
  listDomains(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request<any>("GET", `/domains${qs}`);
  }
  renewDomain(domainId: string, years: number, invoiceOption: string = "keep_invoice") {
    return this.request<any>("POST", `/domains/${domainId}/renew`, {
      years,
      current_date: new Date().toISOString().split("T")[0],
      invoice_option: invoiceOption,
    });
  }
  transferDomain(data: Record<string, any>) {
    return this.request<any>("POST", "/domains/transfer", {
      domain_name: data.domain_name,
      auth_code: data.auth_code || "",
      customer_id: data.customer_id || "",
      registrant_contact_id: data.customer_id || "",
      admin_contact_id: data.customer_id || "",
      billing_contact_id: data.customer_id || "",
      tech_contact_id: data.customer_id || "",
      invoice_option: data.invoice_option || "keep_invoice",
    });
  }
  deleteDomain(domainId: string) {
    return this.request<any>("DELETE", `/domains/${domainId}`);
  }

  lockDomain(domainId: string) {
    return this.request<any>("PUT", `/domains/${domainId}/locked`);
  }
  unlockDomain(domainId: string) {
    return this.request<any>("DELETE", `/domains/${domainId}/locked`);
  }
  getLockStatus(domainId: string) {
    return this.request<any>("GET", `/domains/${domainId}/locked`);
  }
  enableTheftProtection(domainId: string) {
    return this.request<any>("PUT", `/domains/${domainId}/theft_protection`);
  }
  disableTheftProtection(domainId: string) {
    return this.request<any>("DELETE", `/domains/${domainId}/theft_protection`);
  }
  getAuthCode(domainId: string) {
    return this.request<any>("GET", `/domains/${domainId}/auth_code`);
  }
  updateAuthCode(domainId: string, authCode: string) {
    return this.request<any>("PUT", `/domains/${domainId}/auth_code`, { auth_code: authCode });
  }
  getNameservers(domainId: string) {
    return this.request<any>("GET", `/domains/${domainId}/ns`);
  }
  updateNameservers(domainId: string, ns: string[]) {
    return this.request<any>("PUT", `/domains/${domainId}/ns`, { ns: ns.join(",") });
  }
  getDomainSuggestions(keyword: string, tld?: string) {
    const qs = new URLSearchParams({ keyword });
    if (tld) qs.set("tld", tld);
    return this.request<any>("GET", `/domains/suggestion?${qs.toString()}`);
  }
  restoreDomain(domainId: string, invoiceOption: string = "keep_invoice") {
    return this.request<any>("POST", `/domains/${domainId}/restore`, { invoice_option: invoiceOption });
  }
  suspendDomain(domainId: string) {
    return this.request<any>("PUT", `/domains/${domainId}/suspended`);
  }
  unsuspendDomain(domainId: string) {
    return this.request<any>("DELETE", `/domains/${domainId}/suspended`);
  }

  // --- DNS ---
  getDnsRecords(domainId: string, type: string) {
    return this.request<any>("GET", `/domains/${domainId}/dns/${type}`);
  }
  addDnsRecord(domainId: string, type: string, data: Record<string, any>) {
    return this.request<any>("POST", `/domains/${domainId}/dns/${type}`, data);
  }
  updateDnsRecord(domainId: string, type: string, oldHost: string, oldValue: string, data: Record<string, any>) {
    return this.request<any>("PUT", `/domains/${domainId}/dns/${type}/${oldHost}/${oldValue}`, data);
  }
  deleteDnsRecord(domainId: string, type: string, hostname: string, value: string) {
    return this.request<any>("DELETE", `/domains/${domainId}/dns/${type}/${hostname}/${value}`);
  }

  // --- Forwarding ---
  getDomainForwarding(domainId: string) {
    return this.request<any>("GET", `/domains/${domainId}/domain_forwarding`);
  }
  updateDomainForwarding(domainId: string, data: Record<string, any>) {
    return this.request<any>("PUT", `/domains/${domainId}/domain_forwarding`, data);
  }
  getEmailForwarding(domainId: string) {
    return this.request<any>("GET", `/domains/${domainId}/email_forwarding`);
  }
  createEmailForwarding(domainId: string, data: Record<string, any>) {
    return this.request<any>("POST", `/domains/${domainId}/email_forwarding`, data);
  }
  deleteEmailForwarding(domainId: string, email: string) {
    return this.request<any>("DELETE", `/domains/${domainId}/email_forwarding/${email}`);
  }

  // --- Privacy ---
  getPrivacyProtection(domainId: string) {
    return this.request<any>("GET", `/domains/${domainId}/privacy_protection`);
  }
  enablePrivacyProtection(domainId: string) {
    return this.request<any>("PUT", `/domains/${domainId}/privacy_protection`);
  }
  disablePrivacyProtection(domainId: string) {
    return this.request<any>("DELETE", `/domains/${domainId}/privacy_protection`);
  }
  buyPrivacyProtection(domainId: string) {
    return this.request<any>("POST", `/domains/${domainId}/privacy_protection/buy`);
  }

  // --- Customers ---
  createCustomer(data: Record<string, any>) {
    const phone = data.phone || "";
    let tel_cc_no = data.phone_cc || data.tel_cc_no || "62";
    let tel_no = phone;
    if (phone.startsWith("+")) {
      tel_cc_no = phone.substring(1, 3);
      tel_no = phone.substring(3);
    } else if (phone.startsWith("62")) {
      tel_cc_no = "62";
      tel_no = phone.substring(2);
    } else if (phone.startsWith("0")) {
      tel_no = phone.substring(1);
    }

    return this.request<any>("POST", "/customers", {
      name: data.name,
      email: data.email,
      password: data.password || "Pass@123!",
      company: data.company || "",
      address_line_1: data.address || data.address_line_1 || "",
      city: data.city || "",
      state: data.state || "",
      country_code: data.country || data.country_code || "ID",
      tel_cc_no,
      tel_no,
      send_welcome_email: data.send_welcome_email || "true",
      notify: "true",
    });
  }
  listCustomers() {
    return this.request<any>("GET", "/customers");
  }
  getCustomer(customerId: string) {
    return this.request<any>("GET", `/customers/${customerId}`);
  }
  updateCustomer(customerId: string, data: Record<string, any>) {
    return this.request<any>("PUT", `/customers/${customerId}`, data);
  }
  deleteCustomer(customerId: string) {
    return this.request<any>("DELETE", `/customers/${customerId}`);
  }

  // --- Customer Transactions / Invoices ---
  /** List customer transactions (invoices). Set only_pending=true for pending only. */
  listCustomerTransactions(customerId: string, onlyPending: boolean = false) {
    const qs = onlyPending ? "?only_pending=true" : "";
    return this.request<any>("GET", `/customers/${customerId}/transactions${qs}`);
  }
  /** Pay a keep_invoice transaction → triggers domain creation + deducts reseller balance */
  payCustomerTransaction(customerId: string, transactionId: string, subtractBalance: boolean = false) {
    return this.request<any>("POST", `/customers/${customerId}/transactions/pay`, {
      transaction_id: transactionId,
      subtract_balance: subtractBalance ? "true" : "false",
    });
  }
  /** Cancel a pending invoice */
  cancelCustomerTransaction(customerId: string, transactionId: string) {
    return this.request<any>("POST", `/customers/${customerId}/transactions/cancel`, {
      transaction_id: transactionId,
    });
  }
  /** Execute a pending order-only transaction */
  executeCustomerTransaction(customerId: string, transactionId: string, cancelInvoice: boolean = false) {
    return this.request<any>("POST", `/customers/${customerId}/transactions/execute`, {
      transaction_id: transactionId,
      cancel_invoice: cancelInvoice ? "true" : "false",
    });
  }

  // --- Account / Billing (with In-Memory Caching & Graceful Fallback) ---
  getReseller(resellerId: string) {
    return this.request<any>("GET", `/resellers/${resellerId}`);
  }
  updateReseller(resellerId: string, data: Record<string, any>) {
    return this.request<any>("PUT", `/resellers/${resellerId}`, data);
  }

  async getBalance() {
    const cacheKey = `balance:${this.authHeader}`;
    const cached = cacheStore.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }
    try {
      const data = await this.request<any>("GET", "/account/balance");
      cacheStore.set(cacheKey, { data, expiresAt: Date.now() + 30_000 }); // 30s cache
      return data;
    } catch (err) {
      if (cached) return cached.data; // Return stale cache if Liquid API is down/rate limited
      throw err;
    }
  }

  async getPrices() {
    const cacheKey = `prices:${this.authHeader}`;
    const cached = cacheStore.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }
    try {
      const data = await this.request<any>("GET", "/account/prices");
      cacheStore.set(cacheKey, { data, expiresAt: Date.now() + 15 * 60_000 }); // 15 mins cache
      return data;
    } catch (err) {
      if (cached) return cached.data; // Return stale cache if Liquid API rate limited
      throw err;
    }
  }

  async getCustomerPrices() {
    const cacheKey = `cust_prices:${this.authHeader}`;
    const cached = cacheStore.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }
    try {
      const data = await this.request<any>("GET", "/customers/prices");
      cacheStore.set(cacheKey, { data, expiresAt: Date.now() + 15 * 60_000 }); // 15 mins cache
      return data;
    } catch (err) {
      if (cached) return cached.data; // Return stale cache if Liquid API rate limited
      throw err;
    }
  }

  getTransactions() {
    return this.request<any>("GET", "/account/transactions");
  }
  getTransaction(transactionId: string) {
    return this.request<any>("GET", `/account/transactions/${transactionId}`);
  }
}

// In-Memory Cache Store for Liquid API responses
interface CacheItem {
  data: any;
  expiresAt: number;
}
const cacheStore = new Map<string, CacheItem>();


export function formatCustomerPrices(raw: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  if (!raw || typeof raw !== "object") return result;

  const formatYearsMap = (yearsMap: Record<string, any> | undefined) => {
    if (!yearsMap || typeof yearsMap !== "object") return undefined;
    const res: Record<number, number> = {};
    for (const [yr, val] of Object.entries(yearsMap)) {
      if (val) {
        const numVal = Number(val);
        res[Number(yr)] = numVal < 1000 ? numVal * 1000 : numVal;
      }
    }
    return res;
  };

  for (const item of Object.values(raw)) {
    if (!item || typeof item !== "object" || !item.tld_label) continue;
    const tld = item.tld_label.replace(/^\./, "").toLowerCase();
    const createPrice = item.create?.["1"] || item.create?.[1] || null;
    const renewPrice = item.renew?.["1"] || item.renew?.[1] || null;
    const transferPrice = item.transfer?.["1"] || item.transfer?.[1] || null;
    const restorePrice = item.restore?.["1"] || item.restore?.[1] || null;

    result[tld] = {
      price_new: createPrice,
      price_register: createPrice,
      price_renew: renewPrice,
      price_transfer: transferPrice,
      price_restore: restorePrice,
      create_years: formatYearsMap(item.create),
      renew_years: formatYearsMap(item.renew),
      privacy_protect: item.privacy_protect || null,
      currency: "IDR",
    };
  }
  return result;
}
