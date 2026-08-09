import { describe, it, expect } from "bun:test";
import { listTransactionsFromLiquid } from "../src/modules/billing/billing.service";

describe("listTransactionsFromLiquid", () => {
  it("should format and filter remote transactions correctly", async () => {
    const fakeCreds = { resellerId: "123", apiKey: "key" };
    // Test with mock LiquidClient call by overriding fetch
    (globalThis as any).fetch = async (url: string) => {
      if (url.includes("/account/transactions")) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              "1": {
                transaction_id: "1001",
                transaction_type: "domain",
                description: "Renewal of domain example.com for 1 year",
                amount: "150000",
                status: "paid",
                date_created: "2026-08-01 10:00:00",
              },
              "2": {
                transaction_id: "1002",
                transaction_type: "deposit",
                description: "Fund added to account",
                amount: "500000",
                status: "completed",
                date_created: "2026-08-02 11:00:00",
              },
              rec_count: "2",
            }),
        };
      }
      return { ok: false, text: async () => "{}" };
    };

    const res = await listTransactionsFromLiquid(fakeCreds, { page: 1, perPage: 20 });
    expect(res.items.length).toBe(2);

    const renewalTxn = res.items.find((i: any) => i.id === "1001");
    expect(renewalTxn).toBeDefined();
    expect(renewalTxn!.type).toBe("renew");
    expect(renewalTxn!.status).toBe("completed");

    const fundTxn = res.items.find((i: any) => i.id === "1002");
    expect(fundTxn).toBeDefined();
    expect(fundTxn!.type).toBe("fund");

    // Test status filter
    const pendingOnly = await listTransactionsFromLiquid(fakeCreds, { status: "pending_payment" });
    expect(pendingOnly.items.length).toBe(0);

    // Test search filter
    const searchRes = await listTransactionsFromLiquid(fakeCreds, { search: "example.com" });
    expect(searchRes.items.length).toBe(1);
    expect(searchRes.items[0]!.id).toBe("1001");
  });
});
