"use client";

import clsx from "clsx";
import {
  ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, RefreshCw, Search, Trash2, X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { fmtNumber } from "@/lib/format";
import { getTable, type Column } from "@/lib/tables";
import { Card } from "./ui";

type Row = Record<string, string | number | null>;
type ListResponse = { rows: Row[]; total: number; page: number; pageSize: number; sort: string; dir: "asc" | "desc" };

const input =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-500";

function display(c: Column, v: Row[string]) {
  if (v === null || v === undefined || v === "") return <span className="text-slate-300">—</span>;
  if (c.type === "money") return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  if (c.type === "id") return <span className="font-mono text-xs">{String(v)}</span>;
  if (c.type === "longtext") return <span className="line-clamp-2 max-w-xs">{String(v)}</span>;
  return String(v);
}

export function DataTable({ tableName }: { tableName: string }) {
  const table = getTable(tableName)!;
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState(table.defaultSort);
  const [editing, setEditing] = useState<{ mode: "create" | "edit"; row?: Row } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      q: search, page: String(page), pageSize: String(pageSize), sort: sort.column, dir: sort.dir,
    });
    const res = await fetch(`/api/data/${tableName}?${params}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) setError(body.error ?? "Gagal memuat data");
    else setData(body);
    setLoading(false);
  }, [tableName, search, page, pageSize, sort]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on query change
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const keyOf = (row: Row) => Object.fromEntries(table.primaryKey.map((k) => [k, row[k]]));

  async function remove(row: Row) {
    const label = table.primaryKey.map((k) => row[k]).join(" / ");
    if (!confirm(`Hapus data ${label}? Tindakan ini tidak bisa dibatalkan.`)) return;
    const res = await fetch(`/api/data/${tableName}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: keyOf(row) }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return alert(body.error ?? "Gagal menghapus");
    setToast("Data berhasil dihapus");
    load();
  }

  const listColumns = table.columns.filter((c) => !c.hideInList);
  const pages = data ? Math.max(Math.ceil(data.total / data.pageSize), 1) : 1;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <form
          onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(q.trim()); }}
          className="flex flex-1 items-center gap-2"
        >
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Cari ${table.searchable.join(", ")}`}
              className={`${input} pl-9`}
            />
          </div>
          {search && (
            <button type="button" onClick={() => { setQ(""); setSearch(""); setPage(1); }} className="text-sm text-slate-500 hover:text-slate-700">
              Reset
            </button>
          )}
        </form>
        <div className="flex items-center gap-2">
          <button onClick={load} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Muat ulang">
            <RefreshCw className={clsx("size-4", loading && "animate-spin")} />
          </button>
          <button
            onClick={() => setEditing({ mode: "create" })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus className="size-4" /> Tambah
          </button>
        </div>
      </div>

      {error && <p className="mx-5 mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

      <div className="relative overflow-x-auto">
        {loading && data && <div className="absolute inset-0 z-10 bg-white/50" />}
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {listColumns.map((c) => {
                const active = sort.column === c.name;
                return (
                  <th key={c.name} className="whitespace-nowrap px-4 py-2.5 font-medium">
                    <button
                      onClick={() => { setPage(1); setSort({ column: c.name, dir: active && sort.dir === "asc" ? "desc" : "asc" }); }}
                      className={clsx("inline-flex items-center gap-1 uppercase hover:text-slate-900", active && "text-slate-900")}
                    >
                      {c.label}
                      {active && (sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                    </button>
                  </th>
                );
              })}
              <th className="px-4 py-2.5 text-right font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!data && loading && Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                <td colSpan={listColumns.length + 1} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-slate-100" /></td>
              </tr>
            ))}
            {data?.rows.length === 0 && (
              <tr><td colSpan={listColumns.length + 1} className="px-4 py-12 text-center text-slate-500">Tidak ada data.</td></tr>
            )}
            {data?.rows.map((row) => (
              <tr key={table.primaryKey.map((k) => row[k]).join("|")} className="hover:bg-slate-50">
                {listColumns.map((c) => (
                  <td key={c.name} className={clsx("whitespace-nowrap px-4 py-2.5 text-slate-700", (c.type === "money" || c.type === "int" || c.type === "float") && "tabular text-right")}>
                    {display(c, row[c.name])}
                  </td>
                ))}
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  <button onClick={() => setEditing({ mode: "edit", row })} className="rounded-md p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600" aria-label="Edit">
                    <Pencil className="size-4" />
                  </button>
                  <button onClick={() => remove(row)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Hapus">
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
        <span>
          {data ? `${fmtNumber((data.page - 1) * data.pageSize + (data.rows.length ? 1 : 0))}–${fmtNumber((data.page - 1) * data.pageSize + data.rows.length)} dari ${fmtNumber(data.total)} baris` : "Memuat…"}
        </span>
        <div className="flex items-center gap-2">
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
            {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} / halaman</option>)}
          </select>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40" aria-label="Sebelumnya">
            <ChevronLeft className="size-4" />
          </button>
          <span className="tabular">{page} / {fmtNumber(pages)}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40" aria-label="Berikutnya">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {editing && (
        <RecordForm
          tableName={tableName}
          mode={editing.mode}
          row={editing.row}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); setToast(msg); load(); }}
        />
      )}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">{toast}</div>
      )}
    </Card>
  );
}

function RecordForm({ tableName, mode, row, onClose, onSaved }: {
  tableName: string; mode: "create" | "edit"; row?: Row; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const table = getTable(tableName)!;
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fields = table.columns.filter((c) => !(c.auto && mode === "create"));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const values = Object.fromEntries(fields.filter((c) => !c.auto).map((c) => [c.name, form.get(c.name)]));
    const key = row ? Object.fromEntries(table.primaryKey.map((k) => [k, row[k]])) : undefined;
    const res = await fetch(`/api/data/${tableName}`, {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, values }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(body.detail ? `${body.error}. ${body.detail}` : body.error ?? "Gagal menyimpan");
    onSaved(mode === "create" ? "Data berhasil ditambahkan" : "Perubahan disimpan");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <form
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="font-semibold text-slate-900">{mode === "create" ? "Tambah" : "Edit"} {table.label}</h3>
            <p className="text-xs text-slate-500">Kolom bertanda * wajib diisi{mode === "edit" ? " · primary key tidak dapat diubah" : ""}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Tutup"><X className="size-5" /></button>
        </div>
        <div className="grid flex-1 gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
          {fields.map((c) => {
            const locked = c.auto || (mode === "edit" && table.primaryKey.includes(c.name));
            const value = row?.[c.name] ?? "";
            return (
              <label key={c.name} className={clsx("block", c.type === "longtext" && "sm:col-span-2")}>
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  {c.label}{c.required && <span className="text-rose-500"> *</span>}
                  <span className="ml-1 font-normal text-slate-400">{c.name}</span>
                </span>
                {c.type === "select" ? (
                  <select name={c.name} defaultValue={String(value)} required={c.required} disabled={locked} className={input}>
                    {!c.required && <option value="">—</option>}
                    {c.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : c.type === "longtext" ? (
                  <textarea name={c.name} defaultValue={String(value)} rows={3} disabled={locked} className={input} />
                ) : (
                  <input
                    name={c.name}
                    defaultValue={String(value)}
                    required={c.required}
                    disabled={locked}
                    maxLength={c.maxLength}
                    inputMode={["int", "float", "money"].includes(c.type) ? "decimal" : undefined}
                    placeholder={c.type === "timestamp" ? "YYYY-MM-DD HH:MM:SS" : c.type === "id" ? "32 karakter hex" : undefined}
                    className={clsx(input, c.type === "id" && "font-mono text-xs")}
                  />
                )}
                {c.ref && <span className="mt-1 block text-[11px] text-slate-400">Harus ada di tabel {c.ref}</span>}
              </label>
            );
          })}
        </div>
        {error && <p className="mx-6 mb-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Batal</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
            {saving && <Loader2 className="size-4 animate-spin" />} Simpan
          </button>
        </div>
      </form>
    </div>
  );
}
