import type { Sql } from "postgres";
import type { OrderRepository, UnshippedCriteria, UnshippedRow } from "@/core/application/ports";
import { AWAITING_SHIPMENT_STATUSES, type Order, type OrderStatus } from "@/core/domain/order";

const TS = "YYYY-MM-DD HH24:MI:SS";

export class PostgresOrderRepository implements OrderRepository {
  private readonly awaiting = [...AWAITING_SHIPMENT_STATUSES];

  constructor(private readonly sql: Sql) {}

  async findById(id: string): Promise<Order | null> {
    const [row] = await this.sql<Order[]>`
      select order_id as "id", customer_id as "customerId", order_status as "status",
             to_char(order_purchase_timestamp, ${TS}) as "purchasedAt",
             to_char(order_delivered_carrier_date, ${TS}) as "deliveredToCarrierAt",
             to_char(order_estimated_delivery_date, ${TS}) as "estimatedDeliveryAt"
      from orders where order_id = ${id}`;
    return row ?? null;
  }

  /** Mapping of the domain rule "awaiting shipment" to SQL (served by a partial index). */
  private whereAwaiting(c: Pick<UnshippedCriteria, "status" | "idPrefix" | "range">) {
    const sql = this.sql;
    return sql`
      o.order_delivered_carrier_date is null
      and o.order_status = any(${this.awaiting})
      ${c.status ? sql`and o.order_status = ${c.status}` : sql``}
      ${c.idPrefix ? sql`and (o.order_id like ${c.idPrefix + "%"} or o.customer_id like ${c.idPrefix + "%"})` : sql``}
      ${c.range ? sql`and o.order_purchase_timestamp >= ${c.range.start}::date
                      and o.order_purchase_timestamp <  ${c.range.end}::date` : sql``}`;
  }

  async findAwaitingShipment(c: UnshippedCriteria) {
    const sql = this.sql;
    const where = this.whereAwaiting(c);
    const order =
      c.sort === "newest" ? sql`o.order_purchase_timestamp desc`
      : c.sort === "value" ? sql`"value" desc nulls last`
      : sql`o.order_purchase_timestamp asc`;

    const [rows, [meta]] = await Promise.all([
      sql<UnshippedRow[]>`
        select o.order_id as "orderId", o.customer_id as "customerId", o.order_status as "status",
               to_char(o.order_purchase_timestamp, 'YYYY-MM-DD HH24:MI') as "purchasedAt",
               to_char(o.order_approved_at, 'YYYY-MM-DD HH24:MI') as "approvedAt",
               to_char(o.order_estimated_delivery_date, 'YYYY-MM-DD') as "estimatedDeliveryAt",
               c.customer_city as "city", c.customer_state as "state",
               (select count(*)::int from order_items i where i.order_id = o.order_id) as "items",
               (select sum(p.payment_value)::float8 from order_payments p where p.order_id = o.order_id) as "value"
        from orders o join customers c on c.customer_id = o.customer_id
        where ${where}
        order by ${order}
        limit ${c.limit} offset ${c.offset}`,
      sql<{ total: number; total_value: number }[]>`
        select count(*)::int as total,
               coalesce(sum((select sum(p.payment_value) from order_payments p where p.order_id = o.order_id)), 0)::float8 as total_value
        from orders o where ${where}`,
    ]);
    return { rows, total: meta.total, totalValue: meta.total_value };
  }

  async countAwaitingShipmentByStatus() {
    return this.sql<{ status: OrderStatus; count: number }[]>`
      select o.order_status as status, count(*)::int as count from orders o
      where ${this.whereAwaiting({})}
      group by 1 order by 2 desc`;
  }

  async latestPurchaseDate(): Promise<string> {
    const [row] = await this.sql<{ d: string }[]>`
      select to_char(max(order_purchase_timestamp), 'YYYY-MM-DD') as d from orders`;
    return row.d;
  }

  async markShipped(id: string, at: string): Promise<boolean> {
    // The WHERE repeats the precondition so a concurrent update cannot ship twice.
    const rows = await this.sql`
      update orders set order_status = 'shipped', order_delivered_carrier_date = ${at}::timestamp
      where order_id = ${id} and order_delivered_carrier_date is null
        and order_status = any(${this.awaiting})
      returning order_id`;
    return rows.length > 0;
  }
}
