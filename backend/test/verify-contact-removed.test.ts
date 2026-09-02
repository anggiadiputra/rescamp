import { expect, test } from 'bun:test'

// A-1 regression lock: the fake public contact-verification endpoint must stay
// GONE. It always returned status:"verified" without verifying anything, and
// probed the reseller master credentials (hardcoded user 1) with arbitrary
// customer/contact IDs — an enumeration oracle + quota abuse vector.
// If you need public contact verification back, it MUST be built on a signed
// single-use token issued when the RAA email is sent — never on free-form
// params. Until such a design exists, this endpoint must not reappear.

test('domains handler no longer exports the fake verifyContactPublic', async () => {
  const h = await import('../src/modules/domains/domains.handler')
  expect((h as any).verifyContactPublic).toBeUndefined()
})

test('domains service no longer exports verifyContactPublicService', async () => {
  const svc = await import('../src/modules/domains/domains.service')
  expect((svc as any).verifyContactPublicService).toBeUndefined()
})

test('no public /verify-contact route is registered', async () => {
  const routeSource = await Bun.file(import.meta.dir + '/../src/modules/domains/domains.route.ts').text()
  // Match the actual route registration, not explanatory comments.
  expect(routeSource).not.toContain('.post("/verify-contact"')
})