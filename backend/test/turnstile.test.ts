import { afterEach, expect, mock, test } from 'bun:test'

const rawRows = [
  { key: 'turnstile_enabled', value: 'true' },
  { key: 'turnstile_secret_key', value: 'v2:encrypted-ciphertext' },
  {
    key: 'turnstile_verify_url',
    value: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  },
]

mock.module('../src/db', () => ({
  db: {
    select: () => ({
      from: async () => rawRows,
    }),
  },
}))

mock.module('../src/modules/settings/settings.service', () => ({
  getSystemSettings: async () => ({
    turnstile_enabled: 'true',
    turnstile_secret_key: 'decrypted-secret-key',
    turnstile_verify_url:
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  }),
}))

const originalFetch = globalThis.fetch
const { verifyTurnstileToken } = await import('../src/lib/turnstile')

afterEach(() => {
  globalThis.fetch = originalFetch
})

test('Turnstile verification sends the decrypted settings secret', async () => {
  const submitted = { secret: '' }

  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
    const body = init?.body as URLSearchParams
    submitted.secret = body.get('secret') || ''
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  await verifyTurnstileToken('client-token')

  expect(submitted.secret).toBe('decrypted-secret-key')
})
