/**
 * Sumopod bills its fee ON TOP of the amount we request. When we create a
 * payment for `amount` the customer pays `amount + fee`, and the webhook payload
 * carries:
 *
 *   amount     = tx.amount + fee   (what the customer paid)
 *   fee        = the gateway fee
 *   net_amount = tx.amount         (what the merchant actually receives)
 *
 * Comparing the webhook's `amount` directly against `tx.amount` therefore
 * rejects every legitimate Sumopod payment. This helper accepts the webhook when
 * ANY amount the gateway reports as "received by the merchant" reconciles to the
 * order amount, while still rejecting a genuine underpayment (no candidate
 * matches) — which is the partial-payment attack the guard exists to stop.
 */
export function reconcileWebhookAmount(
  txAmountRaw: unknown,
  data: Record<string, any> | null | undefined,
): { ok: boolean; candidates: number[] } {
  const txAmount = Number(txAmountRaw);
  const d = data || {};

  const feeRaw = d.fee != null ? Number(d.fee) : NaN;
  const amountRaw = d.amount != null ? Number(d.amount) : NaN;

  const candidates: number[] = [];
  if (Number.isFinite(amountRaw)) candidates.push(amountRaw);
  if (d.net_amount != null && Number.isFinite(Number(d.net_amount))) candidates.push(Number(d.net_amount));
  if (d.netAmount != null && Number.isFinite(Number(d.netAmount))) candidates.push(Number(d.netAmount));
  // amount - fee == tx.amount for Sumopod's fee-on-top model.
  if (Number.isFinite(amountRaw) && Number.isFinite(feeRaw)) candidates.push(amountRaw - feeRaw);

  const finite = candidates.filter((n) => Number.isFinite(n));

  // No amount information at all (e.g. internal reconciliation payloads): allow,
  // matching the previous "amount is optional" behaviour.
  if (finite.length === 0 || !Number.isFinite(txAmount)) {
    return { ok: true, candidates: finite };
  }

  const ok = finite.some((n) => Math.round(n) === Math.round(txAmount));
  return { ok, candidates: finite };
}
