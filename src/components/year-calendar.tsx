import clsx from "clsx";
import Link from "next/link";
import type { ScoredDay } from "@/lib/anomaly";
import { fmtDate, fmtMoney, MONTHS_SHORT } from "@/lib/format";

const SHADES = ["bg-brand-50", "bg-brand-100", "bg-brand-200", "bg-brand-500/70", "bg-brand-600"];

/** 12 mini month calendars; colour = revenue level, ring = anomaly. */
export function YearCalendar({ year, days, query }: { year: number; days: ScoredDay[]; query: string }) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const sorted = days.map((d) => d.revenue).filter((v) => v > 0).sort((a, b) => a - b);
  const cut = [0.2, 0.4, 0.6, 0.8].map((q) => sorted[Math.floor((sorted.length - 1) * q)] ?? 0);
  const shade = (v: number) => SHADES[cut.filter((c) => v > c).length];

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MONTHS_SHORT.map((label, mi) => {
          const first = new Date(Date.UTC(year, mi, 1)).getUTCDay();
          const count = new Date(Date.UTC(year, mi + 1, 0)).getUTCDate();
          return (
            <div key={label}>
              <p className="mb-1.5 text-xs font-semibold text-slate-700">{label} {year}</p>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: first }).map((_, i) => <span key={`e${i}`} />)}
                {Array.from({ length: count }).map((_, di) => {
                  const date = `${year}-${String(mi + 1).padStart(2, "0")}-${String(di + 1).padStart(2, "0")}`;
                  const d = byDate.get(date);
                  if (!d) return <span key={date} className="aspect-square rounded bg-slate-100/60" title={`${fmtDate(date)}: di luar data`} />;
                  return (
                    <Link
                      key={date}
                      href={`/anomalies?${query}&month=${mi + 1}&date=${date}`}
                      title={`${fmtDate(date)} · ${fmtMoney(d.revenue)}${d.isAnomaly ? ` · anomali (${d.score.toFixed(1)})` : ""}`}
                      className={clsx(
                        "grid aspect-square place-items-center rounded text-[9px] transition hover:scale-110",
                        d.revenue === 0 ? "bg-slate-100 text-slate-400" : shade(d.revenue),
                        cut[2] && d.revenue > cut[2] ? "text-white" : "text-slate-600",
                        d.direction === "spike" && "ring-2 ring-rose-500 ring-offset-1",
                        d.direction === "drop" && "ring-2 ring-amber-500 ring-offset-1",
                      )}
                    >
                      {di + 1}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">Rendah {SHADES.map((s) => <span key={s} className={clsx("size-3 rounded", s)} />)} Tinggi</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded ring-2 ring-rose-500" /> Lonjakan</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded ring-2 ring-amber-500" /> Penurunan</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-slate-100/60" /> Di luar cakupan data</span>
      </div>
    </div>
  );
}
