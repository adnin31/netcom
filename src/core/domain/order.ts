// Order entity and the business rules about shipping.
import { ValidationError } from "./errors";
import { daysBetween } from "./period";

export const ORDER_STATUSES = [
  "created", "approved", "invoiced", "processing", "shipped", "delivered", "canceled", "unavailable",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Orders with these statuses never count as revenue. */
export const NON_REVENUE_STATUSES: readonly OrderStatus[] = ["canceled", "unavailable"];

/** Statuses an order can be in while still waiting to be handed to the carrier. */
export const AWAITING_SHIPMENT_STATUSES: readonly OrderStatus[] = ["created", "approved", "invoiced", "processing"];

export type Order = {
  id: string;
  customerId: string;
  status: OrderStatus;
  purchasedAt: string; // "YYYY-MM-DD HH:MM:SS"
  deliveredToCarrierAt: string | null;
  estimatedDeliveryAt: string | null;
};

export function isAwaitingShipment(order: Pick<Order, "status" | "deliveredToCarrierAt">): boolean {
  return order.deliveredToCarrierAt === null && AWAITING_SHIPMENT_STATUSES.includes(order.status);
}

/** Rule: only orders that are still waiting may be handed to the carrier. */
export function assertCanShip(order: Order): void {
  if (!isAwaitingShipment(order)) {
    throw new ValidationError(`Order dengan status "${order.status}" tidak bisa dikirim`);
  }
}

/** How long an unshipped order has waited, measured at `asOf`. */
export function waitingInfo(purchasedAt: string, estimatedDeliveryAt: string | null, asOf: string) {
  return {
    daysWaiting: Math.max(daysBetween(purchasedAt, asOf), 0),
    overdue: estimatedDeliveryAt !== null && estimatedDeliveryAt < asOf,
  };
}
