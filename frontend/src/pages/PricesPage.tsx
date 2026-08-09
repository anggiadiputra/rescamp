import { useState, useEffect } from "react";
import { Card, LoadingSpinner, Pagination } from "../components/ui";
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
  const [page, setPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    const controller = new AbortController();
    api.get<any>("/billing/prices", { signal: controller.signal })
      .then((data) => setPrices(data))
      .catch((err) => { if (err.name !== "AbortError") console.error(err); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  if (loading) return <LoadingSpinner />;

  const allEntries = Object.entries(prices).filter(([k]) => k !== "addons");
  const total = allEntries.length;
  const startIndex = (page - 1) * perPage;
  const visibleEntries = allEntries.slice(startIndex, startIndex + perPage);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Price List</h1>

      <Card className="p-0 overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">TLD</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Register</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Renew</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Transfer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visibleEntries.map(([tld, info]: [string, any]) => (
                <tr key={tld} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">.{tld}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtPrice(info.price_new || info.price_register, info.currency)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtPrice(info.price_renew, info.currency)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtPrice(info.price_transfer, info.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile card fallback */}
        <div className="md:hidden divide-y divide-gray-100">
          {visibleEntries.map(([tld, info]: [string, any]) => (
            <div key={tld} className="px-4 py-3 flex items-center justify-between">
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
