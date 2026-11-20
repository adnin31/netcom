"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium text-slate-900">{name}</p>
        <p className="text-xs text-slate-500">{email}</p>
      </div>
      <span className="grid size-9 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white">
        {name.charAt(0).toUpperCase()}
      </span>
      <button
        onClick={logout}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
      >
        <LogOut className="size-4" /> Keluar
      </button>
    </div>
  );
}
