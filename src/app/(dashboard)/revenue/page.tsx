import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowDownRight, ArrowUpRight, Banknote, CalendarDays, ShoppingBag, TrendingUp } from "lucide-react";
import { DailyRevenueChart, MonthlyTrendChart } from "@/components/charts";
import { PeriodFilter } from "@/components/period-filter";
import { Card, CardHeader, EmptyState, Kpi, PageHeader, PageSkeleton } from "@/components/ui";
import { getAvailablePeriods, getDailyRevenue, getMonthlyRevenue } from "@/lib/analytics";
import { fmtDate, fmtMoney, fmtMoneyShort, fmtNumber, fmtPct, MONTHS } from "@/lib/format";
import { DEFAULT_MONTH, DEFAULT_YEAR, int, type SearchParams } from "@/lib/params";

export const metadata: Metadata = { title: "Revenue Harian" };

export default function RevenuePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader
        title="Revenue Harian"
        subtitle="Grafik revenue per hari berdasarkan bulan dan tahun. Revenue = total pembayaran pesanan (kecuali canceled/unavailable) pada tanggal pembelian."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Revenue searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Revenue({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const year = int(sp.year, DEFAULT_YEAR, 2000, 2100);
  const month = int(sp.month, DEFAULT_MONTH, 1, 12);

  const [{ years, periods }, days, monthly] = await Promise.all([
    getAvailablePeriods(),
    getDailyRevenue(year, month),
    getMonthlyRevenue(year),
  ]);

  const total = days.reduce((s, d) => s + d.revenue, 0);
  const orders = days.reduce((s, d) => s + d.orders, 0);
  const activeDays = days.filter((d) => d.orders > 0);
  const avg = activeDays.length ? total / activeDays.length : 0;
  const best = activeDays.reduce<typeof days[number] | null>((b, d) => (!b || d.revenue > b.revenue ? d : b), null);
  const worst = activeDays.reduce<typeof days[number] | null>((b, d) => (!b || d.revenue < b.revenue ? d : b), null);

  const prevKey = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
  const prevMonthly = month === 1 ? await getMonthlyRevenue(year - 1) : monthly;
  const prev = prevMonthly.find((m) => m.month === prevKey);
  const growth = prev && prev.revenue > 0 ? ((total - prev.revenue) / prev.revenue) * 100 : null;

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-slate-600">
          Periode: <span className="font-semibold text-slate-900">{MONTHS[month - 1]} {year}</span>
        </p>
        <PeriodFilter years={years} periods={periods} current={{ year: String(year), month: String(month) }} />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Revenue bulan ini"
          value={fmtMoneyShort(total)}
          hint={growth === null ? fmtMoney(total) : (
            <span className={growth >= 0 ? "text-emerald-600" : "text-rose-600"}>
              {growth >= 0 ? <ArrowUpRight className="inline size-3.5" /> : <ArrowDownRight className="inline size-3.5" />}
              {fmtPct(growth)} vs bulan lalu
            </span>
          )}
          icon={Banknote}
        />
        <Kpi label="Orders" value={fmtNumber(orders)} hint={`${activeDays.length} hari aktif`} icon={ShoppingBag} tone="violet" />
        <Kpi label="Rata-rata harian" value={fmtMoneyShort(avg)} hint={orders ? `${fmtMoney(total / orders)} / order` : "—"} icon={CalendarDays} tone="green" />
        <Kpi
          label="Hari terbaik"
          value={best ? fmtMoneyShort(best.revenue) : "—"}
          hint={best ? fmtDate(best.date) : "Tidak ada data"}
          icon={TrendingUp}
          tone="amber"
        />
      </div>

      <Card>
        <CardHeader
          title={`Revenue harian · ${MONTHS[month - 1]} ${year}`}
          subtitle="Batang = revenue, garis = jumlah order. Garis putus-putus = rata-rata hari aktif."
          action={
            <Link href={`/anomalies?year=${year}&month=${month}`} className="text-sm font-medium text-brand-600 hover:underline">
              Cek anomali bulan ini →
            </Link>
          }
        />
        <div className="p-4">
          {activeDays.length === 0 ? (
            <EmptyState title="Tidak ada transaksi pada periode ini" />
          ) : (
            <DailyRevenueChart data={days} average={avg} />
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title={`Revenue bulanan ${year}`} subtitle="Klik bulan untuk berpindah periode" />
          <div className="p-4"><MonthlyTrendChart data={monthly} /></div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Rincian harian" subtitle={worst ? `Terendah: ${fmtDate(worst.date)} (${fmtMoney(worst.revenue)})` : undefined} />
          <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-2 font-medium">Tanggal</th><th className="px-4 py-2 text-right font-medium">Orders</th><th className="px-4 py-2 text-right font-medium">Revenue</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {days.map((d) => (
                  <tr key={d.date} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-600">{fmtDate(d.date)}</td>
                    <td className="tabular px-4 py-2 text-right">{fmtNumber(d.orders)}</td>
                    <td className="tabular px-4 py-2 text-right font-medium text-slate-900">{fmtMoney(d.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
