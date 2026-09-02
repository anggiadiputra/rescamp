import { afterEach, expect, mock, test } from 'bun:test'

// Regression: fonnte.ts must read its token through getSystemSettings() so the
// ENCRYPTED value (v2:ciphertext) stored in app_settings is DECRYPTED before
// being sent to the Fonnte API as a Bearer token.
// Bug class: identical to the Turnstile/Brevo fixes — reading app_settings
// directly submits raw ciphertext as the provider credential.

mock.module('../src/db', () => ({
  db: {
    select: () => ({
      from: async () => [
        { key: 'fonnte_token', value: 'v2:encrypted-ciphertext' },
        { key: 'fonnte_api_url', value: 'https://api.fonnte.com' },
      ],
    }),
  },
}))

mock.module('../src/modules/settings/settings.service', () => ({
  getSystemSettings: async () => ({
    fonnte_token: 'decrypted-fonnte-token',
    fonnte_api_url: 'https://api.fonnte.com',
  }),
}))

const originalFetch = globalThis.fetch
const { checkWhatsApp } = await import('../src/lib/fonnte')

afterEach(() => {
  globalThis.fetch = originalFetch
})

test('fonnte check sends the DECRYPTED token as Bearer to Fonnte', async () => {
  const submitted = { auth: null as string | null }

  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
    submitted.auth = (init?.headers as Record<string, string>)?.Authorization ?? null
    return new Response(JSON.stringify({ status: true }), { status: 200 })
  }) as unknown as typeof fetch

  const res = await checkWhatsApp('08123456789')
  expect(res.registered).toBe(true)
  expect(submitted.auth).toBe('Bearer decrypted-fonnte-token')
})

test('fonnte check normalizes local 0-prefix numbers to 62 country code', async () => {
  const submitted = { deviceToken: '' }

  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
    submitted.deviceToken = JSON.parse(String(init?.body)).device_token
    return new Response(JSON.stringify({ status: true }), { status: 200 })
  }) as unknown as typeof fetch

  await checkWhatsApp('08123456789')
  expect(submitted.deviceToken).toBe('628123456789')
})