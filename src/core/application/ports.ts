// Ports: the interfaces the use cases need from the outside world.
// They are declared here (inner circle) and implemented by adapters
// (outer circle), so source dependencies point inward (Dependency Inversion).
// Only plain data structures cross these boundaries.

import type { ListQuery, RecordKey, RecordValues, TableDef } from "../domain/dataset";
import type { Order, OrderStatus } from "../domain/order";
import type { DateRange } from "../domain/period";
import type { DayRevenue, MonthRevenue } from "../domain/revenue";
import type { SessionUser, User } from "../domain/user";

// ---------- repositories ----------

export interface RevenueRepository {
  /** Daily revenue for [range.start, range.end), zero-filled. */
  daily(range: DateRange): Promise<DayRevenue[]>;
  /** Monthly revenue, optionally limited to a range. */
  monthly(range?: DateRange): Promise<MonthRevenue[]>;
  /** First and last purchase date in the data ("YYYY-MM-DD"). */
  coverage(): Promise<{ first: string; last: string }>;
  /** Every (year, month) that has orders. */
  periods(): Promise<{ year: number; month: number }[]>;
  /** Breakdown of one day's orders. */
  dayBreakdown(date: string): Promise<{
    categories: { category: string; revenue: number; items: number }[];
    statuses: { status: string; count: number }[];
    maxOrderValue: number | null;
    avgOrderValue: number | null;
  }>;
}

export type OverviewStats = {
  orders: number;
  revenue: number;
  uniqueCustomers: number;
  sellers: number;
  products: number;
  awaitingShipment: number;
  avgReviewScore: number;
  statuses: { status: string; count: number }[];
  topCategories: { category: string; revenue: number }[];
  payments: { type: string; value: number }[];
  topStates: { state: string; orders: number }[];
};

export interface DashboardRepository {
  overview(): Promise<OverviewStats>;
}

export type UnshippedCriteria = {
  status?: OrderStatus;
  idPrefix?: string;
  range?: DateRange;
  sort: "oldest" | "newest" | "value";
  limit: number;
  offset: number;
};

export type UnshippedRow = {
  orderId: string;
  customerId: string;
  status: OrderStatus;
  purchasedAt: string;
  approvedAt: string | null;
  estimatedDeliveryAt: string | null;
  city: string;
  state: string;
  items: number;
  value: number | null;
};

export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  findAwaitingShipment(c: UnshippedCriteria): Promise<{ rows: UnshippedRow[]; total: number; totalValue: number }>;
  countAwaitingShipmentByStatus(): Promise<{ status: string; count: number }[]>;
  latestPurchaseDate(): Promise<string>;
  /** Returns false if the order was changed meanwhile (optimistic check). */
  markShipped(id: string, at: string): Promise<boolean>;
}

export interface DatasetRepository {
  list(table: TableDef, q: ListQuery): Promise<{ rows: RecordValues[]; total: number }>;
  insert(table: TableDef, values: RecordValues): Promise<RecordValues>;
  update(table: TableDef, key: RecordKey, values: RecordValues): Promise<RecordValues | null>;
  delete(table: TableDef, key: RecordKey): Promise<boolean>;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
}

// ---------- services ----------

export interface PasswordHasher {
  /** Must take similar time whether or not `hash` is null (no user enumeration). */
  verify(password: string, hash: string | null): Promise<boolean>;
}

export interface TokenService {
  sign(user: SessionUser): Promise<string>;
  verify(token: string | undefined): Promise<SessionUser | null>;
  readonly ttlSeconds: number;
}

export interface Clock {
  /** "YYYY-MM-DD HH:MM:SS" */
  now(): string;
}
