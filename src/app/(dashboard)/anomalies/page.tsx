import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Info, Sigma, X } from "lucide-react";
import { AnomalyChart, HorizontalBarChart } from "@/components/charts";
import { PeriodFilter } from "@/components/period-filter";
import { Badge, Card, CardHeader, EmptyState, Kpi, PageHeader, PageSkeleton } from "@/components/ui";
import { YearCalendar } from "@/components/year-calendar";
import { getUseCases } from "@/infrastructure/container";
import { isAnomalyMethod, METHODS, type ScoredDay } from "@/core/domain/anomaly";
import { fmtDate, fmtMoney, fmtMoneyShort, fmtNumber, fmtPct, MONTHS } from "@/components/format";
import { DEFAULT_MONTH, DEFAULT_YEAR, int, str, type SearchParams } from "@/app/(dashboard)/search-params";

export const metadata: Metadata = { title: "Anomali Revenue" };

export default function AnomaliesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader
        title="Anomali Revenue Harian"
        subtitle="Deteksi hari dengan total revenue yang menyimpang dari pola normal bulan tersebut. Pilih tahun, bulan, lalu klik tanggal untuk melihat detailnya."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Anomalies searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Anomalies({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const year = int(sp.year, DEFAULT_YEAR, 2000, 2100);
  const allMonths = str(sp.month) === "all";
  const month = allMonths ? null : int(sp.month, DEFAULT_MONTH, 1, 12);
  const methodRaw = str(sp.method);
  const method = isAnomalyMethod(methodRaw) ? methodRaw : "mad";
  const { detectRevenueAnomalies } = await getUseCases();
  const r = await detectRevenueAnomalies.execute({
    year, month, method, threshold: Number(str(sp.threshold)) || undefined, date: str(sp.date) ?? null,
  });
  const { threshold, anomalies, spikes, selected, availableYears: years, periods } = r;
  const shownDays = r.days;
  const allScored = r.yearDays;
  const date = selected?.date ?? null;
  const view = r.monthStats;

  const query = new URLSearchParams({ year: String(year), method, threshold: String(threshold) }).toString();
  const current = { year: String(year), month: month ? String(month) : "all", method, threshold: String(threshold) };
  const periodLabel = month ? `${MONTHS[month - 1]} ${year}` : `Tahun ${year}`;

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-slate-600">
          Periode: <span className="font-semibold text-slate-900">{periodLabel}</span>
        </p>
        <PeriodFilter years={years} periods={periods} current={current} allowAllMonths showMethod />
      </Card>

      <div className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-slate-600">
        <Info className="mt-0.5 size-4 shrink-0 text-brand-600" />
        <p>
          <span className="font-medium text-slate-900">{METHODS[method].label}</span> — {METHODS[method].help} Setiap hari dibandingkan
          dengan hari-hari lain di bulan yang sama (minimal 7 hari data). Ambang saat ini: <b>{threshold}</b>.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Hari anomali" value={fmtNumber(anomalies.length)} hint={`dari ${shownDays.length} hari teranalisis`} icon={Activity} tone="red" />
        <Kpi label="Lonjakan" value={fmtNumber(spikes)} hint="Revenue jauh di atas normal" icon={ArrowUpRight} tone="amber" />
        <Kpi label="Penurunan" value={fmtNumber(r.drops)} hint="Revenue jauh di bawah normal" icon={ArrowDownRight} tone="violet" />
        <Kpi
          label={month ? "Baseline harian" : "Revenue setahun"}
          value={month ? fmtMoneyShort(view?.baseline ?? 0) : fmtMoneyShort(shownDays.reduce((s, d) => s + d.revenue, 0))}
          hint={month && view ? `Rentang normal ${fmtMoneyShort(view.lower)} – ${fmtMoneyShort(view.upper)}` : `${shownDays.length} hari data`}
          icon={Sigma}
          tone="green"
        />
      </div>

      {selected && <DayDetail day={selected} closeHref={`/anomalies?${query}&month=${month ?? "all"}`} />}

      {month ? (
        <Card>
          <CardHeader
            title={`Revenue harian & rentang normal · ${periodLabel}`}
            subtitle="Area hijau = rentang normal. Titik merah = anomali. Klik titik untuk detail tanggal."
          />
          <div className="p-4">
            {view ? (
              <AnomalyChart
                data={shownDays}
                lower={view.lower}
                upper={view.upper}
                baseline={view.baseline}
                baseQuery={`${query}&month=${month}`}
              />
            ) : (
              <EmptyState title="Data tidak cukup">Bulan ini memiliki kurang dari 7 hari data di dalam cakupan dataset.</EmptyState>
            )}
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader title={`Kalender revenue ${year}`} subtitle="Warna = level revenue. Cincin merah/oranye = anomali. Klik tanggal untuk detail." />
          <div className="p-5"><YearCalendar year={year} days={allScored} query={query} /></div>
        </Card>
      )}

      <Card>
        <CardHeader title={`Daftar anomali · ${periodLabel}`} subtitle="Diurutkan dari penyimpangan terbesar" />
        {anomalies.length === 0 ? (
          <EmptyState title="Tidak ada anomali">Coba turunkan ambang atau ganti metode deteksi.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Tanggal</th>
                  <th className="px-5 py-2.5 font-medium">Jenis</th>
                  <th className="px-5 py-2.5 text-right font-medium">Revenue</th>
                  <th className="px-5 py-2.5 text-right font-medium">Baseline</th>
                  <th className="px-5 py-2.5 text-right font-medium">Deviasi</th>
                  <th className="px-5 py-2.5 text-right font-medium">Orders</th>
                  <th className="px-5 py-2.5 text-right font-medium">Skor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {anomalies.map((d) => (
                  <tr key={d.date} className={d.date === date ? "bg-brand-50/60" : "hover:bg-slate-50"}>
                    <td className="px-5 py-2.5">
                      <Link
                        href={`/anomalies?${query}&month=${month ?? "all"}&date=${d.date}`}
                        scroll={false}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        {fmtDate(d.date)}
                      </Link>
                    </td>
                    <td className="px-5 py-2.5">
                      {d.direction === "spike" ? <Badge tone="red">▲ Lonjakan</Badge> : <Badge tone="amber">▼ Penurunan</Badge>}
                    </td>
                    <td className="tabular px-5 py-2.5 text-right font-medium text-slate-900">{fmtMoney(d.revenue)}</td>
                    <td className="tabular px-5 py-2.5 text-right text-slate-500">{fmtMoney(d.baseline)}</td>
                    <td className={`tabular px-5 py-2.5 text-right ${d.deviationPct >= 0 ? "text-rose-600" : "text-amber-600"}`}>{fmtPct(d.deviationPct)}</td>
                    <td className="tabular px-5 py-2.5 text-right">{fmtNumber(d.orders)}</td>
                    <td className="tabular px-5 py-2.5 text-right">{d.score.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

async function DayDetail({ day, closeHref }: { day: ScoredDay; closeHref: string }) {
  const { getDayBreakdown } = await getUseCases();
  const detail = await getDayBreakdown.execute(day.date);
  return (
    <Card className={day.isAnomaly ? "ring-2 ring-rose-200" : undefined}>
      <CardHeader
        title={`Detail ${fmtDate(day.date)}`}
        subtitle={day.isAnomaly
          ? `Anomali: ${day.direction === "spike" ? "lonjakan" : "penurunan"} ${fmtPct(day.deviationPct)} dari baseline bulan ini`
          : "Hari ini berada dalam rentang normal"}
        action={
          <Link href={closeHref} scroll={false} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Tutup">
            <X className="size-4" />
          </Link>
        }
      />
      <div className="grid gap-6 p-5 lg:grid-cols-3">
        <dl className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-1">
          {[
            ["Revenue", fmtMoney(day.revenue)],
            ["Baseline bulan ini", fmtMoney(day.baseline)],
            ["Orders", fmtNumber(day.orders)],
            ["Rata-rata per order", fmtMoney(detail.avgOrderValue)],
            ["Order terbesar", fmtMoney(detail.maxOrderValue)],
            ["Skor anomali", day.score.toFixed(2)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-slate-500">{k}</dt>
              <dd className="tabular font-semibold text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="lg:col-span-2">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Kategori penyumbang revenue</p>
          {detail.categories.length ? (
            <HorizontalBarChart data={detail.categories.map((c) => ({ label: c.category.replaceAll("_", " "), value: c.revenue }))} />
          ) : (
            <p className="text-sm text-slate-500">Tidak ada transaksi.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {detail.statuses.map((s) => <Badge key={s.status}>{s.status}: {s.count}</Badge>)}
          </div>
        </div>
      </div>
    </Card>
  );
}
