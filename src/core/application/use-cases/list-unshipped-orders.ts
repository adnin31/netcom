import { AWAITING_SHIPMENT_STATUSES, waitingInfo, type OrderStatus } from "../../domain/order";
import { periodRange } from "../../domain/period";
import type { OrderRepository, RevenueRepository, UnshippedRow } from "../ports";

export type ListUnshippedInput = {
  status?: string;
  query?: string;
  year?: number;
  month?: number;
  sort?: string;
  page?: number;
  pageSize?: number;
};

export type UnshippedOrder = UnshippedRow & { daysWaiting: number; overdue: boolean };

export type ListUnshippedOutput = {
  orders: UnshippedOrder[];
  total: number;
  totalValue: number;
  page: number;
  pageSize: number;
  pages: number;
  byStatus: { status: string; count: number }[];
  allAwaiting: number;
  /** Reference date for "days waiting" (latest date in the historical data). */
  asOf: string;
  statuses: readonly OrderStatus[];
  availableYears: number[];
  filter: { status?: OrderStatus; query?: string; year?: number; month?: number; sort: "oldest" | "newest" | "value" };
};

export class ListUnshippedOrders {
  constructor(
    private readonly orders: OrderRepository,
    private readonly revenue: RevenueRepository,
  ) {}

  async execute(input: ListUnshippedInput): Promise<ListUnshippedOutput> {
    const status = AWAITING_SHIPMENT_STATUSES.find((s) => s === input.status);
    const query = input.query?.trim().toLowerCase().replace(/[^0-9a-f]/g, "").slice(0, 32) || undefined;
    const year = input.year && input.year >= 2000 && input.year <= 2100 ? input.year : undefined;
    const month = year && input.month && input.month >= 1 && input.month <= 12 ? input.month : undefined;
    const sort = input.sort === "newest" || input.sort === "value" ? input.sort : "oldest";
    const pageSize = Math.min(Math.max(input.pageSize ?? 20, 5), 100);
    const page = Math.max(input.page ?? 1, 1);

    const [result, byStatus, asOf, periods] = await Promise.all([
      this.orders.findAwaitingShipment({
        status,
        idPrefix: query,
        range: year ? periodRange({ year, month: month ?? null }) : undefined,
        sort,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      this.orders.countAwaitingShipmentByStatus(),
      this.orders.latestPurchaseDate(),
      this.revenue.periods(),
    ]);

    return {
      orders: result.rows.map((r) => ({ ...r, ...waitingInfo(r.purchasedAt, r.estimatedDeliveryAt, asOf) })),
      total: result.total,
      totalValue: result.totalValue,
      page,
      pageSize,
      pages: Math.max(Math.ceil(result.total / pageSize), 1),
      byStatus,
      allAwaiting: byStatus.reduce((s, x) => s + x.count, 0),
      asOf,
      statuses: AWAITING_SHIPMENT_STATUSES,
      availableYears: [...new Set(periods.map((p) => p.year))],
      filter: { status, query, year, month, sort },
    };
  }
}
