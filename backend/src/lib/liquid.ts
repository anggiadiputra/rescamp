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
  registerDomain(data: Record<string, any>) {
    // LIQUID requires: domain_name, customer_id, registrant_contact_id, invoice_option
    const cid = data.customer_id || data.registrant_contact_id;
    return this.request<any>("POST", "/domains", {
      domain_name: data.domain_name,
      customer_id: cid,
      registrant_contact_id: cid,
      admin_contact_id: cid,
      billing_contact_id: cid,
      tech_contact_id: cid,
      years: data.years || 1,
      ns: data.ns || "",
      purchase_privacy_protection: data.purchase_privacy_protection || data.privacy_protection ? "true" : "false",
      invoice_option: data.invoice_option || "NoInvoice",
    });
  }
  getDomain(domainId: string) {
    return this.request<any>("GET", `/domains/${domainId}`);
  }
  listDomains(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request<any>("GET", `/domains${qs}`);
  }
  renewDomain(domainId: string, years: number) {
    return this.request<any>("POST", `/domains/${domainId}/renew`, {
      years,
      current_date: new Date().toISOString().split("T")[0],
      invoice_option: "NoInvoice",
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
      invoice_option: "NoInvoice",
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
  restoreDomain(domainId: string) {
    return this.request<any>("POST", `/domains/${domainId}/restore`, { invoice_option: "NoInvoice" });
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
      zipcode: data.zipcode || "",
      tel_cc_no,
      tel_no,
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

  // --- Account / Billing ---
  getReseller(resellerId: string) {
    return this.request<any>("GET", `/resellers/${resellerId}`);
  }
  updateReseller(resellerId: string, data: Record<string, any>) {
    return this.request<any>("PUT", `/resellers/${resellerId}`, data);
  }
  getBalance() {
    return this.request<any>("GET", "/account/balance");
  }
  getPrices() {
    return this.request<any>("GET", "/account/prices");
  }
  getCustomerPrices() {
    return this.request<any>("GET", "/customers/prices");
  }
  getTransactions() {
    return this.request<any>("GET", "/account/transactions");
  }
  getTransaction(transactionId: string) {
    return this.request<any>("GET", `/account/transactions/${transactionId}`);
  }
}

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
