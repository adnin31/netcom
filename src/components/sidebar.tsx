"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity, BarChart3, Database, LayoutDashboard, Menu, PackageX, X,
} from "lucide-react";
import { TABLES } from "@/core/domain/dataset";

const MAIN = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/revenue", label: "Revenue Harian", icon: BarChart3 },
  { href: "/anomalies", label: "Anomali Revenue", icon: Activity },
  { href: "/unshipped", label: "Belum Dikirim", icon: PackageX },
];

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-netred to-rose-500 text-sm font-bold text-white shadow-sm">
        N
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-slate-900">Netcom</p>
        <p className="text-[11px] text-slate-500">Commerce Dashboard</p>
      </div>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const item = (href: string, label: string, Icon: typeof Database) => (
    <Link
      key={href}
      href={href}
      onClick={onNavigate}
      className={clsx(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
        isActive(href)
          ? "bg-brand-50 font-medium text-brand-700"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );

  return (
    <nav className="space-y-6">
      <div className="space-y-1">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Analitik</p>
        {MAIN.map((m) => item(m.href, m.label, m.icon))}
      </div>
      <div className="space-y-1">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Dataset (CRUD)</p>
        {TABLES.map((t) => item(`/data/${t.name}`, t.label, Database))}
      </div>
    </nav>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="px-5 py-5"><Logo /></div>
        <div className="flex-1 overflow-y-auto px-3 pb-6"><NavLinks /></div>
      </aside>

      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <Logo />
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Buka menu"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between px-5 py-5">
              <Logo />
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Tutup menu">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-6"><NavLinks onNavigate={() => setOpen(false)} /></div>
          </aside>
        </div>
      )}
    </>
  );
}
