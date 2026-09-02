import { expect, test } from 'bun:test'

// A-5 regression: the billing sweeper retry path must use the SAME
// invoice_option as the normal webhook path ("no_invoice"). The old sweeper
// used "keep_invoice", causing Resellercamp to create a wholesale invoice for
// the reseller on retry — potential double-billing (customer paid retail via
// Sumopod, reseller also invoiced wholesale).
//
// These are source-level assertions on purpose: bun:test's mock.module is
// process-global, and mocking ../src/lib/liquid or ../src/db here pollutes
// liquid.test.ts / tenant-access.test.ts in the same `bun test` run.

test('sweeper retry no longer assigns invoice_option keep_invoice', async () => {
  const src = await Bun.file(import.meta.dir + '/../src/modules/billing/billing.service.ts').text()
  // Match the actual invoice_option assignment, not explanatory comments.
  expect(src).not.toContain('invoice_option: "keep_invoice"')
  expect(src).toContain('invoice_option: "no_invoice"')
})

test('webhook success path (payments.service) uses no_invoice for register/transfer', async () => {
  const src = await Bun.file(import.meta.dir + '/../src/modules/payments/payments.service.ts').text()
  expect(src).toContain('invoice_option: "no_invoice"')
  expect(src).not.toContain('invoice_option: "keep_invoice"')
})

test('both register paths (webhook + sweeper) agree on invoice_option', async () => {
  const billingSrc = await Bun.file(import.meta.dir + '/../src/modules/billing/billing.service.ts').text()
  const paymentsSrc = await Bun.file(import.meta.dir + '/../src/modules/payments/payments.service.ts').text()
  const option = (src: string) => new Set(src.match(/invoice_option: "(no_invoice|keep_invoice)"/g))
  const billingOptions = option(billingSrc)
  const paymentOptions = option(paymentsSrc)
  expect(billingOptions.has('invoice_option: "keep_invoice"')).toBe(false)
  expect(paymentOptions.has('invoice_option: "keep_invoice"')).toBe(false)
})