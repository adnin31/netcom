import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Login" };

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-slate-950 lg:block">
        <div className="absolute -left-24 -top-24 size-96 rounded-full bg-netred/40 blur-3xl" />
        <div className="absolute -bottom-32 right-0 size-[28rem] rounded-full bg-brand-600/40 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-netred to-rose-500 font-bold">N</span>
            <span className="text-lg font-semibold">Netcom Dashboard</span>
          </div>
          <div className="max-w-md">
            <h1 className="text-4xl font-semibold leading-tight">
              Pantau revenue, deteksi anomali, dan kelola pesanan di satu tempat.
            </h1>
            <p className="mt-4 text-slate-300">
              99 ribu pesanan, 1 juta titik geolokasi, dan 9 dataset siap dianalisis dan dikelola.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {[["9", "Dataset"], ["99 rb", "Orders"], ["1 jt", "Geolokasi"]].map(([v, l]) => (
              <div key={l} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-xl font-semibold">{v}</p>
                <p className="text-slate-400">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Masuk ke dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">Gunakan akun admin untuk melanjutkan.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
