import { AppError } from "./error";
import { env } from "../config/env";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export class LiquidClient {
  private baseURL: string;
  private authHeader: string;

  constructor(resellerId: string, apiKey: string, baseURL?: string) {
    const rawUrl = baseURL || env.LIQUID_BASE_URL;
    this.baseURL = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
    this.authHeader = "Basic " + btoa(`${resellerId}:${apiKey}`);
  }

  private async request<T>(method: HttpMethod, path: string, body?: Record<string, any>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000); // 30s timeout
    const url = `${this.baseURL}${path}`;

    try {
      const res = await fetch(url, {
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
        const errMsg = data.message || data.error || data.error_message || data.description || text || "LIQUID API error";
        if (!errMsg.toLowerCase().includes("privacy protect not available")) {
          console.error(`[Resellercamp API Error] ${method} ${path} [HTTP ${res.status}]:`, typeof data === "object" ? JSON.stringify(data) : data);
        }
        const status = res.status === 401 || res.status === 403 ? 502 : res.status;
        throw new AppError(errMsg, status);
      }

      // Detect silent failures: HTTP 200 but response is just {"message":""} with no payload keys.
      // Resellercamp returns this envelope when the action did not actually succeed
      // (e.g. sandbox/test accounts lacking permission, missing prerequisite contact, etc.).
      // DELETE is exempt because a successful delete legitimately returns nothing.
      // List endpoints (GET /domains) are exempt: a reseller with zero domains can legitimately
      // return {"message":""}; callers already fall back to [] via `raw?.data || raw?.domains || []`.
      const isListEndpoint = method === "GET" && path === "/domains";
      if (method !== "DELETE" && !isListEndpoint) {
        const keys = data && typeof data === "object" ? Object.keys(data) : [];
        const isEmptyEnvelope = keys.length === 1 && keys[0] === "message" && !data.message;
        if (isEmptyEnvelope) {
          throw new AppError(
            `Resellercamp returned an empty response for ${method} ${path}. ` +
            `This usually means the action was rejected (sandbox account limitation, missing prerequisite, or invalid credentials).`,
            502
          );
        }
      }
      return data;
    } catch (err: any) {
      if (err instanceof AppError) {
        console.error(`[Resellercamp API Error] ${method} ${path}:`, err.message);
        throw err;
      }
      if (err.name === "AbortError") {
        console.error(`[Resellercamp API Timeout] ${method} ${path}`);
        throw new AppError("Resellercamp API request timed out (30s)", 504);
      }
      console.error(`[Resellercamp API Connection Error] ${method} ${path}:`, err);
      throw new AppError(`Gagal terhubung ke Resellercamp API: ${err.message || "Network Error"}`, 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  // --- Domain ---
  checkAvailability(domain: string) {
    return this.request<any>("GET", `/domains/availability?domain=${domain}`);
  }

  /**
   * Map a domain TLD to the correct Resellercamp eligibility_criteria value.
   * Per luquid.md: valid values = mn, name, biz, us, co, in, cc, ca, com, bz, mobi, info, tv, org, net, pw, asia
   * .id ccTLDs (co.id, web.id, my.id, etc.) require "co" eligibility.
   * All generic TLDs (.com, .net, .org, .info, etc.) use "com" eligibility.
   */
  private getTldEligibility(domainName: string): string {
    const d = domainName.toLowerCase();
    // All .id ccTLDs (.id, .co.id, .my.id, .sch.id, .ac.id, .or.id, etc.) use standard contact in Resellercamp
    if (d.endsWith(".id")) return "";

    if (d.endsWith(".us")) return "us";
    if (d.endsWith(".asia")) return "asia";
    if (d.endsWith(".ca")) return "ca";
    if (d.endsWith(".in")) return "in";
    if (d.endsWith(".mobi")) return "mobi";
    if (d.endsWith(".tv")) return "tv";
    if (d.endsWith(".cc")) return "cc";
    if (d.endsWith(".bz")) return "bz";
    if (d.endsWith(".pw")) return "pw";
    if (d.endsWith(".biz")) return "biz";
    if (d.endsWith(".org")) return "org";
    if (d.endsWith(".net")) return "net";
    if (d.endsWith(".info")) return "info";
    // Default: generic TLD eligibility
    return "com";
  }

  /**
   * Resolves correct registrant contact ID for a domain from Resellercamp.
   * Strategy per luquid.md:
   * 1. Query /contacts?eligibility_criteria=<tld_eligibility> (server-side filtered)
   * 2. Use /contacts/default?eligibility_criteria=<tld_eligibility>
   * 3. Auto-create a new contact with correct eligibility if none found
   */
  async resolveContactIdForDomain(customerId: string, domainName: string): Promise<string> {
    const eligibility = this.getTldEligibility(domainName);
    let custInfo: any = null;

    // Step 1: Query active contacts and find one matching eligibility_criteria
    try {
      const list = await this.request<any>("GET", `/customers/${customerId}/contacts?status=Active`);
      const arr = Array.isArray(list) ? list : list?.data || list?.contacts || [];
      const matched = arr.find((c: any) => {
        const crit = Array.isArray(c.eligibility_criteria)
          ? c.eligibility_criteria
          : [c.eligibility_criteria || c.type || null];

        if (!eligibility) {
          // Look for contact with null / empty eligibility_criteria
          return crit.every((x: any) => !x || x === "null" || x === "");
        }

        return crit.some((x: any) => x && String(x).toLowerCase() === eligibility.toLowerCase());
      });
      if (matched) {
        const contactId = String(matched.contact_id || matched.id || "");
        if (contactId) {
          return contactId;
        }
      }
    } catch (e: any) {
      console.warn(`[resolveContact] contacts query failed:`, e?.message);
    }

    // Step 2: Try /contacts/default with eligibility_criteria (per luquid.md docs)
    try {
      const url = eligibility
        ? `/customers/${customerId}/contacts/default?eligibility_criteria=${eligibility}`
        : `/customers/${customerId}/contacts/default`;
      const def = await this.request<any>("GET", url);
      const cid = def?.registrant_contact?.contact_id || def?.registrant_contact?.id || def?.contact_id || def?.id;
      if (cid) {
        return String(cid);
      }
    } catch (e: any) {
      console.warn(`[resolveContact] contacts/default failed:`, e?.message);
    }

    // Step 3: Auto-create a new contact with the correct eligibility type
    try {
      custInfo = await this.getCustomer(customerId).catch(() => null);
      const contactPayload: any = {
        name: custInfo?.name || "Registrant",
        email: custInfo?.email || "registrant@ekstensi.id",
        company: custInfo?.company || "Personal",
        address: custInfo?.address_line_1 || "Indonesia",
        city: custInfo?.city || "Jakarta",
        state: custInfo?.state || "DKI Jakarta",
        zipcode: custInfo?.zipcode || "10110",
        phone: custInfo?.tel_no || "8123456789",
      };
      if (eligibility) {
        contactPayload.eligibility_criteria = eligibility;
      }
      const newContact = await this.createCustomerContact(customerId, contactPayload);
      const newId = String(newContact?.contact_id || newContact?.id || "");
      if (newId) {
        return newId;
      }
    } catch (e: any) {
      console.warn("[resolveContact] Auto-create contact failed:", e?.message || e);
    }

    // Last resort fallback: any active contact
    try {
      const list = await this.request<any>("GET", `/customers/${customerId}/contacts?status=Active`);
      const arr = Array.isArray(list) ? list : list?.data || list?.contacts || [];
      if (arr.length > 0) return String(arr[0].contact_id || arr[0].id);
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

    const payload: Record<string, any> = {
      name: data.name || "Registrant",
      company: data.company || "Personal",
      email: data.email || "registrant@ekstensi.id",
      address_line_1: data.address || data.address_line_1 || "Indonesia",
      city: data.city || "Jakarta",
      state: data.state || "DKI Jakarta",
      country_code: (data.country || data.country_code || "ID").slice(0, 2).toLowerCase(),
      zipcode: data.zipcode || "10110",
      tel_cc_no,
      tel_no: tel_no || "8123456789",
    };

    if (data.eligibility_criteria) {
      payload.eligibility_criteria = data.eligibility_criteria;
    }

    return this.request<any>("POST", `/customers/${customerId}/contacts`, payload);
  }

  // --- Contacts Management (luquid.md Section 4: lines 359-497) ---
  listCustomerContacts(customerId: string | number, params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request<any>("GET", `/customers/${customerId}/contacts${qs}`);
  }
  getDefaultCustomerContact(customerId: string | number, eligibilityCriteria?: string) {
    const qs = eligibilityCriteria ? `?eligibility_criteria=${encodeURIComponent(eligibilityCriteria)}` : "";
    return this.request<any>("GET", `/customers/${customerId}/contacts/default${qs}`);
  }
  updateCustomerContact(customerId: string | number, contactId: string | number, data: Record<string, any>) {
    return this.request<any>("PUT", `/customers/${customerId}/contacts/${contactId}`, data);
  }
  deleteCustomerContact(customerId: string | number, contactId: string | number) {
    return this.request<any>("DELETE", `/customers/${customerId}/contacts/${contactId}`);
  }
  updateCustomerContactExtra(customerId: string | number, contactId: string | number, data: Record<string, any>) {
    return this.request<any>("PUT", `/customers/${customerId}/contacts/${contactId}/extra`, data);
  }
  getContactValidity(customerId: string | number, contactId: string | number, eligibilityCriteria: string) {
    return this.request<any>("GET", `/customers/${customerId}/contacts/${contactId}/validity/${eligibilityCriteria}`);
  }

  async registerDomain(data: Record<string, any>) {
    const customerId = String(data.customer_id || "");
    // Always resolve correct contact per TLD — never trust frontend-supplied contact ID
    const contactId = await this.resolveContactIdForDomain(customerId, data.domain_name);

    const payload: Record<string, string> = {
      domain_name: data.domain_name,
      customer_id: customerId,
      registrant_contact_id: contactId,
      admin_contact_id: data.admin_contact_id || contactId,
      billing_contact_id: data.billing_contact_id || contactId,
      tech_contact_id: data.tech_contact_id || contactId,
      years: String(data.years || 1),
      invoice_option: data.invoice_option || "keep_invoice",
    };

    if (data.ns && String(data.ns).trim()) {
      payload.ns = String(data.ns).trim();
    }
    if (data.purchase_privacy_protection || data.privacy_protection) {
      payload.purchase_privacy_protection = "true";
    }

    try {
      return await this.request<any>("POST", "/domains", payload);
    } catch (err: any) {
      const errMsg = String(err?.message || err || "").toLowerCase();
      if (errMsg.includes("did not match") || errMsg.includes("registrant contact")) {
        const eligibility = this.getTldEligibility(data.domain_name);
        console.warn(`[registerDomain] Contact type mismatch for ${data.domain_name}, creating new contact with eligibility=${eligibility}...`);
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
            eligibility_criteria: eligibility,
          });
          const newContactId = String(newContact?.contact_id || newContact?.id || "");
          if (newContactId) {
            payload.registrant_contact_id = newContactId;
            payload.admin_contact_id = newContactId;
            payload.billing_contact_id = newContactId;
            payload.tech_contact_id = newContactId;
            console.log(`[registerDomain] Retrying domain creation with fresh contact ${newContactId}...`);
            return await this.request<any>("POST", "/domains", payload);
          }
        } catch (retryErr: any) {
          console.error("[registerDomain] Fallback contact creation failed:", retryErr?.message || retryErr);
        }
      }
      throw err;
    }
  }
  getDomain(domainId: string) {
    return this.request<any>("GET", `/domains/${domainId}?fields=all`);
  }
  listDomains(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request<any>("GET", `/domains${qs}`);
  }
  async renewDomain(domainId: string, years: number, invoiceOption: string = "keep_invoice", expiryDate?: string | null, purchasePrivacyProtection?: boolean) {
    // Always fetch the authoritative expiry_date from Resellercamp API
    // (format: "Y-m-d H:i:s" e.g. "2027-07-30 12:52:14")
    let currentDate = "";
    try {
      const details = await this.getDomain(domainId);
      if (details?.expiry_date) {
        currentDate = String(details.expiry_date);
        console.log(`[renewDomain] Got expiry_date from Resellercamp: "${currentDate}"`);
      }
    } catch (e: any) {
      console.warn("[renewDomain] Failed to fetch expiry_date via getDomain:", e?.message);
    }

    // Fallback to provided expiryDate if API call failed
    if (!currentDate && expiryDate) {
      currentDate = expiryDate.includes(" ") ? expiryDate : `${expiryDate} 00:00:00`;
      console.log(`[renewDomain] Fallback expiryDate used: "${currentDate}"`);
    }

    if (!currentDate) {
      throw new Error("Unable to determine current expiry date for domain renewal");
    }

    console.log(`[renewDomain] Sending renew domainId=${domainId}, years=${years}, current_date="${currentDate}", purchase_privacy_protection=${!!purchasePrivacyProtection}`);
    const body: Record<string, any> = {
      years: String(years),
      current_date: currentDate,
      invoice_option: invoiceOption,
    };
    if (purchasePrivacyProtection) {
      body.purchase_privacy_protection = "true";
    }
    return this.request<any>("POST", `/domains/${domainId}/renew`, body);
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
  checkTransferValidity(domainName: string, authCode?: string) {
    const payload: Record<string, string> = { domain_name: domainName };
    if (authCode) payload.auth_code = authCode;
    return this.request<any>("POST", "/domains/transfer/validity", payload);
  }
  updateDomainContactsPending(domainId: string | number, data: Record<string, any>) {
    return this.request<any>("PUT", `/domains/${domainId}/contacts-pending`, {
      ...data,
      is_domain_pending: "1",
      is_trans_execute_queue: "1",
    });
  }
  resendIrtpVerification(domainId: string | number, type: string = "email") {
    return this.request<any>("POST", `/domains/${domainId}/irtp_verification/resend`, { type });
  }
  cancelDomainTransfer(domainId: string | number) {
    return this.request<any>("POST", `/domains/${domainId}/transfer/cancel`);
  }
  resendTransferApprovalEmail(domainId: string | number) {
    return this.request<any>("POST", `/domains/${domainId}/transfer/resend_approval_email`);
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
    const payload: Record<string, string> = { ns: ns.join(",") };
    ns.forEach((item, index) => {
      payload[`ns${index + 1}`] = item;
    });
    return this.request<any>("PUT", `/domains/${domainId}/ns`, payload);
  }
  getDomainSuggestions(keyword: string, tld?: string) {
    const qs = new URLSearchParams({ keyword });
    if (tld) qs.set("tld", tld);
    return this.request<any>("GET", `/domains/suggestion?${qs.toString()}`);
  }
  restoreDomain(domainId: string, invoiceOption: string = "keep_invoice") {
    return this.request<any>("POST", `/domains/${domainId}/restore`, { invoice_option: invoiceOption });
  }
  suspendDomain(domainId: string, reason?: string) {
    return this.request<any>("PUT", `/domains/${domainId}/suspended`, {
      reason: reason || "",
    });
  }
  unsuspendDomain(domainId: string) {
    return this.request<any>("DELETE", `/domains/${domainId}/suspended`);
  }
  /** Retrieve current suspend status (incl. reason) for a domain. */
  getSuspendStatus(domainId: string) {
    return this.request<any>("GET", `/domains/${domainId}/suspended`);
  }
  resendRaaVerification(domainId: string) {
    return this.request<any>("POST", `/domains/${domainId}/raa_verification/resend`);
  }
  getContactDetails(customerId: string, contactId: string) {
    return this.request<any>("GET", `/customers/${customerId}/contacts/${contactId}`);
  }

  // --- Common Utilities (luquid.md Section 3: lines 288-356) ---
  getAgreement(type: string) {
    return this.request<any>("GET", `/agreements/${type}`);
  }
  getCountries() {
    return this.request<any>("GET", "/countries");
  }
  getCountryStates(countryCode: string) {
    return this.request<any>("GET", `/countries/${countryCode}/states`);
  }
  getCurrencies() {
    return this.request<any>("GET", "/currencies");
  }
  getCurrency(symbol: string) {
    return this.request<any>("GET", `/currencies/${symbol}`);
  }
  getTlds() {
    return this.request<any>("GET", "/tlds");
  }
  getTld(name: string) {
    return this.request<any>("GET", `/tlds/${name}`);
  }

  // --- DNS ---
  getDnsRecords(domainId: string, type: string) {
    return this.request<any>("GET", `/domains/${domainId}/dns/${type}`);
  }
  addDnsRecord(domainId: string, type: string, data: Record<string, any>) {
    return this.request<any>("POST", `/domains/${domainId}/dns/${type}`, data);
  }
  updateDnsRecord(domainId: string, type: string, oldHost: string, oldValue: string, data: Record<string, any>) {
    if (type.toLowerCase() === "txt") {
      return this.request<any>("PUT", `/domains/${domainId}/dns/txt`, {
        old_hostname: oldHost,
        old_value: oldValue,
        ...data,
      });
    }
    return this.request<any>("PUT", `/domains/${domainId}/dns/${type}/${encodeURIComponent(oldHost)}/${encodeURIComponent(oldValue)}`, data);
  }
  deleteDnsRecord(domainId: string, type: string, hostname: string, value: string) {
    if (type.toLowerCase() === "txt") {
      const qs = new URLSearchParams({ hostname, value });
      return this.request<any>("DELETE", `/domains/${domainId}/dns/txt?${qs.toString()}`);
    }
    return this.request<any>("DELETE", `/domains/${domainId}/dns/${type}/${encodeURIComponent(hostname)}/${encodeURIComponent(value)}`);
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
  getSingleEmailForwarding(domainId: string | number, email: string) {
    return this.request<any>("GET", `/domains/${domainId}/email_forwarding/${encodeURIComponent(email)}`);
  }
  updateEmailForwarding(domainId: string | number, email: string, forwardTo: string) {
    return this.request<any>("PUT", `/domains/${domainId}/email_forwarding/${encodeURIComponent(email)}`, { forward_to: forwardTo });
  }
  deleteEmailForwarding(domainId: string, email: string) {
    return this.request<any>("DELETE", `/domains/${domainId}/email_forwarding/${encodeURIComponent(email)}`);
  }
  getCatchAllEmailForwarding(domainId: string | number) {
    return this.request<any>("GET", `/domains/${domainId}/email_forwarding/catch_all`);
  }
  updateCatchAllEmailForwarding(domainId: string | number, email?: string) {
    return this.request<any>("PUT", `/domains/${domainId}/email_forwarding/catch_all`, { email: email || "" });
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
  buyPrivacyProtection(domainId: string, invoiceOption: string = "no_invoice") {
    return this.request<any>("POST", `/domains/${domainId}/privacy_protection/buy`, {
      invoice_option: invoiceOption,
    });
  }

  // --- Customers ---
  /**
   * Generate a secure random password for API-only customer accounts
   * Uses crypto.getRandomValues() for cryptographic security
   */
  private generateSecurePassword(): string {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    const array = new Uint32Array(16);
    crypto.getRandomValues(array);
    let password = "";
    for (let i = 0; i < 16; i++) {
      password += chars[(array[i] ?? 0) % chars.length];
    }
    return password;
  }

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

    // ponytail: auto-generate secure password if not provided
    // This is for API-only integration; customer never logs in with this password
    const password = data.password || this.generateSecurePassword();

    return this.request<any>("POST", "/customers", {
      name: data.name,
      email: data.email,
      password,
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
  listCustomers(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request<any>("GET", `/customers${qs}`);
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
  getCustomerTempPassword(customerId: string | number) {
    return this.request<any>("GET", `/customers/temp_password?customer_id=${customerId}`);
  }
  updateCustomerTotalReceipts(data: Record<string, any>) {
    return this.request<any>("PUT", "/customers/totalreceipts", data);
  }
  getCustomerDefaultNs(customerId: string | number) {
    return this.request<any>("GET", `/customers/${customerId}/ns/default`);
  }

  // --- Customer Transactions / Invoices (luquid.md Lines 80-213) ---
  getCustomerBalance(customerId: string | number) {
    return this.request<any>("GET", `/customers/${customerId}/balance`);
  }
  /** List customer transactions (invoices). Set only_pending=true for pending only. */
  listCustomerTransactions(customerId: string | number, onlyPending: boolean = false, params?: Record<string, string>) {
    const qs = new URLSearchParams(params || {}).toString();
    const suffix = onlyPending ? (qs ? `&only_pending=true` : `?only_pending=true`) : (qs ? `?${qs}` : "");
    return this.request<any>("GET", `/customers/${customerId}/transactions${suffix}`);
  }
  getCustomerTransaction(customerId: string | number, transactionId: string | number) {
    return this.request<any>("GET", `/customers/${customerId}/transactions/${transactionId}`);
  }
  /** Pay a keep_invoice transaction → triggers domain creation + deducts reseller balance */
  payCustomerTransaction(customerId: string | number, transactionId: string | number, subtractBalance: boolean = false) {
    return this.request<any>("POST", `/customers/${customerId}/transactions/pay`, {
      transaction_id: String(transactionId),
      subtract_balance: subtractBalance ? "true" : "false",
    });
  }
  payCustomerTransactionAddOnly(customerId: string | number, transactionId: string | number) {
    return this.request<any>("POST", `/customers/${customerId}/transactions/pay_add_only`, {
      transaction_id: String(transactionId),
    });
  }
  /** Cancel a pending invoice */
  cancelCustomerTransaction(customerId: string | number, transactionId: string | number) {
    return this.request<any>("POST", `/customers/${customerId}/transactions/cancel`, {
      transaction_id: String(transactionId),
    });
  }
  /** Execute a pending order-only transaction */
  executeCustomerTransaction(customerId: string | number, transactionId: string | number, cancelInvoice: boolean = false) {
    return this.request<any>("POST", `/customers/${customerId}/transactions/execute`, {
      transaction_id: String(transactionId),
      cancel_invoice: cancelInvoice ? "true" : "false",
    });
  }
  addCustomerFund(customerId: string | number, data: { amount: number | string; description: string }) {
    return this.request<any>("POST", `/customers/${customerId}/transactions/fund`, {
      amount: String(data.amount),
      description: data.description,
    });
  }
  addCustomerDebitNote(customerId: string | number, data: { amount: number | string; description: string; subtract_total_receipts?: number | string }) {
    const payload: Record<string, string> = {
      amount: String(data.amount),
      description: data.description,
    };
    if (data.subtract_total_receipts !== undefined) {
      payload.subtract_total_receipts = String(data.subtract_total_receipts);
    }
    return this.request<any>("POST", `/customers/${customerId}/transactions/debit_note`, payload);
  }
  retryCustomerTransaction(customerId: string | number, transactionId: string | number) {
    return this.request<any>("POST", `/customers/${customerId}/transactions/retry`, {
      transaction_id: String(transactionId),
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

  async getPrices(forceRefresh = true) {
    const cacheKey = `prices:${this.authHeader}`;
    if (!forceRefresh) {
      const cached = cacheStore.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.data;
      }
    }
    try {
      const data = await this.request<any>("GET", "/account/prices");
      cacheStore.set(cacheKey, { data, expiresAt: Date.now() + 5 * 60_000 }); // 5 mins cache
      return data;
    } catch (err) {
      const cached = cacheStore.get(cacheKey);
      if (cached) return cached.data;
      throw err;
    }
  }

  async getCustomerPrices(forceRefresh = true) {
    const cacheKey = `cust_prices:${this.authHeader}`;
    if (!forceRefresh) {
      const cached = cacheStore.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.data;
      }
    }
    try {
      const data = await this.request<any>("GET", "/customers/prices");
      cacheStore.set(cacheKey, { data, expiresAt: Date.now() + 5 * 60_000 }); // 5 mins cache
      return data;
    } catch (err) {
      const cached = cacheStore.get(cacheKey);
      if (cached) return cached.data;
      throw err;
    }
  }

  getTransactions(params?: Record<string, any>) {
    const cleanParams: Record<string, string> = {};
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== "") {
          cleanParams[k] = String(v);
        }
      }
    }
    const qs = Object.keys(cleanParams).length > 0 ? "?" + new URLSearchParams(cleanParams).toString() : "";
    return this.request<any>("GET", `/account/transactions${qs}`);
  }
  getTransaction(transactionId: string | number) {
    return this.request<any>("GET", `/account/transactions/${transactionId}`);
  }

  // --- Sub Reseller Transactions (luquid.md Section 2) ---
  getResellerBalance(resellerId: string | number) {
    return this.request<any>("GET", `/resellers/${resellerId}/balance`);
  }
  getResellerTransactions(resellerId: string | number, params?: Record<string, any>) {
    const cleanParams: Record<string, string> = {};
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== "") {
          cleanParams[k] = String(v);
        }
      }
    }
    const qs = Object.keys(cleanParams).length > 0 ? "?" + new URLSearchParams(cleanParams).toString() : "";
    return this.request<any>("GET", `/resellers/${resellerId}/transactions${qs}`);
  }
  getResellerTransaction(resellerId: string | number, transactionId: string | number) {
    return this.request<any>("GET", `/resellers/${resellerId}/transactions/${transactionId}`);
  }
  addResellerFund(resellerId: string | number, data: { amount: number | string; description: string }) {
    return this.request<any>("POST", `/resellers/${resellerId}/transactions/fund`, {
      amount: String(data.amount),
      description: data.description,
    });
  }
  addResellerDebitNote(resellerId: string | number, data: { amount: number | string; description: string; subtract_total_receipts?: number | string }) {
    const payload: Record<string, string> = {
      amount: String(data.amount),
      description: data.description,
    };
    if (data.subtract_total_receipts !== undefined) {
      payload.subtract_total_receipts = String(data.subtract_total_receipts);
    }
    return this.request<any>("POST", `/resellers/${resellerId}/transactions/debit_note`, payload);
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

  const sourceObj = raw.data || raw.prices || raw;
  if (!sourceObj || typeof sourceObj !== "object") return result;

  const entries = Array.isArray(sourceObj)
    ? sourceObj.map((item: any) => [item.tld_label || item.tld || item.name || item.extension || "", item])
    : Object.entries(sourceObj);

  const formatYearsMap = (yearsMap: Record<string, any> | undefined) => {
    if (!yearsMap || typeof yearsMap !== "object") return undefined;
    const res: Record<number, number> = {};
    for (const [yr, val] of Object.entries(yearsMap)) {
      if (val !== undefined && val !== null && val !== "") {
        const numVal = Number(val);
        if (!isNaN(numVal)) {
          res[Number(yr)] = numVal < 1000 ? Math.round(numVal * 1000) : Math.round(numVal);
        }
      }
    }
    return Object.keys(res).length > 0 ? res : undefined;
  };

  const parsePrice = (val: any) => {
    if (val === undefined || val === null || val === "") return null;
    const num = Number(val);
    if (isNaN(num)) return null;
    return num < 1000 ? Math.round(num * 1000) : Math.round(num);
  };

  for (const [key, item] of entries) {
    if (!item || typeof item !== "object") continue;
    const rawTld = String(item.tld_label || item.tld || item.name || item.extension || key || "").trim();
    if (!rawTld || rawTld === "rec_count" || rawTld === "status" || rawTld === "addons" || rawTld === "message") continue;

    const tld = rawTld.replace(/^\./, "").toLowerCase();

    const createPrice = parsePrice(item.create?.["1"] || item.create?.[1] || item.add?.["1"] || item.add?.[1] || item.register?.["1"] || item.register?.[1] || item.create_price || item.price_new || item.price);
    const renewPrice = parsePrice(item.renew?.["1"] || item.renew?.[1] || item.renew_price);
    const transferPrice = parsePrice(item.transfer?.["1"] || item.transfer?.[1] || item.transfer_price);
    const restorePrice = parsePrice(item.restore?.["1"] || item.restore?.[1] || item.restore_price);

    result[tld] = {
      tld,
      price_new: createPrice,
      price_register: createPrice,
      price_renew: renewPrice || createPrice,
      price_transfer: transferPrice || createPrice,
      price_restore: restorePrice,
      create_years: formatYearsMap(item.create || item.add || item.register),
      renew_years: formatYearsMap(item.renew),
      privacy_protect: parsePrice(item.privacy_protect) || 70000,
      currency: item.currency || "IDR",
    };
  }

  return result;
}
