import { container } from "@/infrastructure/container";

// Thin framework glue: everything happens in DatasetController -> use cases.
type Ctx = { params: Promise<{ table: string }> };
const dataset = () => container().controllers.dataset;

export const GET = async (req: Request, ctx: Ctx) => dataset().list(req, (await ctx.params).table);
export const POST = async (req: Request, ctx: Ctx) => dataset().create(req, (await ctx.params).table);
export const PUT = async (req: Request, ctx: Ctx) => dataset().update(req, (await ctx.params).table);
export const DELETE = async (req: Request, ctx: Ctx) => dataset().remove(req, (await ctx.params).table);
