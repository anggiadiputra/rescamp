export interface User {
  id: number;
  email: string;
  name: string;
}

export function hasResellerCapabilities(role: string | null | undefined): boolean {
  return role === "reseller" || role === "admin";
}

export interface DomainContact {
  contactId?: string | number;
  name?: string;
  company?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipcode?: string;
  phone?: string;
}

export interface RaaVerificationInfo {
  status: "verified" | "pending" | "unknown";
  email?: string;
  canResend?: boolean;
}

export interface DnssecRecord {
  keytag: number;
  algorithm: number;
  digesttype: number;
  digest: string;
}

export interface ChildNsRecord {
  hostname: string;
  ipAddress: string;
}

export interface DomainForwardingInfo {
  enabled: boolean;
  destinationUrl?: string;
  urlMasking?: boolean;
}

export interface Domain {
  id: number;
  domainName: string;
  tld: string;
  registrationDate: string | null;
  expiryDate: string | null;
  years: number;
  status: "active" | "pending" | "expired" | "suspended" | "transferred";
  autoRenew: number;
  locked: number;
  theftProtection: number;
  privacyProtection: number;
  privacyPurchased: number;
  liquidOrderId: string | null;
  suspendReason?: string | null;
  suspendedAt?: string | null;
  nameservers: string[] | null;
  customerId: number | null;
  customerName?: string | null;
  customerEmail?: string | null;
  registrantContact?: DomainContact | null;
  adminContact?: DomainContact | null;
  techContact?: DomainContact | null;
  billingContact?: DomainContact | null;
  raaVerification?: RaaVerificationInfo | null;
  dnssecRecords?: DnssecRecord[] | null;
  childNsRecords?: ChildNsRecord[] | null;
  forwardingInfo?: DomainForwardingInfo | null;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: number;
  liquidCustomerId: string | null;
  name: string;
  email: string;
  company: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  zipcode: string | null;
  phone_cc?: string | null;
  phone: string | null;
  createdAt: string;
}

export interface Transaction {
  id: number;
  type: string;
  amount: string;
  currency: string;
  status: string;
  description: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; perPage: number };
}
