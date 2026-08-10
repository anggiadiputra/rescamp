import { useState, useEffect } from "react";
import { Card, LoadingSpinner, Pagination, Button, SearchBar, toast } from "../components/ui";
import { RefreshCw, Tag } from "lucide-react";
import { api } from "../lib/api";

function fmtPrice(amount: any, currency: string = "IDR"): string {
  if (!amount) return "-";
  const num = Number(amount);
  if (isNaN(num)) return "-";
  const actual = num < 1000 ? num * 1000 : num;
  return `${currency} ${Math.round(actual).toLocaleString("id-ID")}`;
}

export default function PricesPage() {
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;

  const fetchPrices = (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);

    const url = force ? "/billing/prices?refresh=true" : "/billing/prices";
    api.get<any>(url)
      .then((data) => {
        setPrices(data || {});
        if (force) toast("Harga domain berhasil diperbarui secara live dari Resellercamp", "success");
      })
      .catch((err) => {
        console.error(err);
        toast("Gagal memuat daftar harga", "error");
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    fetchPrices(false);
  }, []);

  if (loading) return <LoadingSpinner />;

  const allEntries = Object.entries(prices)
    .filter(([k]) => k !== "addons")
    .filter(([tld]) => !search || tld.toLowerCase().includes(search.toLowerCase().replace(/^\./, "")));

  const total = allEntries.length;
  const startIndex = (page - 1) * perPage;
  const visibleEntries = allEntries.slice(startIndex, startIndex + perPage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Tag className="w-6 h-6 text-gray-800" />
            Daftar Harga Domain
          </h1>
          <p className="text-sm text-gray-500 mt-1">Daftar harga resmi registrasi, perpanjangan, dan transfer domain.</p>
        </div>
        <Button variant="outline" onClick={() => fetchPrices(true)} disabled={refreshing || loading} className="shadow-2xs text-xs sm:text-sm !py-2.5 shrink-0">
          <RefreshCw className={`w-4 h-4 inline mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Memperbarui..." : "Refresh Harga Live"}
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-4 flex flex-col sm:flex-row items-center gap-3">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Cari TLD domain (contoh: com, id, co.id)..." />
      </div>

      <Card className="p-0 overflow-hidden bg-white border border-gray-200 rounded-xl shadow-xs">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3.5 whitespace-nowrap">TLD</th>
                <th className="text-right px-4 py-3.5 whitespace-nowrap">Register</th>
                <th className="text-right px-4 py-3.5 whitespace-nowrap">Renew</th>
                <th className="text-right px-4 py-3.5 whitespace-nowrap">Transfer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white text-sm">
              {visibleEntries.map(([tld, info]: [string, any]) => (
                <tr key={tld} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-4 py-3.5 text-sm font-bold text-gray-900 whitespace-nowrap">.{tld}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-700 font-medium text-right whitespace-nowrap">{fmtPrice(info.price_new || info.price_register, info.currency)}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-700 font-medium text-right whitespace-nowrap">{fmtPrice(info.price_renew, info.currency)}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-700 font-medium text-right whitespace-nowrap">{fmtPrice(info.price_transfer, info.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile card fallback */}
        <div className="md:hidden divide-y divide-gray-100">
          {visibleEntries.map(([tld, info]: [string, any]) => (
            <div key={tld} className="px-4 py-3.5 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">.{tld}</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-500">Reg: <span className="font-semibold text-gray-800">{fmtPrice(info.price_new || info.price_register, info.currency)}</span></span>
                <span className="text-gray-500">Renew: <span className="font-semibold text-gray-800">{fmtPrice(info.price_renew, info.currency)}</span></span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {total > perPage && (
        <Pagination
          page={page}
          totalPages={Math.ceil(total / perPage)}
          onPage={setPage}
          totalItems={total}
          perPage={perPage}
        />
      )}
    </div>
  );
}
