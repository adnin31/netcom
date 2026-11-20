import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, Banknote, Clock, PackageX } from "lucide-react";
import { ShipButton, UnshippedFilters } from "@/components/unshipped-controls";
import { Badge, Card, CardHeader, EmptyState, Kpi, PageHeader, PageSkeleton, StatusBadge } from "@/components/ui";
import { getAvailablePeriods, getUnshipped } from "@/lib/analytics";
import { fmtMoney, fmtMoneyShort, fmtNumber } from "@/lib/format";
import { int, str, type SearchParams } from "@/lib/params";

export const metadata: Metadata = { title: "Belum Dikirim" };

const STATUSES = ["created", "approved", "invoiced", "processing"];

export default function UnshippedPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader
        title="Pesanan Belum Dikirim"
        subtitle="Pesanan yang belum diserahkan ke kurir (order_delivered_carrier_date kosong), tidak termasuk yang dibatalkan/unavailable. Umur pesanan dihitung terhadap tanggal terakhir dataset."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Unshipped searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Unshipped({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const status = STATUSES.includes(str(sp.status) ?? "") ? str(sp.status) : undefined;
  const year = int(sp.year, 0, 2000, 2100) || undefined;
  const month = year ? int(sp.month, 0, 1, 12) || undefined : undefined;
  const sortRaw = str(sp.sort);
  const sort = sortRaw === "newest" || sortRaw === "value" ? sortRaw : "oldest";
  const q = str(sp.q)?.trim().slice(0, 32) || undefined;
  const page = int(sp.page, 1, 1);

  const [{ years }, data] = await Promise.all([
    getAvailablePeriods(),
    getUnshipped({ status, year, month, sort, q, page, pageSize: 20 }),
  ]);
  const pages = Math.max(Math.ceil(data.total / data.pageSize), 1);
  const overdue = data.rows.filter((r) => r.overdue).length;
  const allUnshipped = data.byStatus.reduce((s, x) => s + x.count, 0);

  const current: Record<string, string> = {
    ...(q ? { q } : {}), ...(status ? { status } : {}), ...(year ? { year: String(year) } : {}),
    ...(month ? { month: String(month) } : {}), sort,
  };
  const pageHref = (p: number) => `/unshipped?${new URLSearchParams({ ...current, page: String(p) })}`;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total belum dikirim" value={fmtNumber(allUnshipped)} hint="Seluruh periode" icon={PackageX} tone="red" />
        <Kpi label="Sesuai filter" value={fmtNumber(data.total)} hint={`Nilai ${fmtMoney(data.totalValue)}`} icon={Banknote} />
        {data.byStatus.slice(0, 2).map((s, i) => (
          <Kpi key={s.status} label={`Status ${s.status}`} value={fmtNumber(s.count)} hint={`${((s.count / allUnshipped) * 100).toFixed(1)}% dari total`} icon={i ? Clock : AlertTriangle} tone={i ? "amber" : "violet"} />
        ))}
      </div>

      <Card>
        <CardHeader
          title="Daftar pesanan"
          subtitle={`${fmtNumber(data.total)} pesanan · halaman ${data.page} dari ${pages}${overdue ? ` · ${overdue} lewat estimasi di halaman ini` : ""}`}
          action={<UnshippedFilters current={current} years={years} statuses={STATUSES} />}
        />
        {data.rows.length === 0 ? (
          <EmptyState title="Tidak ada pesanan yang cocok">Ubah filter untuk melihat pesanan lain.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Order</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium">Dibeli</th>
                  <th className="px-5 py-2.5 font-medium">Estimasi tiba</th>
                  <th className="px-5 py-2.5 font-medium">Pelanggan</th>
                  <th className="px-5 py-2.5 text-right font-medium">Item</th>
                  <th className="px-5 py-2.5 text-right font-medium">Nilai</th>
                  <th className="px-5 py-2.5 text-right font-medium">Menunggu</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((r) => (
                  <tr key={r.order_id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-mono text-xs text-slate-900">{r.order_id}</p>
                      <p className="font-mono text-[11px] text-slate-400">cust {r.customer_id.slice(0, 12)}…</p>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={r.order_status} /></td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">{r.purchased}</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span className="text-slate-600">{r.estimated ?? "—"}</span>
                      {r.overdue && <span className="ml-2"><Badge tone="red">lewat</Badge></span>}
                    </td>
                    <td className="px-5 py-3 text-slate-600"><span className="capitalize">{r.city}</span>, {r.state}</td>
                    <td className="tabular px-5 py-3 text-right">{r.items}</td>
                    <td className="tabular whitespace-nowrap px-5 py-3 text-right font-medium text-slate-900">{fmtMoneyShort(r.order_value)}</td>
                    <td className="tabular whitespace-nowrap px-5 py-3 text-right">
                      <span className={r.days_waiting > 30 ? "font-medium text-rose-600" : "text-slate-600"}>{fmtNumber(r.days_waiting)} hari</span>
                    </td>
                    <td className="px-5 py-3 text-right"><ShipButton orderId={r.order_id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm">
          <span className="text-slate-500">Menampilkan {data.rows.length} dari {fmtNumber(data.total)}</span>
          <div className="flex gap-2">
            {data.page > 1 && <Link scroll={false} href={pageHref(data.page - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">← Sebelumnya</Link>}
            {data.page < pages && <Link scroll={false} href={pageHref(data.page + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">Berikutnya →</Link>}
          </div>
        </div>
      </Card>
    </div>
  );
}
