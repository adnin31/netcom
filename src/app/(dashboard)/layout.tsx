import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { UserMenu } from "@/components/user-menu";
import { Skeleton } from "@/components/ui";
import { getSession } from "@/lib/auth";

async function CurrentUser() {
  const user = await getSession();
  if (!user) redirect("/login");
  return <UserMenu name={user.name} email={user.email} />;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-end border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur sm:px-6 md:justify-between lg:px-8">
          <p className="hidden text-sm text-slate-500 md:block">
            Dataset <span className="font-medium text-slate-700">Olist E-Commerce</span> · Sep 2016 – Okt 2018
          </p>
          <Suspense fallback={<Skeleton className="h-9 w-56" />}>
            <CurrentUser />
          </Suspense>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
