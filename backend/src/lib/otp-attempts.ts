import { AppError } from "./error";

export class OtpAttemptTracker {
  private readonly store = new Map<string, { count: number; lockedUntil: number }>();

  constructor(
    private readonly maxFailures = 5,
    private readonly lockoutMs = 5 * 60 * 1000,
  ) {}

  assertAllowed(key: string): void {
    const record = this.store.get(key);
    if (record && record.count >= this.maxFailures && Date.now() < record.lockedUntil) {
      const remainSec = Math.ceil((record.lockedUntil - Date.now()) / 1000);
      throw new AppError(`Terlalu banyak percobaan OTP salah. Coba lagi dalam ${remainSec} detik.`, 429);
    }
  }

  recordFailure(key: string): void {
    const record = this.store.get(key) || { count: 0, lockedUntil: 0 };
    record.count += 1;
    if (record.count >= this.maxFailures) record.lockedUntil = Date.now() + this.lockoutMs;
    this.store.set(key, record);
  }

  clear(key: string): void {
    this.store.delete(key);
  }

  evictExpired(now = Date.now()): void {
    for (const [key, record] of this.store) {
      if (record.lockedUntil > 0 && now > record.lockedUntil + 60_000) this.store.delete(key);
    }
  }
}
