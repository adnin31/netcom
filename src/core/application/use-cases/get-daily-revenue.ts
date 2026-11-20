import { monthKey, monthRange, previousMonth, yearRange } from "../../domain/period";
import { summarizeMonth, type DayRevenue, type MonthRevenue, type MonthSummary } from "../../domain/revenue";
import type { RevenueRepository } from "../ports";

export type DailyRevenueInput = { year: number; month: number };
export type DailyRevenueOutput = {
  year: number;
  month: number;
  days: DayRevenue[];
  summary: MonthSummary;
  /** Monthly totals of the selected year, for context. */
  yearMonthly: MonthRevenue[];
  availableYears: number[];
  periods: { year: number; month: number }[];
};

export class GetDailyRevenue {
  constructor(private readonly revenue: RevenueRepository) {}

  async execute({ year, month }: DailyRevenueInput): Promise<DailyRevenueOutput> {
    const prev = previousMonth(year, month);
    const [days, yearMonthly, prevMonthDays, periods] = await Promise.all([
      this.revenue.daily(monthRange(year, month)),
      this.revenue.monthly(yearRange(year)),
      this.revenue.monthly(monthRange(prev.year, prev.month)),
      this.revenue.periods(),
    ]);
    const prevRevenue = prevMonthDays.find((m) => m.month === monthKey(prev.year, prev.month))?.revenue ?? null;

    return {
      year,
      month,
      days,
      summary: summarizeMonth(days, prevRevenue),
      yearMonthly,
      availableYears: [...new Set(periods.map((p) => p.year))],
      periods,
    };
  }
}
