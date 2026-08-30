export function parseAllowedOrigins(value: string): string[] {
  return value.split(",").map((origin) => origin.trim()).filter(Boolean);
}

export function isOriginAllowed(origin: string | null, allowedOrigins: string[], production: boolean): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (!production && allowedOrigins.includes("*")) return true;

  if (!production) {
    try {
      const url = new URL(origin);
      return url.hostname === "localhost" || url.hostname === "127.0.0.1";
    } catch {
      return false;
    }
  }
  return false;
}

export function assertSafeCorsConfig(allowedOrigins: string[], production: boolean): void {
  if (production && (allowedOrigins.length === 0 || allowedOrigins.includes("*"))) {
    throw new Error("CORS_ORIGIN must contain explicit trusted origins in production");
  }
}
