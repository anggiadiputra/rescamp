import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Globe, Search, Shield, ArrowRight, Check, Sparkles, RefreshCw, CheckCircle2 } from "lucide-react";
import { Card, Button, InfoBanner, LoadingSpinner, toast, PaymentModal } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { api } from "../lib/api";
import type { Customer } from "../lib/types";

function fmtPrice(amount: any): string {
  if (!amount) return "";
  const num = Number(amount);
  if (isNaN(num)) return "";
  const actual = num < 1000 ? num * 1000 : num;
  return `Rp ${Math.round(actual).toLocaleString("id-ID")}`;
}

export default function DomainRegisterPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const isCustomer = user?.role === "customer";
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "transfer" ? "transfer" : "register";
  const [activeTab, setActiveTab] = useState<"register" | "transfer">(initialTab);

  const [search, setSearch] = useState(searchParams.get("search") || searchParams.get("domain") || "");
  const [error, setError] = useState("");
  const [bulkResults, setBulkResults] = useState<any[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Selected domain state for registration form
  const [selectedDomain, setSelectedDomain] = useState<any>(null);

  // Payment modal state
  const [paymentData, setPaymentData] = useState<{
    open: boolean;
    orderId: string;
    paymentLinkUrl: string;
    amount: number;
    fee: number;
    expiresAt?: string;
    domainName: string;
  }>({ open: false, orderId: "", paymentLinkUrl: "", amount: 0, fee: 0, expiresAt: "", domainName: "" });

  // Register form state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [years, setYears] = useState(1);
  const [ns1, setNs1] = useState("");
  const [ns2, setNs2] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [autoRenew, setAutoRenew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Transfer form state
  const [transferDomain, setTransferDomain] = useState(searchParams.get("search") || searchParams.get("domain") || "");
  const [authCode, setAuthCode] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [priceList, setPriceList] = useState<Record<string, any>>({});

  useEffect(() => {
    api.get<any>("/billing/prices").then((data) => setPriceList(data || {})).catch(() => {});
  }, []);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "transfer") {
      setActiveTab("transfer");
    } else if (tab === "register") {
      setActiveTab("register");
    }
    const searchVal = searchParams.get("search") || searchParams.get("domain");
    if (searchVal) {
      setSearch(searchVal);
      setTransferDomain(searchVal);
    }
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    api.get<any>("/customers", { signal: controller.signal }).then((res) => {
      const list = res?.data || res || [];
      const custArr = Array.isArray(list) ? list : [];
      setCustomers(custArr);
      if (custArr.length > 0) {
        setCustomerId((prev) => prev || String(custArr[0].id));
      }
    }).catch(() => {});
    return () => controller.abort();
  }, []);

  async function check(query?: string) {
    const targetSearch = (query !== undefined ? query : search).trim();
    if (!targetSearch) { setError("Enter a domain name to search"); return; }
    if (bulkLoading) return;

    setError("");
    setSelectedDomain(null);
    setBulkResults([]);

    // Extract keyword and optional searched TLD
    const hasExtension = targetSearch.includes(".");
    const baseKeyword = hasExtension ? targetSearch.split(".")[0] : targetSearch;
    const searchedTld = hasExtension ? targetSearch.split(".").slice(1).join(".").toLowerCase() : null;

    if (!baseKeyword) { setError("Enter a valid domain name"); return; }

    // Always do bulk availability to show all TLD alternatives
    setBulkLoading(true);
    try {
      const res = await api.get<any>(`/domains/bulk-availability?keyword=${encodeURIComponent(baseKeyword)}`);
      let list = Array.isArray(res) ? res : res?.data || [];

      // If user searched with a specific extension, put that TLD first
      if (searchedTld && list.length > 0) {
        const matchIdx = list.findIndex((item: any) => {
          const itemTld = (item.tld || item.domain?.split(".")?.slice(1)?.join(".") || "").toLowerCase();
          return itemTld === searchedTld;
        });
        if (matchIdx > 0) {
          const [matched] = list.splice(matchIdx, 1);
          list = [matched, ...list];
        }
      }

      setBulkResults(list);

      // Auto-select if the searched domain is available
      if (searchedTld && list.length > 0) {
        const first = list[0];
        const firstTld = (first.tld || first.domain?.split(".")?.slice(1)?.join(".") || "").toLowerCase();
        if (firstTld === searchedTld && first.available) {
          setSelectedDomain(first);
        }
      }
    } catch (err: any) { setError(err.message); }
    setBulkLoading(false);
  }

  function handleSelectBulkDomain(item: any) {
    if (!item.available) return;
    setSearch(item.domain);
    setSelectedDomain(item);
    const itemTld = item?.tld?.toLowerCase() || item.domain.split(".").slice(1).join(".").toLowerCase();
    if (itemTld === "id" || itemTld.endsWith(".id")) {
      setPrivacy(false);
    }
    // Smooth scroll to configuration section
    setTimeout(() => {
      document.getElementById("registration-config-section")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  async function submit() {
    if (submitting) return;
    if (!customerId && user?.role !== "customer") { setError("Please select a customer contact"); return; }
    const effectiveCustomerId = (customerId && customerId !== "__self__") ? Number(customerId) : undefined;
    const domainToRegister = selectedDomain?.domain || search;
    if (!domainToRegister.includes(".")) { setError("Invalid domain name"); return; }

    setSubmitting(true);
    setError("");
    try {
      const [name, ...tldParts] = domainToRegister.split(".");
      const tld = tldParts.join(".");
      const ns = [ns1, ns2].filter(Boolean);

      const res: any = await api.post("/domains", {
        domain_name: name,
        tld,
        years,
        customer_id: effectiveCustomerId,
        nameservers: ns.length >= 2 ? ns : undefined,
        privacy_protection: isIdDomain ? false : privacy,
        auto_renew: autoRenew,
      });

      const paymentInfo = res?.data || res;
      const orderId = paymentInfo?.orderId || paymentInfo?.order_id;

      // Reseller assigning to customer: no redirect, invoice goes to customer
      const isAssigning = user?.role !== "customer" && customerId && customerId !== "__self__";
      if (orderId && !isAssigning) {
        nav(`/billing/pay/${orderId}`);
        return;
      } else if (isAssigning) {
        // Reseller assigned domain to customer — invoice sent to customer
        toast(`🎉 Order domain ${domainToRegister} berhasil dibuat! Invoice dikirim ke customer.`);
        nav("/domains");
      } else {
        toast(`🎉 ${domainToRegister} registered successfully!`);
        nav("/domains");
      }
    } catch (err: any) { setError(err.message); }
    setSubmitting(false);
  }

  async function submitTransfer() {
    if (transferSubmitting) return;
    if (!transferDomain.includes(".")) { setError("Sila masukkan nama domain lengkap (misal: bisnisku.com)"); return; }
    if (!customerId && user?.role !== "customer") { setError("Sila pilih kontak pemilik domain"); return; }
    const effectiveCustomerId = (customerId && customerId !== "__self__") ? Number(customerId) : undefined;

    setTransferSubmitting(true);
    setError("");
    try {
      const res: any = await api.post("/domains/transfer", {
        domain_name: transferDomain.trim(),
        auth_code: authCode.trim() || undefined,
        customer_id: effectiveCustomerId,
      });

      const paymentInfo = res?.data || res;
      const orderId = paymentInfo?.orderId || paymentInfo?.order_id;

      const isAssigning = user?.role !== "customer" && customerId && customerId !== "__self__";
      if (orderId && !isAssigning) {
        nav(`/billing/pay/${orderId}`);
        return;
      } else if (isAssigning) {
        toast(`🎉 Transfer domain ${transferDomain} berhasil diajukan untuk customer! Invoice dikirim ke customer.`);
        nav("/domains");
      } else {
        toast(`🎉 Permintaan transfer domain ${transferDomain} berhasil diajukan!`);
        nav("/domains");
      }
    } catch (err: any) { setError(err.message); }
    setTransferSubmitting(false);
  }

  const selectedTld = selectedDomain?.tld?.toLowerCase() || (selectedDomain?.domain ? selectedDomain.domain.split(".").slice(1).join(".").toLowerCase() : "");
  const isIdDomain = selectedTld === "id" || selectedTld.endsWith(".id");
  const activePrivacy = isIdDomain ? false : privacy;

  // Price calculations
  const unitPriceNum = Number(selectedDomain?.price || "180");
  const actualUnitPrice = unitPriceNum < 1000 ? unitPriceNum * 1000 : unitPriceNum;
  const domainRegistrationTotal = selectedDomain?.create_years?.[years] ? Number(selectedDomain.create_years[years]) : (actualUnitPrice * years);

  const rawPrivacyPrice = Number(selectedDomain?.privacy_protect || selectedDomain?.privacy_price || "70");
  const actualPrivacyUnitPrice = rawPrivacyPrice < 1000 ? rawPrivacyPrice * 1000 : rawPrivacyPrice;
  const privacyTotalPrice = activePrivacy ? (actualPrivacyUnitPrice * years) : 0;

  const totalPrice = domainRegistrationTotal + privacyTotalPrice;

  const transferTld = transferDomain.includes(".") ? transferDomain.trim().split(".").slice(1).join(".").toLowerCase() : "";
  const transferPriceInfo = priceList[transferTld];
  const rawTransferPrice = transferPriceInfo?.price_transfer || transferPriceInfo?.price_renew;
  const actualTransferPriceVal = rawTransferPrice ? (Number(rawTransferPrice) < 1000 ? Number(rawTransferPrice) * 1000 : Number(rawTransferPrice)) : 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Globe className="w-5 h-5 text-gray-700" />
            Pusat Domain
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Daftarkan domain baru atau pindahkan domain Anda dari registrar lain.</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="bg-gray-100 p-1 border border-gray-200 rounded-xl shadow-2xs flex items-center gap-1 max-w-md mx-auto">
        <button
          type="button"
          onClick={() => { setActiveTab("register"); setSearchParams({ tab: "register" }); }}
          style={activeTab === "register" ? { backgroundColor: settings.primary_color || "#000000", color: "#ffffff" } : undefined}
          className={`flex-1 py-2.5 px-4 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === "register"
              ? "shadow-xs text-white"
              : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Cari Domain</span>
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("transfer"); setSearchParams({ tab: "transfer" }); }}
          style={activeTab === "transfer" ? { backgroundColor: settings.primary_color || "#000000", color: "#ffffff" } : undefined}
          className={`flex-1 py-2.5 px-4 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === "transfer"
              ? "shadow-xs text-white"
              : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          <span>Transfer Domain</span>
        </button>
      </div>

      {activeTab === "register" ? (
        <>
          {/* Clean White Search Box */}
      <Card className="p-5 bg-white border border-gray-200 shadow-sm rounded-xl">
        <div className="space-y-3">
          <label className="text-xs font-semibold text-gray-700 block">Domain Name or Keyword</label>
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <div className="relative flex-grow">
              <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && check()}
                className="w-full pl-10 h-11 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black font-mono shadow-xs"
                placeholder="e.g. sepertibiasa or sepertibiasa.com"
              />
            </div>
            <button
              type="button"
              onClick={() => check()}
              disabled={bulkLoading}
              style={{ backgroundColor: settings.primary_color || "#000000" }}
              className="h-11 px-5 hover:opacity-90 active:scale-98 text-white font-bold text-sm rounded-xl transition-all shadow-xs disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shrink-0"
            >
              {bulkLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>Cari</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3">
            <InfoBanner type="error" message={error} />
          </div>
        )}
      </Card>

      {/* Search Results List View (Synchronized with Landing Page) */}
      {bulkResults.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xl text-left overflow-hidden">
          <div className="bg-white border-b border-gray-100 px-4 py-3 flex justify-between items-center z-10 shadow-2xs">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Hasil Pencarian ({bulkResults.length} Ekstensi)</p>
            <span className="text-[10px] font-semibold text-blue-600">Transparansi Harga Domain</span>
          </div>
          <div className="p-4 pt-1 divide-y divide-gray-100 max-h-[310px] overflow-y-auto">
            {bulkResults.map((r: any, i: number) => {
              const isSelected = selectedDomain?.domain === r.domain;
              const isAvail = r.available !== false;

              return (
                <div key={i} className={`py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                  r.available && isSelected ? "bg-emerald-50/60 px-2 rounded-lg" : ""
                }`}>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`w-4 h-4 shrink-0 ${isAvail ? "text-emerald-500" : "text-rose-500"}`} />
                    <span className="font-bold text-sm text-gray-900">{r.domain}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isAvail ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      {isAvail ? "Tersedia" : "Sudah Terdaftar"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <div className="text-left sm:text-right">
                      {isAvail ? (
                        <div className="text-sm font-bold text-gray-900">{fmtPrice(r.price)} <span className="text-[10px] text-gray-400 font-normal">/tahun</span></div>
                      ) : (
                        <div className="text-sm font-bold text-amber-700">
                          Transfer: {fmtPrice(r.transfer_price || r.renew_price || r.price)} <span className="text-[10px] text-amber-600/70 font-normal">/tahun</span>
                        </div>
                      )}
                    </div>
                    {isAvail ? (
                      <button
                        onClick={() => handleSelectBulkDomain(r)}
                        style={!isSelected ? { backgroundColor: settings.primary_color || "#000000" } : undefined}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer ${
                          isSelected
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "hover:opacity-90 text-white"
                        }`}
                      >
                        {isSelected ? <Check className="w-3.5 h-3.5" /> : null}
                        {isSelected ? "Terpilih" : "Daftar"}
                      </button>
                    ) : (
                      <button
                        onClick={() => nav(`/domains/transfer?domain=${encodeURIComponent(r.domain)}`)}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        Transfer <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Domain Registration Configuration Form */}
      {selectedDomain && (
        <div id="registration-config-section" className="space-y-6 pt-2">
          <Card className="p-6 border border-gray-200 bg-white shadow-sm rounded-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wider" style={{ backgroundColor: settings.primary_color || "#000000" }}>
                    Selected Domain
                  </span>
                  <span className="text-xs font-bold text-emerald-600">✓ Ready to Register</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mt-1">{selectedDomain.domain}</h2>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-gray-900">{fmtPrice(domainRegistrationTotal)}</p>
                <p className="text-xs text-gray-500">Per {years} Year{years > 1 ? "s" : ""} Registration</p>
              </div>
            </div>

            <div className="space-y-5 pt-4">
              {/* Step 1: Customer Contact */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-700">1. Customer Contact *</label>
                  {!isCustomer && (
                    <Link to="/customers" className="text-xs text-gray-900 font-semibold hover:underline">
                      + Add New Contact
                    </Link>
                  )}
                </div>

                {isCustomer ? (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-gray-500">Pemilik Domain: </span>
                      <span className="font-bold text-gray-900">{user?.name} ({user?.email})</span>
                    </div>
                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Terverifikasi</span>
                  </div>
                ) : customers.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    No customer contacts found. You must create a contact first.{" "}
                    <Link to="/customers" className="font-bold underline">Create Contact Now →</Link>
                  </div>
                ) : (
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-medium shadow-xs"
                  >
                    <option value="">Select customer contact...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.email}) · {c.country}</option>
                    ))}
                    <option disabled>──────────────</option>
                    <option value="__self__">— Daftar untuk saya sendiri —</option>
                  </select>
                )}
              </div>

              {/* Step 2: Registration Period Dropdown */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-700 block mb-1.5">2. Registration Period</label>
                <select
                  value={years}
                  onChange={(e) => setYears(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-medium shadow-xs font-mono"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((y) => {
                    const yPrice = selectedDomain?.create_years?.[y] ? Number(selectedDomain.create_years[y]) : (actualUnitPrice * y);
                    return (
                      <option key={y} value={y}>
                        {y} Year{y > 1 ? "s" : ""} - {fmtPrice(yPrice)}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Step 3: Add-ons & Settings */}
              <div className="space-y-2.5 pt-1">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-700 block">3. Protection & Renewals</label>

                {!isIdDomain && (
                  <div className={`p-3.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${privacy ? "border-black bg-gray-50/80 shadow-xs" : "border-gray-200 bg-white hover:border-gray-300"}`}
                    onClick={() => setPrivacy(!privacy)}>
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded text-white" style={privacy ? { backgroundColor: settings.primary_color || "#000000" } : { backgroundColor: "#f3f4f6", color: "#111827" }}>
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-gray-900">WHOIS Privacy Guard Protection</p>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                            OPSIONAL / ADD-ON
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500">Sembunyikan informasi kontak pemilik domain dari direktori WHOIS publik</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-900 font-mono">+ {fmtPrice(actualPrivacyUnitPrice)} / thn</span>
                      <input
                        type="checkbox"
                        checked={privacy}
                        onChange={(e) => setPrivacy(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                <div className="p-3.5 rounded-lg border border-gray-200 bg-white flex items-center justify-between cursor-pointer hover:border-gray-300 transition-colors"
                  onClick={() => setAutoRenew(!autoRenew)}>
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded bg-gray-100 text-gray-600">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Automatic Domain Renewal</p>
                      <p className="text-[11px] text-gray-500">Auto-renew domain upon expiration to prevent service interruption</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoRenew}
                    onChange={(e) => setAutoRenew(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                  />
                </div>
              </div>

              {/* Step 4: Custom Nameservers */}
              <div className="pt-1">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-700 block mb-1">4. Custom Nameservers (Optional)</label>
                <p className="text-[11px] text-gray-500 mb-2">Leave blank to use default registrar nameservers.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    value={ns1}
                    onChange={(e) => setNs1(e.target.value)}
                    placeholder="ns1.example.com"
                    className="px-3.5 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-black bg-white"
                  />
                  <input
                    value={ns2}
                    onChange={(e) => setNs2(e.target.value)}
                    placeholder="ns2.example.com"
                    className="px-3.5 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-black bg-white"
                  />
                </div>
              </div>

              {/* Step 5: Order Summary Box */}
              <div className="p-4 bg-gray-900 text-white rounded-xl space-y-2.5 mt-4">
                <div className="flex justify-between items-center text-xs text-gray-300">
                  <span>Domain Registration ({selectedDomain.domain} &times; {years} yr)</span>
                  <span className="font-mono font-semibold">{fmtPrice(domainRegistrationTotal)}</span>
                </div>
                {!isIdDomain && (
                  <div className="flex justify-between items-center text-xs text-gray-300">
                    <span>WHOIS Privacy Protection ({activePrivacy ? `${years} yr` : "Add-on"})</span>
                    <span className={`font-mono font-semibold ${activePrivacy ? "text-amber-400" : "text-gray-400"}`}>
                      {activePrivacy ? `+ ${fmtPrice(privacyTotalPrice)}` : "Tidak dipilih (Rp 0)"}
                    </span>
                  </div>
                )}
                <div className="pt-2.5 border-t border-gray-800 flex justify-between items-center">
                  <span className="text-sm font-bold text-white">Estimated Total</span>
                  <span className="text-lg font-bold text-amber-400 font-mono">{fmtPrice(totalPrice)}</span>
                </div>
              </div>

              {/* Submit CTA Button */}
              <Button
                onClick={submit}
                disabled={submitting || (!isCustomer && customers.length === 0)}
                className="w-full py-3.5 text-sm font-bold bg-black hover:bg-gray-800 text-white rounded-lg transition-all active:scale-98 flex items-center justify-center gap-2 shadow-xs"
              >
                {submitting ? (
                  <>
                    <LoadingSpinner size="sm" /> Memproses...
                  </>
                ) : (
                  <>
                    Bayar <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
        </>
      ) : (
        /* Transfer Domain View */
        <Card className="p-6 bg-white border border-gray-200 shadow-sm rounded-xl space-y-5 max-w-2xl mx-auto">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Transfer Domain ke Akun Anda</h2>
            <p className="text-xs text-gray-500 mt-0.5">Pindahkan domain yang sudah terdaftar di registrar lama ke akun Anda.</p>
          </div>

          {error && <InfoBanner type="error" message={error} />}

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-700 block mb-1.5">1. Nama Domain Lengkap *</label>
              <input
                type="text"
                value={transferDomain}
                onChange={(e) => setTransferDomain(e.target.value)}
                placeholder="misal: bisnisku.com atau websiteku.id"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black font-medium shadow-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-700 block mb-1.5">2. Auth / EPP Code *</label>
              <input
                type="text"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                placeholder="Kode otorisasi EPP dari registrar lama (misal: EPP-XXXXXX)"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black font-medium shadow-xs"
              />
              <p className="text-[11px] text-gray-400 mt-1">Dapatkan kode otorisasi EPP/Auth dari panel registrar domain Anda saat ini.</p>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-700 block mb-1.5">3. Kontak Pemilik Domain *</label>
              {isCustomer ? (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-gray-500">Pemilik Domain: </span>
                    <span className="font-bold text-gray-900">{user?.name} ({user?.email})</span>
                  </div>
                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Terverifikasi</span>
                </div>
              ) : customers.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  Belum ada kontak customer. Sila buat kontak terlebih dahulu.{" "}
                  <Link to="/customers" className="font-bold underline">Buat Kontak →</Link>
                </div>
              ) : (
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-medium shadow-xs"
                >
                  <option value="">Pilih kontak pemilik domain...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.email}) · {c.country}</option>
                  ))}
                  <option disabled>──────────────</option>
                  <option value="__self__">— Daftar untuk saya sendiri —</option>
                </select>
              )}
            </div>

            {transferTld && actualTransferPriceVal > 0 && (
              <div className="p-4 bg-gray-900 text-white rounded-xl space-y-2.5">
                <div className="flex justify-between items-center text-xs text-gray-300">
                  <span>Biaya Transfer Domain (.{transferTld.toUpperCase()} +1 Thn Masa Aktif)</span>
                  <span className="font-mono font-bold text-amber-400">{fmtPrice(actualTransferPriceVal)}</span>
                </div>
                <div className="pt-2 border-t border-gray-800 text-[11px] text-gray-400 space-y-1">
                  <p>ℹ️ Transfer domain otomatis memperpanjang masa aktif domain Anda 1 tahun dari tanggal expired saat ini.</p>
                  {(transferTld === "biz.id" || transferTld === "my.id" || transferTld === "web.id") && (
                    <p className="text-amber-300 font-medium">
                      * Catatan: Harga promo pendaftaran Rp 5.000 hanya berlaku untuk registrasi domain baru. Biaya transfer/perpanjangan berlaku tarif normal registry PANDI ({fmtPrice(actualTransferPriceVal)}).
                    </p>
                  )}
                </div>
              </div>
            )}

            <Button
              onClick={submitTransfer}
              disabled={transferSubmitting || (!isCustomer && customers.length === 0)}
              className="w-full py-3.5 text-sm font-bold bg-black hover:bg-gray-800 text-white rounded-lg transition-all active:scale-98 flex items-center justify-center gap-2 shadow-xs mt-2"
            >
              {transferSubmitting ? (
                <>
                  <LoadingSpinner size="sm" /> Memproses...
                </>
              ) : (
                <>
                  Transfer <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Payment Gateway Modal */}
      <PaymentModal
        open={paymentData.open}
        onClose={() => setPaymentData({ ...paymentData, open: false })}
        orderId={paymentData.orderId}
        paymentLinkUrl={paymentData.paymentLinkUrl}
        amount={paymentData.amount}
        fee={paymentData.fee}
        expiresAt={paymentData.expiresAt}
        currency="IDR"
        domainName={paymentData.domainName}
        onSuccess={() => nav("/domains")}
      />
    </div>
  );
}
