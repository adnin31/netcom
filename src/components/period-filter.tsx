"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { METHODS, type AnomalyMethod } from "@/core/domain/anomaly";
import { MONTHS } from "@/components/format";

type Props = {
  years: number[];
  periods: { year: number; month: number }[];
  /** Current values, also used as the base for the next URL. */
  current: Record<string, string>;
  allowAllMonths?: boolean;
  showMethod?: boolean;
};

const select =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

export function PeriodFilter({ years, periods, current, allowAllMonths, showMethod }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const year = Number(current.year);
  const months = periods.filter((p) => p.year === year).map((p) => p.month);

  function update(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...current, ...patch })) {
      if (v !== undefined && v !== "") next.set(k, v);
    }
    // A specific day only makes sense inside the selected month.
    if (patch.year || patch.month) next.delete("date");
    // Keep the month valid when switching years.
    if (patch.year && next.get("month") && next.get("month") !== "all") {
      const valid = periods.filter((p) => p.year === Number(patch.year)).map((p) => p.month);
      if (!valid.includes(Number(next.get("month")))) next.set("month", String(valid[valid.length - 1]));
    }
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Tahun" className={select} value={current.year} onChange={(e) => update({ year: e.target.value })}>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <select aria-label="Bulan" className={select} value={current.month} onChange={(e) => update({ month: e.target.value })}>
        {allowAllMonths && <option value="all">Semua bulan</option>}
        {months.map((m) => <option key={m} value={m}>{MONTHS[m - 1]}</option>)}
      </select>
      {showMethod && (
        <>
          <select
            aria-label="Metode"
            className={select}
            value={current.method}
            onChange={(e) => update({ method: e.target.value, threshold: undefined })}
          >
            {(Object.keys(METHODS) as AnomalyMethod[]).map((m) => (
              <option key={m} value={m}>{METHODS[m].label}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm">
            Ambang
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="10"
              defaultValue={current.threshold}
              key={current.method + current.threshold}
              onBlur={(e) => e.target.value !== current.threshold && update({ threshold: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && update({ threshold: (e.target as HTMLInputElement).value })}
              className="w-16 bg-transparent text-slate-900 outline-none"
            />
          </label>
        </>
      )}
      {pending && <Loader2 className="size-4 animate-spin text-slate-400" />}
    </div>
  );
}
