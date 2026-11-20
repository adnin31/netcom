import {
  detectAnomalies, METHODS, MIN_DAYS_FOR_DETECTION,
  type AnomalyMethod, type MonthStats, type ScoredDay,
} from "../../domain/anomaly";
import { isIsoDate, monthKey, yearRange } from "../../domain/period";
import { clipToCoverage, groupByMonth } from "../../domain/revenue";
import type { RevenueRepository } from "../ports";

export type DetectAnomaliesInput = {
  year: number;
  /** null = whole year (each day still compared with its own month). */
  month: number | null;
  method: AnomalyMethod;
  threshold?: number;
  /** Optional selected day ("YYYY-MM-DD"). */
  date?: string | null;
};

export type DetectAnomaliesOutput = {
  year: number;
  month: number | null;
  method: AnomalyMethod;
  threshold: number;
  /** Days of the selected month, or of the whole year. */
  days: ScoredDay[];
  /** Every scored day of the year (for the calendar view). */
  yearDays: ScoredDay[];
  /** Stats of the selected month (null in whole-year mode or when data is insufficient). */
  monthStats: (MonthStats & { baseline: number }) | null;
  anomalies: ScoredDay[]; // sorted by |score| desc
  spikes: number;
  drops: number;
  selected: ScoredDay | null;
  availableYears: number[];
  periods: { year: number; month: number }[];
};

export class DetectRevenueAnomalies {
  constructor(private readonly revenue: RevenueRepository) {}

  async execute(input: DetectAnomaliesInput): Promise<DetectAnomaliesOutput> {
    const threshold = input.threshold && input.threshold > 0 && input.threshold <= 10
      ? input.threshold
      : METHODS[input.method].defaultThreshold;

    const [yearDaysRaw, coverage, periods] = await Promise.all([
      this.revenue.daily(yearRange(input.year)),
      this.revenue.coverage(),
      this.revenue.periods(),
    ]);

    // Each day is scored against the other days of the same month.
    const byMonth = new Map<string, ReturnType<typeof detectAnomalies>>();
    for (const [key, list] of groupByMonth(clipToCoverage(yearDaysRaw, coverage))) {
      byMonth.set(key, detectAnomalies(list, input.method, threshold));
    }
    const yearDays = [...byMonth.values()].flatMap((m) => m.days);

    const selectedMonth = input.month ? byMonth.get(monthKey(input.year, input.month)) : undefined;
    const days = input.month ? selectedMonth?.days ?? [] : yearDays;
    const anomalies = days.filter((d) => d.isAnomaly).sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
    const spikes = anomalies.filter((d) => d.direction === "spike").length;

    const date = input.date && isIsoDate(input.date) ? input.date : null;

    return {
      year: input.year,
      month: input.month,
      method: input.method,
      threshold,
      days,
      yearDays,
      monthStats: selectedMonth && selectedMonth.days.length >= MIN_DAYS_FOR_DETECTION
        ? { ...selectedMonth.stats, baseline: selectedMonth.days[0].baseline }
        : null,
      anomalies,
      spikes,
      drops: anomalies.length - spikes,
      selected: date ? yearDays.find((d) => d.date === date) ?? null : null,
      availableYears: [...new Set(periods.map((p) => p.year))],
      periods,
    };
  }
}
