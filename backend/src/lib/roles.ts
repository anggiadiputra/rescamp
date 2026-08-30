export function hasResellerCapabilities(role: string | null | undefined): boolean {
  return role === "reseller" || role === "admin";
}

export function hasAdminCapabilities(role: string | null | undefined): boolean {
  return role === "admin";
}
