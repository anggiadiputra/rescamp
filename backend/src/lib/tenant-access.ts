import { inArray, or } from "drizzle-orm";
import { db } from "../db";
import { customers, users } from "../db/schema";
import { AppError } from "./error";

export interface TenantPrincipal {
  id: number;
  role?: string | null;
  email?: string | null;
}

export interface TenantScope {
  unrestricted: boolean;
  userIds: number[];
  customerIds: number[];
}

export function canAccessTenantResource(
  scope: TenantScope,
  resource: { userId?: number | null; customerId?: number | null },
): boolean {
  if (scope.unrestricted) return true;
  if (resource.userId != null && scope.userIds.includes(resource.userId)) return true;
  if (resource.customerId != null && scope.customerIds.includes(resource.customerId)) return true;
  return false;
}

export function resolveOrderCustomerId(
  role: string | null | undefined,
  requestedCustomerId: number | undefined,
  authenticatedCustomerId: number | null | undefined,
): number | undefined {
  if (role !== "customer") return requestedCustomerId;
  if (!authenticatedCustomerId) throw new AppError("Customer profile not found", 400);
  return authenticatedCustomerId;
}

export async function loadTenantScope(principal: TenantPrincipal): Promise<TenantScope> {
  if (principal.role === "admin") {
    return { unrestricted: true, userIds: [], customerIds: [] };
  }

  if (principal.role === "customer") {
    const ownedCustomers = await db
      .select({ id: customers.id })
      .from(customers)
      .where(or(
        inArray(customers.userId, [principal.id]),
        ...(principal.email ? [inArray(customers.email, [principal.email])] : []),
      ));
    return {
      unrestricted: false,
      userIds: [principal.id],
      customerIds: ownedCustomers.map((customer) => customer.id),
    };
  }

  const childUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.parentResellerId, [principal.id]));
  const userIds = Array.from(new Set([principal.id, ...childUsers.map((user) => user.id)]));
  const ownedCustomers = await db
    .select({ id: customers.id })
    .from(customers)
    .where(inArray(customers.userId, userIds));

  return {
    unrestricted: false,
    userIds,
    customerIds: ownedCustomers.map((customer) => customer.id),
  };
}
