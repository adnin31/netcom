import type { Sql } from "postgres";
import type { DashboardRepository, OverviewStats } from "@/core/application/ports";
import { AWAITING_SHIPMENT_STATUSES, NON_REVENUE_STATUSES } from "@/core/domain/order";

export class PostgresDashboardRepository implements DashboardRepository {
  constructor(private readonly sql: Sql) {}

  async overview(): Promise<OverviewStats> {
    const sql = this.sql;
    const excluded = [...NON_REVENUE_STATUSES];
    const awaiting = [...AWAITING_SHIPMENT_STATUSES];
    const [[kpi], statuses, topCategories, payments, topStates] = await Promise.all([
      sql<{
        orders: number; revenue: number; customers: number; sellers: number;
        products: number; awaiting: number; avg_review: number;
      }[]>`
        select
          (select count(*)::int from orders) as orders,
          (select sum(p.payment_value)::float8 from order_payments p join orders o using (order_id)
            where o.order_status <> all(${excluded})) as revenue,
          (select count(distinct customer_unique_id)::int from customers) as customers,
          (select count(*)::int from sellers) as sellers,
          (select count(*)::int from products) as products,
          (select count(*)::int from orders where order_delivered_carrier_date is null
             and order_status = any(${awaiting})) as awaiting,
          (select avg(review_score)::float8 from order_reviews) as avg_review`,
      sql<{ status: string; count: number }[]>`
        select order_status as status, count(*)::int as count from orders group by 1 order by 2 desc`,
      sql<{ category: string; revenue: number }[]>`
        select coalesce(t.product_category_name_english, 'unknown') as category, sum(i.price)::float8 as revenue
        from order_items i
        join products pr on pr.product_id = i.product_id
        left join product_category_name_translation t on t.product_category_name = pr.product_category_name
        group by 1 order by 2 desc limit 8`,
      sql<{ type: string; value: number }[]>`
        select payment_type as type, sum(payment_value)::float8 as value
        from order_payments group by 1 order by 2 desc`,
      sql<{ state: string; orders: number }[]>`
        select c.customer_state as state, count(*)::int as orders
        from orders o join customers c using (customer_id)
        group by 1 order by 2 desc limit 10`,
    ]);
    return {
      orders: kpi.orders,
      revenue: kpi.revenue,
      uniqueCustomers: kpi.customers,
      sellers: kpi.sellers,
      products: kpi.products,
      awaitingShipment: kpi.awaiting,
      avgReviewScore: kpi.avg_review,
      statuses,
      topCategories,
      payments,
      topStates,
    };
  }
}
