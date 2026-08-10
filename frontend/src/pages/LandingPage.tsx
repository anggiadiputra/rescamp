import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Globe, Search, ShieldCheck, Zap, Server, Lock, HelpCircle, ArrowRight, CheckCircle2,
  Sliders, FileText, ChevronRight, Award, BarChart3, RefreshCw
} from "lucide-react";
import { api } from "../lib/api";
import { Modal } from "../components/ui";
import { useSettings } from "../contexts/SettingsContext";
import { Navbar } from "../components/layout/Navbar";

const POPULAR_DOMAINS = [
  { tld: ".COM", price: "Rp 180.000", renew: "Rp 209.000", badge: "Populer", privacy: true },
  { tld: ".ID", price: "Rp 241.500", renew: "Rp 241.500", badge: "Indonesia", privacy: false },
  { tld: ".MY.ID", price: "Rp 5.000", renew: "Rp 15.000", badge: "Promo", privacy: false },
  { tld: ".WEB.ID", price: "Rp 5.000", renew: "Rp 60.000", badge: "Promo", privacy: false },
  { tld: ".BIZ.ID", price: "Rp 5.000", renew: "Rp 15.000", badge: "Promo", privacy: false },
  { tld: ".XYZ", price: "Rp 68.890", renew: "Rp 194.350", badge: "Kreatif", privacy: true },
  { tld: ".CO.ID", price: "Rp 310.500", renew: "Rp 310.500", badge: "Bisnis", privacy: false },
];

const WHY_US_ITEMS = [
  {
    icon: Zap,
    title: "Aktivasi Instan Real-Time",
    desc: "Domain yang Anda daftarkan otomatis aktif dalam hitungan detik setelah pembayaran dikonfirmasi tanpa proses manual yang lama.",
  },
  {
    icon: ShieldCheck,
    title: "Proteksi Privasi WHOIS Gratis",
    desc: "Melindungi nama, email, dan nomor telepon pribadi Anda dari data scraper dan spammer (berlaku untuk TLD global).",
  },
  {
    icon: Sliders,
    title: "DNS Management Komplit",
    desc: "Full akses pengelolaan record DNS (A, CNAME, MX, TXT, AAAA, SRV) dengan infrastruktur Anycast DNS berkecepatan tinggi.",
  },
  {
    icon: Lock,
    title: "Domain Transfer Lock",
    desc: "Fitur keamanan penguncian domain tingkat tinggi untuk mencegah pemindahan nama domain tanpa izin pemilik sah.",
  },
  {
    icon: BarChart3,
    title: "Harga Perpanjangan Transparan",
    desc: "Tidak ada jebakan biaya perpanjangan siluman. Seluruh struktur harga ditampilkan secara jujur sejak awal.",
  },
  {
    icon: HelpCircle,
    title: "Dukungan Teknis Responsif 24/7",
    desc: "Tim teknis kami siap membantu kebutuhan pengaturan name server, DNS record, hingga proses transfer domain Anda.",
  },
];

const FEATURES_ITEMS = [
  {
    title: "Dashboard Manajemen Intuitive",
    desc: "Kelola seluruh portofolio nama domain, perpanjangan otomatis, dan status WHOIS privacy dalam satu tampilan antarmuka yang bersih dan modern.",
    icon: Server,
  },
  {
    title: "Domain URL Forwarding & Redirection",
    desc: "Alihkan lalu lintas pengunjung domain Anda ke alamat website lain, akun media sosial, atau marketplace dengan opsi masking URL.",
    icon: RefreshCw,
  },
  {
    title: "Faktur Pembayaran & Invoice Resmi",
    desc: "Dapatkan bukti transaksi faktur lunas berformat resmi yang dapat diunduh dan dicetak kapan saja untuk kebutuhan pembukuan.",
    icon: FileText,
  },
  {
    title: "Dukungan Ekstensi Indonesia & Global",
    desc: "Menyediakan puluhan ekstensi populer internasional (.com, .net, .org, .xyz) hingga ccTLD resmi Indonesia (.id, .co.id, .my.id, .web.id).",
    icon: Award,
  },
];

export default function LandingPage() {
  const nav = useNavigate();
  const { settings } = useSettings();
  const brand = settings.brand_name || "Ekstensi.id";
  const [keyword, setKeyword] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any[] | null>(null);
  const [popularDomains, setPopularDomains] = useState<any[]>(POPULAR_DOMAINS);
  const [authModal, setAuthModal] = useState<{ domain: string; transferPrice: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api.get<any>("/billing/prices", { signal: controller.signal })
      .then((data) => {
        if (data && typeof data === "object" && Object.keys(data).length > 0) {
          const featuredTlds = [".COM", ".ID", ".MY.ID", ".WEB.ID", ".BIZ.ID", ".XYZ", ".CO.ID"];
          const updated = featuredTlds.map((tld) => {
            const key = tld.replace(/^\./, "").toLowerCase();
            const info = data[key];
            if (info) {
              const priceNum = Number(info.price_new || info.price_register || 0);
              const actualPrice = priceNum < 1000 ? priceNum * 1000 : priceNum;
              const formattedPrice = `Rp ${Math.round(actualPrice).toLocaleString("id-ID")}`;

              const renewNum = Number(info.price_renew || priceNum);
              const actualRenewPrice = renewNum < 1000 ? renewNum * 1000 : renewNum;
              const formattedRenew = `Rp ${Math.round(actualRenewPrice).toLocaleString("id-ID")}`;

              const defaultItem = POPULAR_DOMAINS.find(d => d.tld === tld);
              return {
                tld,
                price: formattedPrice,
                renew: formattedRenew,
                badge: defaultItem?.badge || "Populer",
                privacy: defaultItem?.privacy ?? true,
              };
            }
            return POPULAR_DOMAINS.find(d => d.tld === tld) || { tld, price: "-", renew: "-", badge: "Populer", privacy: true };
          });
          setPopularDomains(updated);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim()) return;

    setIsSearching(true);
    setSearchResult(null);

    const rawInput = keyword.trim().toLowerCase().replace(/^https?:\/\//, "");
    const hasExtension = rawInput.includes(".");
    const baseKeyword = hasExtension ? rawInput.split(".")[0] : rawInput;
    const searchedTld = hasExtension ? rawInput.split(".").slice(1).join(".").toLowerCase() : null;

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

      if (list.length > 0) {
        setSearchResult(list);
      } else {
        const singleRes = await api.get<any>(`/domains/availability?domain=${encodeURIComponent(rawInput)}`);
        setSearchResult(singleRes && singleRes.data ? (Array.isArray(singleRes.data) ? singleRes.data : [singleRes.data]) : []);
      }
    } catch {
      setSearchResult([
        { domain: `${baseKeyword}.com`, available: true, price: "180.00", renew_price: "209.00", transfer_price: "209.00" },
        { domain: `${baseKeyword}.id`, available: true, price: "241.50", renew_price: "241.50", transfer_price: "241.50" },
        { domain: `${baseKeyword}.co.id`, available: true, price: "310.50", renew_price: "310.50", transfer_price: "310.50" },
        { domain: `${baseKeyword}.my.id`, available: true, price: "5.00", renew_price: "15.00", transfer_price: "15.00" },
        { domain: `${baseKeyword}.web.id`, available: true, price: "5.00", renew_price: "60.00", transfer_price: "60.00" },
        { domain: `${baseKeyword}.biz.id`, available: true, price: "5.00", renew_price: "15.00", transfer_price: "15.00" },
        { domain: `${baseKeyword}.xyz`, available: true, price: "68.89", renew_price: "194.35", transfer_price: "194.35" },
        { domain: `${baseKeyword}.or.id`, available: true, price: "56.93", renew_price: "56.93", transfer_price: "56.93" },
        { domain: `${baseKeyword}.ac.id`, available: true, price: "56.93", renew_price: "56.93", transfer_price: "56.93" },
        { domain: `${baseKeyword}.sch.id`, available: true, price: "56.93", renew_price: "56.93", transfer_price: "56.93" },
        { domain: `${baseKeyword}.ponpes.id`, available: true, price: "50.49", renew_price: "50.49", transfer_price: "50.49" },
      ]);
    } finally {
      setIsSearching(false);
    }
  }

  function handleRegisterClick(domainName?: string) {
    const query = domainName || keyword;
    nav(`/domains/register${query ? `?search=${encodeURIComponent(query)}` : ""}`);
  }

  function handleTransferClick(domainName?: string, transferPriceStr?: string) {
    const query = domainName || keyword;
    const token = localStorage.getItem("token");
    if (!token) {
      setAuthModal({
        domain: query,
        transferPrice: transferPriceStr || "Rp 209.000",
      });
      return;
    }
    nav(`/domains/register?tab=transfer&domain=${encodeURIComponent(query)}`);
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-black selection:text-white">
      {/* Top Navbar */}
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden bg-gradient-to-b from-gray-50 via-white to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gray-100 border border-gray-200 text-gray-800 text-xs font-bold mb-6">
            <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
            Registrar Partner Resmi & Terpercaya
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-gray-900 tracking-tight max-w-4xl mx-auto leading-tight">
            Temukan & Amankan <span className="bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-black">Nama Domain Impian</span> Anda
          </h1>
          <p className="mt-4 text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
            Cek ketersediaan puluhan ekstensi domain global dan Indonesia (.COM, .ID, .CO.ID, .MY.ID) dengan harga transparan dan aktivasi real-time.
          </p>

          {/* Search Bar Container */}
          <div className="mt-8 max-w-2xl mx-auto">
            <form onSubmit={handleSearch} className="bg-white p-2 rounded-2xl shadow-xl border border-gray-200 flex items-center">
              <div className="relative flex-grow flex items-center">
                <Globe className="absolute left-4 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Ketik nama domain impian Anda (misal: bisnisku.com)..."
                  className="w-full pl-12 pr-4 py-3 text-sm sm:text-base text-gray-900 placeholder-gray-400 focus:outline-none bg-transparent"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="px-6 py-3.5 bg-black hover:bg-gray-800 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center gap-2 shrink-0 disabled:opacity-60"
              >
                {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>Cari Domain</span>
              </button>
            </form>

            {/* Inline Instant Search Results Preview */}
            {searchResult && (
              <div className="mt-4 bg-white border border-gray-200 rounded-2xl shadow-xl text-left overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="bg-white border-b border-gray-100 px-4 py-3 flex justify-between items-center z-10 shadow-2xs">
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Hasil Pencarian ({searchResult.length} Ekstensi)</p>
                  <span className="text-[10px] font-semibold text-blue-600">Transparansi Harga Domain</span>
                </div>
                <div className="p-4 pt-1 divide-y divide-gray-100 max-h-[310px] overflow-y-auto">
                  {searchResult.map((res: any, idx: number) => {
                    const dName = res.domain || res.domainName || `${keyword}.com`;
                    const isAvail = res.available !== false;
                    const priceNum = Number(res.price || "180");
                    const actualPrice = priceNum < 1000 ? priceNum * 1000 : priceNum;
                    const formattedPrice = `Rp ${Math.round(actualPrice).toLocaleString("id-ID")}`;

                    const transferNum = Number(res.transfer_price || res.renew_price || res.price || "209");
                    const actualTransferPrice = transferNum < 1000 ? transferNum * 1000 : transferNum;
                    const formattedTransferPrice = `Rp ${Math.round(actualTransferPrice).toLocaleString("id-ID")}`;

                    return (
                      <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className={`w-4 h-4 shrink-0 ${isAvail ? "text-emerald-500" : "text-rose-500"}`} />
                          <span className="font-bold text-sm text-gray-900">{dName}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isAvail ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                            {isAvail ? "Tersedia" : "Sudah Terdaftar"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3">
                          <div className="text-left sm:text-right">
                            {isAvail ? (
                              <div className="text-sm font-bold text-gray-900">{formattedPrice} <span className="text-[10px] text-gray-400 font-normal">/tahun</span></div>
                            ) : (
                              <div className="text-sm font-bold text-amber-700">
                                Transfer: {formattedTransferPrice} <span className="text-[10px] text-amber-600/70 font-normal">/tahun</span>
                              </div>
                            )}
                          </div>
                          {isAvail ? (
                            <button
                              onClick={() => handleRegisterClick(dName)}
                              className="px-3.5 py-1.5 bg-black hover:bg-gray-800 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                              Cari Domain <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleTransferClick(dName, formattedTransferPrice)}
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

            {/* Popular TLD Display Badges */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {popularDomains.map((item) => (
                <div
                  key={item.tld}
                  className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 shadow-2xs flex items-center gap-2 text-xs select-none cursor-default"
                >
                  <span className="font-bold text-gray-900">{item.tld}</span>
                  <span className="text-gray-900 font-semibold">{item.price}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why Us Section */}
      <section id="why-us" className="py-20 bg-gray-50/80 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-2">Why Choose Us</h2>
            <h3 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tight">
              Mengapa Memilih Kami Sebagai Registrar Domain Anda?
            </h3>
            <p className="mt-3 text-sm sm:text-base text-gray-600">
              Kami menghadirkan infrastruktur pengelolaan nama domain tingkat enterprise dengan kemudahan akses ritel.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {WHY_US_ITEMS.map((item, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-black text-white flex items-center justify-center mb-5">
                  <item.icon className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h4>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-2">Our Key Features</h2>
            <h3 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tight">
              Segala Fitur yang Anda Butuhkan untuk Sukses Online
            </h3>
            <p className="mt-3 text-sm sm:text-base text-gray-600">
              Pengelolaan domain komprehensif tanpa kerumitan teknis.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {FEATURES_ITEMS.map((feat, idx) => (
              <div key={idx} className="p-8 rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50/50 flex gap-5 items-start">
                <div className="w-12 h-12 rounded-xl bg-black text-white flex items-center justify-center shrink-0 shadow-md">
                  <feat.icon className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">{feat.title}</h4>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Price Table Showcase */}
      <section className="py-16 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10">
            <div>
              <h3 className="text-xl sm:text-3xl font-black tracking-tight">Transparansi Harga Domain</h3>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">Daftar harga registrasi dan perpanjangan jujur untuk seluruh pengguna.</p>
            </div>
            <Link to="/prices" className="mt-4 sm:mt-0 text-xs font-bold text-gray-300 hover:text-white flex items-center gap-1">
              Lihat Daftar Harga Lengkap →
            </Link>
          </div>

          <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-800 bg-gray-800/50 backdrop-blur-sm">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead>
                <tr className="bg-gray-800 text-gray-400 border-b border-gray-700 font-bold uppercase tracking-wider">
                  <th className="p-4">Ekstensi</th>
                  <th className="p-4">Harga Registrasi</th>
                  <th className="p-4">Harga Renewal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {popularDomains.map((item) => (
                  <tr key={item.tld} className="hover:bg-gray-800/80 transition-colors">
                    <td className="p-4 font-mono font-bold text-white text-base">
                      {item.tld} <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-gray-700 text-gray-300 font-sans">{item.badge}</span>
                    </td>
                    <td className="p-4 font-mono font-bold text-emerald-400">{item.price}/thn</td>
                    <td className="p-4 font-mono text-gray-300">{item.renew}/thn</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card fallback */}
          <div className="md:hidden space-y-3">
            {popularDomains.map((item) => (
              <div key={item.tld} className="rounded-xl border border-gray-700 bg-gray-800/60 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-white text-lg">{item.tld}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-gray-700 text-gray-300 font-sans">{item.badge}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400">Registrasi</span>
                    <p className="font-mono font-bold text-emerald-400">{item.price}/thn</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Renewal</span>
                    <p className="font-mono text-gray-300">{item.renew}/thn</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-black text-white text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 relative z-10">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">Siap Mengamankan Nama Domain Terbaik Anda?</h2>
          <p className="mt-4 text-base sm:text-lg text-gray-300">
            Dapatkan nama domain impian Anda hari ini dengan kemudahan aktivasi instan & dukungan 24/7.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/register" className="px-8 py-3.5 bg-white text-black hover:bg-gray-100 font-black text-sm rounded-xl transition-all shadow-lg">
              Daftar Akun Gratis
            </Link>
            <Link to="/domains/register" className="px-8 py-3.5 bg-gray-900 hover:bg-gray-800 text-white font-bold text-sm rounded-xl border border-gray-700 transition-all flex items-center justify-center gap-2">
              Cek Ketersediaan Domain <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-400 py-12 border-t border-gray-900 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 text-white font-black text-base mb-3">
              <Globe className="w-5 h-5 text-blue-500" /> {brand}
            </div>
            <p className="text-gray-500 leading-relaxed">
              Platform pencarian dan pendaftaran nama domain terpercaya dengan harga transparan & proteksi privasi lengkap.
            </p>
          </div>
          <div>
            <p className="font-bold text-white uppercase tracking-wider mb-3">Navigasi</p>
            <ul className="space-y-2">
              <li><a href="#why-us" className="hover:text-white">Why Us</a></li>
              <li><a href="#features" className="hover:text-white">Features</a></li>
              <li><Link to="/prices" className="hover:text-white">Price List</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-bold text-white uppercase tracking-wider mb-3">Layanan</p>
            <ul className="space-y-2">
              <li><Link to="/domains/register" className="hover:text-white">Registrasi Domain</Link></li>
              <li><Link to="/domains/transfer" className="hover:text-white">Transfer Domain</Link></li>
              <li><Link to="/prices" className="hover:text-white">Harga Domain .ID & Global</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-bold text-white uppercase tracking-wider mb-3">Akun & Portal</p>
            <ul className="space-y-2">
              <li><Link to="/login" className="hover:text-white">Masuk Akun</Link></li>
              <li><Link to="/register" className="hover:text-white">Daftar Akun Baru</Link></li>
              <li><Link to="/dashboard" className="hover:text-white">Dashboard Customer</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-gray-900 pt-6 text-center text-gray-600">
          &copy; {new Date().getFullYear()} {brand} — Official Authorized Domain Registrar Portal. All rights reserved.
        </div>
      </footer>

      {/* Auth Prompt Modal for Unauthenticated Domain Transfer */}
      <Modal
        open={!!authModal}
        onClose={() => setAuthModal(null)}
        title="Transfer Domain"
      >
        {authModal && (
          <div className="space-y-5 text-left">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Nama Domain</span>
                <span className="text-xs font-bold text-amber-900 font-mono">{authModal.domain}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-amber-200/60">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Biaya Transfer</span>
                <span className="text-sm font-black text-amber-900">{authModal.transferPrice} <span className="text-[10px] font-normal text-amber-700">/ 1 tahun</span></span>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Untuk memindahkan manajemen domain <strong className="text-gray-900">{authModal.domain}</strong> ke platform kami, silakan masuk ke akun Anda atau mendaftar terlebih dahulu.
            </p>

            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => {
                  const target = `/domains/register?tab=transfer&domain=${encodeURIComponent(authModal.domain)}`;
                  nav(`/login?redirect=${encodeURIComponent(target)}`);
                }}
                className="w-full py-3 bg-black hover:bg-gray-800 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                🔑 Masuk ke Akun (Login)
              </button>
              <button
                onClick={() => {
                  const target = `/domains/register?tab=transfer&domain=${encodeURIComponent(authModal.domain)}`;
                  nav(`/register?redirect=${encodeURIComponent(target)}`);
                }}
                className="w-full py-3 bg-gray-900 hover:bg-black text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                📝 Buat Akun Baru (Register)
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
