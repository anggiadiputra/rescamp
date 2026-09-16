import { AppError } from "./error";
import { getRedis } from "./redis";

// OTP brute-force lockout tracker.
//
// Backed by Redis via a single INCR (Redis's INCR is atomic, so concurrent
// burst attempts cannot overshoot the failure budget — the 11th..Nth call in a
// flood sees count > maxFailures and is rejected). Bun's Redis client has no
// Lua/EVAL, so a single-counter scheme is what keeps this atomic across
// processes; a GET-lock-then-SET-lock sequence would reopen the race this
// tracker exists to close.
//
// When Redis is unavailable we fall back to a per-process Map whose code path is
// fully synchronous (no await before the increment), preserving atomicity within
// a single-threaded process. Auth never breaks just because Redis is down.

const ATTEMPT_PREFIX = "otp:attempt:";

export class OtpAttemptTracker {
  private readonly localStore = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private readonly maxFailures = 5,
    private readonly lockoutMs = 5 * 60 * 1000,
  ) {}

  get windowSec(): number {
    return Math.max(1, Math.ceil(this.lockoutMs / 1000));
  }

  /**
   * Atomically record an attempt and reject if the failure budget is exceeded.
   * Throws AppError(429) once the key exceeds maxFailures within the window.
   */
  async assertAndRecordAttempt(key: string): Promise<void> {
    const redis = getRedis();
    if (!redis) {
      // Synchronous fallback — no await before mutation, so a burst of calls is
      // serialized by the JS event loop and cannot race the local counter.
      this.localAssertAndRecord(key);
      return;
    }

    let count: number | null;
    try {
      count = await redis.incr(`${ATTEMPT_PREFIX}${key}`);
      if (count === 1) {
        await redis.expire(`${ATTEMPT_PREFIX}${key}`, this.windowSec);
      }
    } catch {
      this.localAssertAndRecord(key);
      return;
    }

    if (count > this.maxFailures) {
      throw new AppError(
        `Terlalu banyak percobaan OTP salah. Coba lagi dalam ${this.windowSec} detik.`,
        429,
      );
    }
  }

  async recordFailure(key: string): Promise<void> {
    await this.assertAndRecordAttempt(key);
  }

  async recordAttempt(key: string): Promise<void> {
    await this.assertAndRecordAttempt(key);
  }

  async clear(key: string): Promise<void> {
    const redis = getRedis();
    if (redis) {
      try {
        await redis.del(`${ATTEMPT_PREFIX}${key}`);
      } catch {}
    }
    this.localStore.delete(key);
  }

  // ---- In-memory fallback (synchronous, atomic within one process) ----

  private localAssertAndRecord(key: string): void {
    const now = Date.now();
    const windowMs = this.windowSec * 1000;
    const rec = this.localStore.get(key);

    // Fixed window: reset the counter once the window has elapsed.
    if (!rec || now - rec.windowStart >= windowMs) {
      this.localStore.set(key, { count: 1, windowStart: now });
      return;
    }

    rec.count += 1;
    if (rec.count > this.maxFailures) {
      throw new AppError(
        `Terlalu banyak percobaan OTP salah. Coba lagi dalam ${this.windowSec} detik.`,
        429,
      );
    }
    this.localStore.set(key, rec);
  }

  // Kept for API compatibility; local fallback state is self-expiring via the
  // window check above, so a manual sweep is only a hygiene measure.
  evictExpired(now = Date.now()): void {
    for (const [key, rec] of this.localStore) {
      if (now - rec.windowStart > this.windowSec * 1000 + 60_000) {
        this.localStore.delete(key);
      }
    }
  }
}
