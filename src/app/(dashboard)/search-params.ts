export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function int(v: string | string[] | undefined, fallback: number, min?: number, max?: number) {
  const n = Number(str(v));
  if (!Number.isInteger(n)) return fallback;
  if (min !== undefined && n < min) return fallback;
  if (max !== undefined && n > max) return fallback;
  return n;
}

/** Default period: Nov 2017 (busiest month, includes Black Friday). */
export const DEFAULT_YEAR = 2017;
export const DEFAULT_MONTH = 11;
