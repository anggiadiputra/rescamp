import { AppError } from "./error";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export class LiquidClient {
  private baseURL = "https://api.liqu.id/v1";
  private authHeader: string;

  constructor(resellerId: string, apiKey: string) {
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
  async registerDomain(data: Record<string, any>) {
    const customerId = String(data.customer_id || "");
    let contactId = data.registrant_contact_id ? String(data.registrant_contact_id) : "";
    
    if (!contactId || contactId === customerId) {
      try {
        const defContact = await this.request<any>("GET", `/customers/${customerId}/contacts/default`);
        contactId = String(
          defContact.registrant_contact?.contact_id ||
          defContact.registrant_contact?.id ||
          defContact.contact_id ||
          ""
        );
      } catch {}
    }
    
    if (!contactId || contactId === customerId) {
      try {
        const list = await this.request<any>("GET", `/customers/${customerId}/contacts`);
        const arr = Array.isArray(list) ? list : list?.data || list?.contacts || [];
        if (arr.length > 0) {
          contactId = String(arr[0].contact_id || arr[0].id || "");
        }
      } catch {}
    }

    if (!contactId) contactId = customerId;

    return this.request<any>("POST", "/domains", {
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
    });
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
