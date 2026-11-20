"use client";

import { Loader2, Search, Truck } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MONTHS } from "@/lib/format";

const field =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

export function UnshippedFilters({ current, years, statuses }: {
  current: Record<string, string>; years: number[]; statuses: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(current.q ?? "");

  function update(patch: Record<string, string>) {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...current, ...patch, page: patch.page ?? "1" })) if (v) next.set(k, v);
    if (patch.year === "") next.delete("month");
    start(() => router.push(`${pathname}?${next}`, { scroll: false }));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => { e.preventDefault(); update({ q }); }}
        className="relative"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari order / customer ID" className={`${field} w-56 pl-9`} />
      </form>
      <select aria-label="Status" className={field} value={current.status ?? ""} onChange={(e) => update({ status: e.target.value })}>
        <option value="">Semua status</option>
        {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select aria-label="Tahun" className={field} value={current.year ?? ""} onChange={(e) => update({ year: e.target.value })}>
        <option value="">Semua tahun</option>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <select aria-label="Bulan" className={field} value={current.month ?? ""} disabled={!current.year} onChange={(e) => update({ month: e.target.value })}>
        <option value="">Semua bulan</option>
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select aria-label="Urutkan" className={field} value={current.sort ?? "oldest"} onChange={(e) => update({ sort: e.target.value })}>
        <option value="oldest">Terlama menunggu</option>
        <option value="newest">Terbaru</option>
        <option value="value">Nilai terbesar</option>
      </select>
      {pending && <Loader2 className="size-4 animate-spin text-slate-400" />}
    </div>
  );
}

export function ShipButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function ship() {
    if (!confirm(`Tandai order ${orderId.slice(0, 8)}… sebagai dikirim (status → shipped)?`)) return;
    setBusy(true);
    const res = await fetch(`/api/orders/${orderId}/ship`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error ?? "Gagal memperbarui order");
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={ship}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Truck className="size-3.5" />} Kirim
    </button>
  );
}
