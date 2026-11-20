import { container } from "@/infrastructure/container";

export const POST = () => container().controllers.auth.postLogout();
