// Revenue entities and summary rules.
//
// Business definition: revenue = sum of payment values of orders whose status
// is not in NON_REVENUE_STATUSES, attributed to the order's purchase date.

export type DayRevenue = { date: string; revenue: number; orders: number };
export type MonthRevenue = { month: string; revenue: number; orders: number }; // month = "YYYY-MM"

export type MonthSummary = {
  total: number;
  orders: number;
  activeDays: number;
  averagePerActiveDay: number;
  averageOrderValue: number | null;
  best: DayRevenue | null;
  worst: DayRevenue | null;
  /** % change vs the previous month; null when there is nothing to compare with. */
  growthPct: number | null;
};

export function summarizeMonth(days: DayRevenue[], previousMonthRevenue: number | null): MonthSummary {
  const total = days.reduce((s, d) => s + d.revenue, 0);
  const orders = days.reduce((s, d) => s + d.orders, 0);
  const active = days.filter((d) => d.orders > 0);
  const byRevenue = [...active].sort((a, b) => b.revenue - a.revenue);
  return {
    total,
    orders,
    activeDays: active.length,
    averagePerActiveDay: active.length ? total / active.length : 0,
    averageOrderValue: orders ? total / orders : null,
    best: byRevenue[0] ?? null,
    worst: byRevenue[byRevenue.length - 1] ?? null,
    growthPct: previousMonthRevenue && previousMonthRevenue > 0
      ? ((total - previousMonthRevenue) / previousMonthRevenue) * 100
      : null,
  };
}

/** Keep only days inside the data coverage: outside it revenue is unknown, not zero. */
export function clipToCoverage<T extends { date: string }>(days: T[], coverage: { first: string; last: string }): T[] {
  return days.filter((d) => d.date >= coverage.first && d.date <= coverage.last);
}

export function groupByMonth<T extends { date: string }>(days: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const d of days) {
    const key = d.date.slice(0, 7);
    const list = groups.get(key);
    if (list) list.push(d);
    else groups.set(key, [d]);
  }
  return groups;
}
