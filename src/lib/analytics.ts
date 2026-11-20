import "server-only";
import { connection } from "next/server";
import { sql } from "./db";
import type { DayPoint } from "./anomaly";

// Revenue = sum of payment_value of orders that were not canceled/unavailable,
// attributed to the order's purchase date.
const EXCLUDED_STATUSES = ["canceled", "unavailable"];
export const UNSHIPPED_EXCLUDED = ["canceled", "unavailable", "delivered"];

function monthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { start, end };
}

/** First/last purchase date in the dataset, used to clip charts and stats. */
export async function getCoverage() {
  await connection(); // never run these queries during prerendering
  const [row] = await sql<{ first: string; last: string }[]>`
    select to_char(min(order_purchase_timestamp), 'YYYY-MM-DD') as first,
           to_char(max(order_purchase_timestamp), 'YYYY-MM-DD') as last
    from orders`;
  return row;
}

export async function getAvailablePeriods() {
  await connection(); // never run these queries during prerendering
  const rows = await sql<{ year: number; month: number }[]>`
    select distinct extract(year from order_purchase_timestamp)::int as year,
                    extract(month from order_purchase_timestamp)::int as month
    from orders order by 1, 2`;
  const years = [...new Set(rows.map((r) => r.year))];
  return { years, periods: rows };
}

export async function getDailyRevenue(year: number, month: number): Promise<DayPoint[]> {
  await connection(); // never run these queries during prerendering
  const { start, end } = monthRange(year, month);
  return getDailyRevenueBetween(start, end);
}

export async function getDailyRevenueForYear(year: number): Promise<DayPoint[]> {
  await connection(); // never run these queries during prerendering
  return getDailyRevenueBetween(`${year}-01-01`, `${year + 1}-01-01`);
}

/** Daily revenue for [start, end), with zero-filled days. */
async function getDailyRevenueBetween(start: string, end: string): Promise<DayPoint[]> {
  return sql<DayPoint[]>`
    with days as (
      select generate_series(${start}::date, ${end}::date - 1, interval '1 day')::date as d
    ), rev as (
      select o.order_purchase_timestamp::date as d,
             sum(p.payment_value) as revenue,
             count(distinct o.order_id) as orders
      from orders o
      join order_payments p on p.order_id = o.order_id
      where o.order_purchase_timestamp >= ${start}::date
        and o.order_purchase_timestamp <  ${end}::date
        and o.order_status <> all(${EXCLUDED_STATUSES})
      group by 1
    )
    select to_char(days.d, 'YYYY-MM-DD') as date,
           coalesce(rev.revenue, 0)::float8 as revenue,
           coalesce(rev.orders, 0)::int as orders
    from days left join rev using (d)
    order by days.d`;
}

export async function getMonthlyRevenue(year?: number) {
  await connection(); // never run these queries during prerendering
  return sql<{ month: string; revenue: number; orders: number }[]>`
    select to_char(date_trunc('month', o.order_purchase_timestamp), 'YYYY-MM') as month,
           sum(p.payment_value)::float8 as revenue,
           count(distinct o.order_id)::int as orders
    from orders o
    join order_payments p on p.order_id = o.order_id
    where o.order_status <> all(${EXCLUDED_STATUSES})
      ${year ? sql`and o.order_purchase_timestamp >= ${`${year}-01-01`}::date
                   and o.order_purchase_timestamp <  ${`${year + 1}-01-01`}::date` : sql``}
    group by 1 order by 1`;
}

export async function getOverview() {
  await connection(); // never run these queries during prerendering
  const [[kpi], status, categories, payments, states] = await Promise.all([
    sql<{
      orders: number; revenue: number; customers: number; sellers: number;
      products: number; unshipped: number; avg_review: number;
    }[]>`
      select
        (select count(*)::int from orders) as orders,
        (select sum(p.payment_value)::float8 from order_payments p join orders o using (order_id)
          where o.order_status <> all(${EXCLUDED_STATUSES})) as revenue,
        (select count(distinct customer_unique_id)::int from customers) as customers,
        (select count(*)::int from sellers) as sellers,
        (select count(*)::int from products) as products,
        (select count(*)::int from orders where order_delivered_carrier_date is null
           and order_status <> all(${UNSHIPPED_EXCLUDED})) as unshipped,
        (select avg(review_score)::float8 from order_reviews) as avg_review`,
    sql<{ status: string; count: number }[]>`
      select order_status as status, count(*)::int as count from orders group by 1 order by 2 desc`,
    sql<{ category: string; revenue: number; items: number }[]>`
      select coalesce(t.product_category_name_english, 'unknown') as category,
             sum(i.price)::float8 as revenue, count(*)::int as items
      from order_items i
      join products pr on pr.product_id = i.product_id
      left join product_category_name_translation t on t.product_category_name = pr.product_category_name
      group by 1 order by 2 desc limit 8`,
    sql<{ type: string; value: number; count: number }[]>`
      select payment_type as type, sum(payment_value)::float8 as value, count(*)::int as count
      from order_payments group by 1 order by 2 desc`,
    sql<{ state: string; orders: number }[]>`
      select c.customer_state as state, count(*)::int as orders
      from orders o join customers c using (customer_id)
      group by 1 order by 2 desc limit 10`,
  ]);
  return { kpi, status, categories, payments, states };
}

/** Context for a single day: categories and status mix of that day's orders. */
export async function getDayDetail(date: string) {
  await connection(); // never run these queries during prerendering
  const [categories, statuses, [summary]] = await Promise.all([
    sql<{ category: string; revenue: number; items: number }[]>`
      select coalesce(t.product_category_name_english, 'unknown') as category,
             sum(i.price + i.freight_value)::float8 as revenue, count(*)::int as items
      from orders o
      join order_items i on i.order_id = o.order_id
      join products pr on pr.product_id = i.product_id
      left join product_category_name_translation t on t.product_category_name = pr.product_category_name
      where o.order_purchase_timestamp >= ${date}::date
        and o.order_purchase_timestamp <  ${date}::date + 1
        and o.order_status <> all(${EXCLUDED_STATUSES})
      group by 1 order by 2 desc limit 6`,
    sql<{ status: string; count: number }[]>`
      select order_status as status, count(*)::int as count from orders
      where order_purchase_timestamp >= ${date}::date and order_purchase_timestamp < ${date}::date + 1
      group by 1 order by 2 desc`,
    sql<{ max_order: number; avg_order: number }[]>`
      select max(t.v)::float8 as max_order, avg(t.v)::float8 as avg_order from (
        select sum(p.payment_value) as v
        from orders o join order_payments p on p.order_id = o.order_id
        where o.order_purchase_timestamp >= ${date}::date
          and o.order_purchase_timestamp <  ${date}::date + 1
          and o.order_status <> all(${EXCLUDED_STATUSES})
        group by o.order_id) t`,
  ]);
  return { categories, statuses, summary };
}

export type UnshippedFilter = {
  status?: string; q?: string; year?: number; month?: number; page?: number; pageSize?: number;
  sort?: "oldest" | "newest" | "value";
};

export async function getUnshipped(f: UnshippedFilter) {
  await connection(); // never run these queries during prerendering
  const pageSize = Math.min(Math.max(f.pageSize ?? 20, 5), 100);
  const page = Math.max(f.page ?? 1, 1);
  const range = f.year
    ? f.month
      ? monthRange(f.year, f.month)
      : { start: `${f.year}-01-01`, end: `${f.year + 1}-01-01` }
    : null;

  const where = sql`
    o.order_delivered_carrier_date is null
    and o.order_status <> all(${UNSHIPPED_EXCLUDED})
    ${f.status ? sql`and o.order_status = ${f.status}` : sql``}
    ${f.q ? sql`and (o.order_id like ${f.q.toLowerCase() + "%"} or o.customer_id like ${f.q.toLowerCase() + "%"})` : sql``}
    ${range ? sql`and o.order_purchase_timestamp >= ${range.start}::date and o.order_purchase_timestamp < ${range.end}::date` : sql``}`;

  const order =
    f.sort === "newest" ? sql`o.order_purchase_timestamp desc`
    : f.sort === "value" ? sql`order_value desc nulls last`
    : sql`o.order_purchase_timestamp asc`;

  const [rows, [meta], byStatus] = await Promise.all([
    sql<{
      order_id: string; customer_id: string; order_status: string; purchased: string;
      approved: string | null; estimated: string | null; city: string; state: string;
      items: number; order_value: number | null; days_waiting: number; overdue: boolean;
    }[]>`
      with snapshot as (select max(order_purchase_timestamp) as ts from orders)
      select o.order_id, o.customer_id, o.order_status,
             to_char(o.order_purchase_timestamp, 'YYYY-MM-DD HH24:MI') as purchased,
             to_char(o.order_approved_at, 'YYYY-MM-DD HH24:MI') as approved,
             to_char(o.order_estimated_delivery_date, 'YYYY-MM-DD') as estimated,
             c.customer_city as city, c.customer_state as state,
             (select count(*)::int from order_items i where i.order_id = o.order_id) as items,
             (select sum(p.payment_value)::float8 from order_payments p where p.order_id = o.order_id) as order_value,
             extract(day from (select ts from snapshot) - o.order_purchase_timestamp)::int as days_waiting,
             coalesce(o.order_estimated_delivery_date < (select ts from snapshot), false) as overdue
      from orders o join customers c on c.customer_id = o.customer_id
      where ${where}
      order by ${order}
      limit ${pageSize} offset ${(page - 1) * pageSize}`,
    sql<{ total: number; total_value: number }[]>`
      select count(*)::int as total,
             coalesce(sum((select sum(p.payment_value) from order_payments p where p.order_id = o.order_id)), 0)::float8 as total_value
      from orders o where ${where}`,
    sql<{ status: string; count: number }[]>`
      select order_status as status, count(*)::int as count from orders o
      where o.order_delivered_carrier_date is null and o.order_status <> all(${UNSHIPPED_EXCLUDED})
      group by 1 order by 2 desc`,
  ]);
  return { rows, total: meta.total, totalValue: meta.total_value, byStatus, page, pageSize };
}

export async function markShipped(orderId: string) {
  await connection(); // never run these queries during prerendering
  const rows = await sql`
    update orders set order_status = 'shipped', order_delivered_carrier_date = now()
    where order_id = ${orderId} and order_delivered_carrier_date is null
      and order_status <> all(${UNSHIPPED_EXCLUDED})
    returning order_id`;
  return rows.length > 0;
}
