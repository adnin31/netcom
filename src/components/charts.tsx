"use client";

import { useRouter } from "next/navigation";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart,
  ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis,
} from "recharts";
import type { ScoredDay } from "@/core/domain/anomaly";
import { fmtDate, fmtMoney, fmtMoneyShort, fmtNumber, MONTHS_SHORT } from "@/components/format";

const BRAND = "#3b6cf6";
const BRAND_SOFT = "#bfd3fe";
const ORANGE = "#f59e0b";
const RED = "#e11d48";
const GREEN = "#059669";
const PALETTE = [BRAND, "#8b5cf6", "#06b6d4", ORANGE, GREEN, "#ec4899", "#64748b", RED];
const axis = { fontSize: 11, fill: "#64748b" };

function TooltipBox({ title, rows }: { title: string; rows: [string, string, string?][] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p className="mb-1 font-medium text-slate-900">{title}</p>
      {rows.map(([label, value, color]) => (
        <p key={label} className="flex items-center justify-between gap-4 text-slate-600">
          <span className="flex items-center gap-1.5">
            {color && <span className="size-2 rounded-full" style={{ background: color }} />}
            {label}
          </span>
          <span className="tabular font-medium text-slate-900">{value}</span>
        </p>
      ))}
    </div>
  );
}

const monthLabel = (m: string) => {
  const [y, mm] = m.split("-");
  return `${MONTHS_SHORT[Number(mm) - 1]} ${y.slice(2)}`;
};

/** Monthly revenue trend (area). */
export function MonthlyTrendChart({ data, onSelectMonth = true }: {
  data: { month: string; revenue: number; orders: number }[]; onSelectMonth?: boolean;
}) {
  const router = useRouter();
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
        onClick={(s) => {
          const m = s?.activeLabel as string | undefined;
          if (onSelectMonth && m) {
            const [y, mm] = m.split("-");
            router.push(`/revenue?year=${y}&month=${Number(mm)}`);
          }
        }}
        className={onSelectMonth ? "cursor-pointer" : undefined}
      >
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
            <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="month" tickFormatter={monthLabel} tick={axis} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis tickFormatter={(v) => fmtMoneyShort(v)} tick={axis} tickLine={false} axisLine={false} width={72} />
        <Tooltip
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                title={monthLabel(payload[0].payload.month)}
                rows={[
                  ["Revenue", fmtMoney(payload[0].payload.revenue), BRAND],
                  ["Orders", fmtNumber(payload[0].payload.orders)],
                ]}
              />
            ) : null
          }
        />
        <Area type="monotone" dataKey="revenue" stroke={BRAND} strokeWidth={2} fill="url(#rev)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Daily revenue (bars) + orders (line) for one month. */
export function DailyRevenueChart({ data, average }: {
  data: { date: string; revenue: number; orders: number }[]; average: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="date" tickFormatter={(d) => String(Number(d.slice(8)))} tick={axis} tickLine={false} axisLine={false} interval={0} />
        <YAxis yAxisId="rev" tickFormatter={(v) => fmtMoneyShort(v)} tick={axis} tickLine={false} axisLine={false} width={72} />
        <YAxis yAxisId="ord" orientation="right" tick={axis} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          cursor={{ fill: "#f1f5f9" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                title={fmtDate(payload[0].payload.date)}
                rows={[
                  ["Revenue", fmtMoney(payload[0].payload.revenue), BRAND],
                  ["Orders", fmtNumber(payload[0].payload.orders), ORANGE],
                ]}
              />
            ) : null
          }
        />
        <ReferenceLine yAxisId="rev" y={average} stroke="#94a3b8" strokeDasharray="4 4"
          label={{ value: "rata-rata", position: "insideTopRight", fontSize: 10, fill: "#64748b" }} />
        <Bar yAxisId="rev" dataKey="revenue" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Line yAxisId="ord" type="monotone" dataKey="orders" stroke={ORANGE} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Daily revenue with the "normal" band; anomalies are clickable red dots. */
export function AnomalyChart({ data, lower, upper, baseline, baseQuery }: {
  data: ScoredDay[]; lower: number; upper: number; baseline: number; baseQuery: string;
}) {
  const router = useRouter();
  const points = data.map((d) => ({ ...d, anomaly: d.isAnomaly ? d.revenue : null }));
  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart
        data={points}
        margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
        onClick={(s) => {
          const idx = s?.activeTooltipIndex;
          const d = idx != null ? points[Number(idx)] : undefined;
          if (d) router.push(`/anomalies?${baseQuery}&date=${d.date}`, { scroll: false });
        }}
        className="cursor-pointer"
      >
        <CartesianGrid stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="date" tickFormatter={(d) => String(Number(d.slice(8)))} tick={axis} tickLine={false} axisLine={false} interval={0} />
        <YAxis tickFormatter={(v) => fmtMoneyShort(v)} tick={axis} tickLine={false} axisLine={false} width={72} />
        <ReferenceArea y1={lower} y2={upper} fill={GREEN} fillOpacity={0.07} stroke={GREEN} strokeOpacity={0.25} strokeDasharray="3 3" />
        <ReferenceLine y={baseline} stroke={GREEN} strokeDasharray="4 4"
          label={{ value: "baseline", position: "insideTopRight", fontSize: 10, fill: GREEN }} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as ScoredDay;
            return (
              <TooltipBox
                title={fmtDate(d.date)}
                rows={[
                  ["Revenue", fmtMoney(d.revenue), BRAND],
                  ["Orders", fmtNumber(d.orders)],
                  ["Skor", d.score.toFixed(2), d.isAnomaly ? RED : undefined],
                  ["Status", d.isAnomaly ? (d.direction === "spike" ? "Lonjakan" : "Penurunan") : "Normal"],
                ]}
              />
            );
          }}
        />
        <Line type="monotone" dataKey="revenue" stroke={BRAND} strokeWidth={2} dot={{ r: 2.5, fill: BRAND }} activeDot={{ r: 5 }} />
        <Scatter dataKey="anomaly" fill={RED} shape={(p: { cx?: number; cy?: number }) =>
          p.cx == null || p.cy == null ? <g /> : (
            <g>
              <circle cx={p.cx} cy={p.cy} r={9} fill={RED} fillOpacity={0.15} />
              <circle cx={p.cx} cy={p.cy} r={5} fill={RED} stroke="#fff" strokeWidth={1.5} />
            </g>
          )}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function HorizontalBarChart({ data, money = true }: {
  data: { label: string; value: number }[]; money?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length * 34, 120)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" tick={axis} tickLine={false} axisLine={false} width={150} />
        <Tooltip
          cursor={{ fill: "#f1f5f9" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                title={payload[0].payload.label}
                rows={[[money ? "Revenue" : "Jumlah", money ? fmtMoney(payload[0].payload.value) : fmtNumber(payload[0].payload.value), BRAND]]}
              />
            ) : null
          }
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={18}>
          {data.map((_, i) => <Cell key={i} fill={i === 0 ? BRAND : BRAND_SOFT} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none">
              {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox title={String(payload[0].name)} rows={[["Jumlah", fmtNumber(Number(payload[0].value))]]} />
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="size-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
              {d.label}
            </span>
            <span className="tabular text-slate-900">
              {fmtNumber(d.value)} <span className="text-xs text-slate-400">({((d.value / total) * 100).toFixed(1)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
