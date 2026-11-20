import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DataTable } from "@/components/data-table";
import { PageHeader, Skeleton } from "@/components/ui";
import { getTable, TABLES } from "@/lib/tables";

type Props = { params: Promise<{ table: string }> };

export function generateStaticParams() {
  return TABLES.map((t) => ({ table: t.name }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getTable((await params).table);
  return { title: t ? t.label : "Data" };
}

export default function DataPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-[600px]" />}>
      <TableView params={params} />
    </Suspense>
  );
}

async function TableView({ params }: Props) {
  const table = getTable((await params).table);
  if (!table) notFound();
  return (
    <>
      <PageHeader title={table.label} subtitle={`${table.description} Tabel: ${table.name}`} />
      <DataTable key={table.name} tableName={table.name} />
    </>
  );
}
