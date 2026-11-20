// Presents domain errors as HTTP responses (the only place that knows the mapping).
import { DomainError } from "@/core/domain/errors";

const STATUS: Record<DomainError["kind"], number> = {
  validation: 400,
  unauthorized: 401,
  not_found: 404,
  conflict: 409,
};

export function presentError(err: unknown): Response {
  if (err instanceof DomainError) {
    return Response.json({ error: err.message, detail: err.detail }, { status: STATUS[err.kind] });
  }
  console.error(err);
  return Response.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
}
