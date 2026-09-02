/**
 * Role model (B-6 normalization): exactly TWO roles exist —
 *   admin    = reseller/platform operator (can manage customers, settings, domains)
 *   customer = buyer
 * The legacy "reseller" role was removed from the DB (0 rows at migration
 * time); a reseller IS an admin. These helpers intentionally no longer accept
 * role === "reseller" so stale tokens/rows cannot regain operator access.
 */
export function hasOperatorCapabilities(role: string | null | undefined): boolean {
  return role === "admin";
}

// Kept as an alias for existing call sites; semantics identical to
// hasOperatorCapabilities after role normalization.
export const hasResellerCapabilities = hasOperatorCapabilities;

export function hasAdminCapabilities(role: string | null | undefined): boolean {
  return role === "admin";
}