import { ConflictError, NotFoundError } from "../../domain/errors";
import { assertCanShip } from "../../domain/order";
import type { Clock, OrderRepository } from "../ports";

export class ShipOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly clock: Clock,
  ) {}

  async execute(orderId: string): Promise<{ orderId: string; shippedAt: string }> {
    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundError("Order tidak ditemukan");
    assertCanShip(order); // business rule lives in the entity

    const shippedAt = this.clock.now();
    const updated = await this.orders.markShipped(order.id, shippedAt);
    if (!updated) throw new ConflictError("Order sudah diperbarui oleh proses lain");
    return { orderId: order.id, shippedAt };
  }
}
