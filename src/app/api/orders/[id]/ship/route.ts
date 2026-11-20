import { container } from "@/infrastructure/container";

export const POST = async (req: Request, ctx: { params: Promise<{ id: string }> }) =>
  container().controllers.orders.ship(req, (await ctx.params).id);
