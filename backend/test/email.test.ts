import { afterEach, expect, mock, test } from 'bun:test'

mock.module('../src/db', () => ({
  db: {
    select: () => ({
      from: async () => [
        { key: 'email_provider', value: 'smtp' },
        { key: 'smtp_pass', value: 'v2:encrypted-ciphertext' },
      ],
    }),
  },
}))

mock.module('../src/modules/settings/settings.service', () => ({
  getSystemSettings: async () => ({
    email_provider: 'smtp',
    brand_name: 'Ekstensi ID',
    smtp_host: 'smtp-relay.brevo.com',
    smtp_port: '587',
    smtp_user: 'test@smtp-brevo.com',
    smtp_pass: 'decrypted-brevo-api-key',
    smtp_from_email: 'noreply@example.com',
    smtp_from_name: 'Ekstensi ID',
    brevo_api_key: '',
  }),
}))

const originalFetch = globalThis.fetch
const { sendEmail } = await import('../src/lib/email')

afterEach(() => {
  globalThis.fetch = originalFetch
})

test('email dispatcher sends the decrypted credential to Brevo', async () => {
  const submitted = { apiKey: '' }

  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
    submitted.apiKey = new Headers(init?.headers).get('api-key') || ''
    return new Response(JSON.stringify({ messageId: 'test-message-id' }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  await sendEmail('recipient@example.com', 'login_otp', {
    otp: '123456',
    expiry_minutes: 5,
  })

  expect(submitted.apiKey).toBe('decrypted-brevo-api-key')
})

test('email dispatcher rejects when Brevo does not accept the message', async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ message: 'Key not found', code: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch

  await expect(
    sendEmail('recipient@example.com', 'login_otp', {
      otp: '123456',
      expiry_minutes: 5,
    }),
  ).rejects.toThrow('Gagal mengirim email')
})
