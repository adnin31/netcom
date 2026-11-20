import { container } from "@/infrastructure/container";

export const POST = (request: Request) => container().controllers.auth.postLogin(request);
