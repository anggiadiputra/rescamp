export interface User {
  id: number;
  email: string;
  name: string;
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
  liquidOrderId: string | null;
  nameservers: string[] | null;
  customerId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: number;
  liquidCustomerId: string | null;
  name: string;
  email: string;
  company: string | null;
  country: string;
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
