import { expect, test } from 'bun:test'

// A-4 regression: concurrent double-submit of the same domain order must
// result in ONE pending_payment transaction and ONE payment link.
//
// The scenario runs in a SEPARATE bun process (order-race-scenario.ts) because
// bun:test's mock.module is process-global — mocking db/liquid/sumopod here
// would pollute liquid.test.ts and tenant-access.test.ts in the same run.

test('parallel identical order submissions produce ONE transaction and ONE payment link', async () => {
  const proc = Bun.spawn([process.execPath, 'test/order-race-scenario.ts'], {
    cwd: import.meta.dir + '/..',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const out = await new Response(proc.stdout).text()
  const errText = await new Response(proc.stderr).text()
  const exitCode = await proc.exited

  const line = out.split('\n').find((l) => l.startsWith('RACE_RESULT '))
  if (!line) {
    throw new Error(`scenario produced no result. exit=${exitCode} stderr=${errText.slice(0, 500)} stdout=${out.slice(0, 500)}`)
  }
  const r = JSON.parse(line.slice('RACE_RESULT '.length))

  // Both callers must receive the SAME transaction and payment link.
  expect(r.txA).toBeDefined()
  expect(r.txB).toBe(r.txA)
  expect(r.linkB).toBe(r.linkA)
  expect(r.linkA).not.toBe('')
  // Only ONE payment link was created and ONE transaction row inserted.
  expect(r.sumopodCalls).toBe(1)
  expect(r.inserts).toBe(1)
})