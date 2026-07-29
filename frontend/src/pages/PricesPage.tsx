import { useState, useEffect } from "react";
import { Card, LoadingSpinner } from "../components/ui";
import { api } from "../lib/api";

function fmtPrice(amount: any, currency: string = "IDR"): string {
  if (!amount) return "-";
  const num = Number(amount);
  if (isNaN(num)) return "-";
  const actual = num < 10000 ? num * 1000 : num;
  return `${currency} ${Math.round(actual).toLocaleString("id-ID")}`;
}

export default function PricesPage() {
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    api.get<any>("/billing/prices", { signal: controller.signal })
      .then((data) => setPrices(data))
      .catch((err) => { if (err.name !== "AbortError") console.error(err); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  if (loading) return <LoadingSpinner />;

  const entries = Object.entries(prices).filter(([k]) => k !== "addons");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Price List</h1>

      <Card className="p-0">
        <div className="overflow-x-auto">
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
              {entries.map(([tld, info]: [string, any]) => (
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
      </Card>
    </div>
  );
}
