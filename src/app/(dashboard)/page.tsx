import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Banknote, PackageX, ShoppingBag, Star, Store, Users } from "lucide-react";
import { DonutChart, HorizontalBarChart, MonthlyTrendChart } from "@/components/charts";
import { Card, CardHeader, Kpi, PageHeader, PageSkeleton } from "@/components/ui";
import { getMonthlyRevenue, getOverview } from "@/lib/analytics";
import { fmtMoney, fmtMoneyShort, fmtNumber } from "@/lib/format";

export default function OverviewPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Ringkasan performa toko: revenue, pesanan, kategori terlaris, dan status pengiriman."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Overview />
      </Suspense>
    </>
  );
}

async function Overview() {
  const [{ kpi, status, categories, payments, states }, monthly] = await Promise.all([
    getOverview(),
    getMonthlyRevenue(),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total revenue" value={fmtMoneyShort(kpi.revenue)} hint={fmtMoney(kpi.revenue)} icon={Banknote} />
        <Kpi label="Total orders" value={fmtNumber(kpi.orders)} hint={`Rata-rata ${fmtMoney(kpi.revenue / kpi.orders)} / order`} icon={ShoppingBag} tone="violet" />
        <Kpi label="Pelanggan unik" value={fmtNumber(kpi.customers)} hint={`${fmtNumber(kpi.sellers)} seller · ${fmtNumber(kpi.products)} produk`} icon={Users} tone="green" />
        <Kpi label="Belum dikirim" value={fmtNumber(kpi.unshipped)} hint={<Link href="/unshipped" className="text-brand-600 hover:underline">Lihat daftar →</Link>} icon={PackageX} tone="red" />
      </div>

      <Card>
        <CardHeader
          title="Tren revenue bulanan"
          subtitle="Klik titik bulan untuk melihat grafik revenue hariannya."
          action={
            <Link href="/revenue" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
              Revenue harian <ArrowRight className="size-4" />
            </Link>
          }
        />
        <div className="p-4"><MonthlyTrendChart data={monthly} /></div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Kategori terlaris" subtitle="Berdasarkan total harga item" />
          <div className="p-4">
            <HorizontalBarChart data={categories.map((c) => ({ label: c.category.replaceAll("_", " "), value: c.revenue }))} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Status pesanan" subtitle="Distribusi seluruh pesanan" />
          <div className="p-5"><DonutChart data={status.map((s) => ({ label: s.status, value: s.count }))} /></div>
        </Card>
        <Card>
          <CardHeader title="Metode pembayaran" subtitle="Berdasarkan nilai transaksi" />
          <div className="p-5">
            <ul className="space-y-3">
              {payments.map((p) => {
                const total = payments.reduce((s, x) => s + x.value, 0);
                const pct = (p.value / total) * 100;
                return (
                  <li key={p.type}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-slate-600">{p.type.replaceAll("_", " ")}</span>
                      <span className="tabular text-slate-900">{fmtMoneyShort(p.value)} <span className="text-xs text-slate-400">{pct.toFixed(1)}%</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.max(pct, 0.5)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>
        <Card>
          <CardHeader title="Top 10 negara bagian" subtitle="Jumlah pesanan berdasarkan lokasi pelanggan" />
          <div className="p-4">
            <HorizontalBarChart money={false} data={states.map((s) => ({ label: s.state, value: s.orders }))} />
          </div>
        </Card>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-600"><Star className="size-5" /></span>
          <div>
            <p className="text-sm font-medium text-slate-900">Rata-rata skor ulasan {kpi.avg_review.toFixed(2)} / 5</p>
            <p className="text-xs text-slate-500">Dari seluruh ulasan pelanggan</p>
          </div>
        </div>
        <Link href="/data/order_reviews" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
          <Store className="size-4" /> Kelola ulasan
        </Link>
      </Card>
    </div>
  );
}
