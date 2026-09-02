import { describe, expect, it, mock } from 'bun:test'

// Mock ONLY the db, BEFORE the handler is imported.
// The anonymous branch must not reach the DB at all (asserted via call count);
// the authenticated branch reads users.sessionVersion through this mock.
//
// The mock must serve two drizzle chain shapes:
//   auth.handler.session: db.select(...).from(users).where(eq(...)).limit(1)
//   auth.service.me:      db.select(...).from(users).where(eq(...))
// `where()` returns an array-like result that ALSO carries a .limit() method.
const selectCalls: string[] = []

function usersRow() {
  return { sessionVersion: 0, id: 7, email: 'user@example.com', name: 'U', role: 'admin' }
}

function rowsResult(rows: any[]) {
  const promise = Promise.resolve(rows)
  return Object.assign(promise, {
    limit: async () => {
      selectCalls.push('users')
      return rows
    },
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  })
}

mock.module('../src/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        // Synchronous thenable builder, like real drizzle: .where() returns
        // something awaitable that ALSO has .limit() available synchronously.
        where: () => {
          selectCalls.push('users')
          return rowsResult([usersRow()])
        },
      }),
    }),
  },
}))

const originalSecret = process.env.JWT_SECRET
process.env.JWT_SECRET = 'x'.repeat(48)

const { signToken } = await import('../src/lib/jwt')
const { session } = await import('../src/modules/auth/auth.handler')

describe('GET /auth/session bootstrap probe', () => {
  it('returns 200 authenticated:false for anonymous visitors without touching the DB', async () => {
    selectCalls.length = 0
    const ctx: any = { headers: {}, store: {}, set: { status: 0, headers: {} } }
    const res = await session(ctx)
    expect(ctx.set.status).not.toBe(401)
    expect(res).toEqual({ data: { authenticated: false } })
    expect(selectCalls.length).toBe(0)
  })

  it('returns 200 authenticated:true with user payload for a valid session', async () => {
    selectCalls.length = 0
    const token = await signToken({ sub: 7, email: 'user@example.com', role: 'admin', sessionVersion: 0 })
    const ctx: any = {
      headers: { cookie: `token=${encodeURIComponent(token)}` },
      store: {},
      set: { status: 0, headers: {} },
    }
    const res = await session(ctx)
    expect(res.data.authenticated).toBe(true)
    expect(res.data.user.email).toBe('user@example.com')
    expect(selectCalls.length).toBeGreaterThan(0)
  })

  it('returns authenticated:false for a token whose sessionVersion was revoked', async () => {
    const stale = await signToken({ sub: 7, email: 'user@example.com', role: 'admin', sessionVersion: 5 })
    const ctx: any = {
      headers: { cookie: `token=${encodeURIComponent(stale)}` },
      store: {},
      set: { status: 0, headers: {} },
    }
    const res = await session(ctx)
    expect(res).toEqual({ data: { authenticated: false } })
  })
})

process.env.JWT_SECRET = originalSecret