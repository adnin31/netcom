import type { MonthRevenue } from "../../domain/revenue";
import type { DashboardRepository, OverviewStats, RevenueRepository } from "../ports";

export type OverviewOutput = Omit<OverviewStats, "payments"> & {
  averageOrderValue: number;
  payments: { type: string; value: number; sharePct: number }[];
  monthly: MonthRevenue[];
};

export class GetOverview {
  constructor(
    private readonly dashboard: DashboardRepository,
    private readonly revenue: RevenueRepository,
  ) {}

  async execute(): Promise<OverviewOutput> {
    const [stats, monthly] = await Promise.all([this.dashboard.overview(), this.revenue.monthly()]);
    const paymentTotal = stats.payments.reduce((s, p) => s + p.value, 0);
    return {
      ...stats,
      averageOrderValue: stats.orders ? stats.revenue / stats.orders : 0,
      payments: stats.payments.map((p) => ({ ...p, sharePct: paymentTotal ? (p.value / paymentTotal) * 100 : 0 })),
      monthly,
    };
  }
}
