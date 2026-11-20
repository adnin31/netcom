import type { Sql } from "postgres";
import type { RevenueRepository } from "@/core/application/ports";
import { NON_REVENUE_STATUSES } from "@/core/domain/order";
import type { DateRange } from "@/core/domain/period";
import type { DayRevenue, MonthRevenue } from "@/core/domain/revenue";

export class PostgresRevenueRepository implements RevenueRepository {
  private readonly excluded = [...NON_REVENUE_STATUSES];

  constructor(private readonly sql: Sql) {}

  async daily({ start, end }: DateRange): Promise<DayRevenue[]> {
    const sql = this.sql;
    return sql<DayRevenue[]>`
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
          and o.order_status <> all(${this.excluded})
        group by 1
      )
      select to_char(days.d, 'YYYY-MM-DD') as date,
             coalesce(rev.revenue, 0)::float8 as revenue,
             coalesce(rev.orders, 0)::int as orders
      from days left join rev using (d)
      order by days.d`;
  }

  async monthly(range?: DateRange): Promise<MonthRevenue[]> {
    const sql = this.sql;
    return sql<MonthRevenue[]>`
      select to_char(date_trunc('month', o.order_purchase_timestamp), 'YYYY-MM') as month,
             sum(p.payment_value)::float8 as revenue,
             count(distinct o.order_id)::int as orders
      from orders o
      join order_payments p on p.order_id = o.order_id
      where o.order_status <> all(${this.excluded})
        ${range ? sql`and o.order_purchase_timestamp >= ${range.start}::date
                      and o.order_purchase_timestamp <  ${range.end}::date` : sql``}
      group by 1 order by 1`;
  }

  async coverage() {
    const [row] = await this.sql<{ first: string; last: string }[]>`
      select to_char(min(order_purchase_timestamp), 'YYYY-MM-DD') as first,
             to_char(max(order_purchase_timestamp), 'YYYY-MM-DD') as last
      from orders`;
    return row;
  }

  async periods() {
    return this.sql<{ year: number; month: number }[]>`
      select distinct extract(year from order_purchase_timestamp)::int as year,
                      extract(month from order_purchase_timestamp)::int as month
      from orders order by 1, 2`;
  }

  async dayBreakdown(date: string) {
    const sql = this.sql;
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
          and o.order_status <> all(${this.excluded})
        group by 1 order by 2 desc limit 6`,
      sql<{ status: string; count: number }[]>`
        select order_status as status, count(*)::int as count from orders
        where order_purchase_timestamp >= ${date}::date and order_purchase_timestamp < ${date}::date + 1
        group by 1 order by 2 desc`,
      sql<{ max_order: number | null; avg_order: number | null }[]>`
        select max(t.v)::float8 as max_order, avg(t.v)::float8 as avg_order from (
          select sum(p.payment_value) as v
          from orders o join order_payments p on p.order_id = o.order_id
          where o.order_purchase_timestamp >= ${date}::date
            and o.order_purchase_timestamp <  ${date}::date + 1
            and o.order_status <> all(${this.excluded})
          group by o.order_id) t`,
    ]);
    return { categories, statuses, maxOrderValue: summary.max_order, avgOrderValue: summary.avg_order };
  }
}
