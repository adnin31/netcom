// Calendar periods used by revenue reporting. Dates are ISO strings
// ("YYYY-MM-DD") so no timezone can shift them.

export type DateRange = { start: string; end: string }; // [start, end)

export type Period = { year: number; month: number | null }; // month null = whole year

const pad = (n: number) => String(n).padStart(2, "0");

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function monthRange(year: number, month: number): DateRange {
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  return { start: `${year}-${pad(month)}-01`, end: `${next.y}-${pad(next.m)}-01` };
}

export function yearRange(year: number): DateRange {
  return { start: `${year}-01-01`, end: `${year + 1}-01-01` };
}

export function periodRange(p: Period): DateRange {
  return p.month ? monthRange(p.year, p.month) : yearRange(p.year);
}

export function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

/** "2017-11" */
export function monthKey(year: number, month: number): string {
  return `${year}-${pad(month)}`;
}

/** Whole days between two ISO dates/timestamps (b - a), floored. */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(b.replace(" ", "T") + (b.length <= 10 ? "T00:00:00Z" : "Z"))
    - Date.parse(a.replace(" ", "T") + (a.length <= 10 ? "T00:00:00Z" : "Z"));
  return Math.floor(ms / 86_400_000);
}
