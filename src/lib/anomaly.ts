// Pure anomaly-detection helpers (no I/O) for daily revenue series.

export type AnomalyMethod = "mad" | "zscore" | "iqr";

export const METHODS: Record<AnomalyMethod, { label: string; defaultThreshold: number; help: string }> = {
  mad: {
    label: "Robust (Median/MAD)",
    defaultThreshold: 3.5,
    help: "Modified z-score = 0.6745 × (x − median) / MAD. Tahan terhadap outlier ekstrem (mis. Black Friday). Anomali jika |skor| ≥ ambang.",
  },
  zscore: {
    label: "Z-score (Mean/Std)",
    defaultThreshold: 2,
    help: "z = (x − rata-rata) / standar deviasi. Anomali jika |z| ≥ ambang.",
  },
  iqr: {
    label: "IQR (Tukey fence)",
    defaultThreshold: 1.5,
    help: "Anomali jika di luar [Q1 − k·IQR, Q3 + k·IQR]. Skor = jarak ke pagar dalam satuan IQR.",
  },
};

export type DayPoint = { date: string; revenue: number; orders: number };

export type ScoredDay = DayPoint & {
  score: number;
  isAnomaly: boolean;
  direction: "spike" | "drop" | null;
  baseline: number;
  deviationPct: number;
};

export type MonthStats = {
  mean: number;
  median: number;
  std: number;
  mad: number;
  q1: number;
  q3: number;
  lower: number;
  upper: number;
};

function quantile(sorted: number[], q: number) {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function detectAnomalies(
  days: DayPoint[],
  method: AnomalyMethod,
  threshold = METHODS[method].defaultThreshold,
): { days: ScoredDay[]; stats: MonthStats } {
  const values = days.map((d) => d.revenue);
  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length || 1;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  const median = quantile(sorted, 0.5);
  const mad = quantile(
    values.map((v) => Math.abs(v - median)).sort((a, b) => a - b),
    0.5,
  );
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;

  let lower: number;
  let upper: number;
  let baseline: number;
  if (method === "zscore") {
    lower = mean - threshold * std;
    upper = mean + threshold * std;
    baseline = mean;
  } else if (method === "mad") {
    const span = mad === 0 ? 0 : (threshold * mad) / 0.6745;
    lower = median - span;
    upper = median + span;
    baseline = median;
  } else {
    lower = q1 - threshold * iqr;
    upper = q3 + threshold * iqr;
    baseline = median;
  }

  const scored = days.map<ScoredDay>((d) => {
    const x = d.revenue;
    let score = 0;
    if (method === "zscore") score = std === 0 ? 0 : (x - mean) / std;
    else if (method === "mad") score = mad === 0 ? 0 : (0.6745 * (x - median)) / mad;
    else if (iqr > 0) score = x > q3 ? (x - q3) / iqr : x < q1 ? -(q1 - x) / iqr : 0;

    const isAnomaly = values.length >= 7 && Math.abs(score) >= threshold;
    return {
      ...d,
      score,
      isAnomaly,
      direction: isAnomaly ? (score > 0 ? "spike" : "drop") : null,
      baseline,
      deviationPct: baseline === 0 ? 0 : ((x - baseline) / baseline) * 100,
    };
  });

  return { days: scored, stats: { mean, median, std, mad, q1, q3, lower: Math.max(lower, 0), upper } };
}
