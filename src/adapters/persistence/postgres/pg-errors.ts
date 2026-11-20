// Translate PostgreSQL driver errors into domain errors, so nothing above
// this adapter ever sees an SQLSTATE code.
import { ConflictError, ValidationError } from "@/core/domain/errors";

const MAP: Record<string, () => Error> = {
  "23505": () => new ConflictError("Data dengan primary key tersebut sudah ada"),
  "23503": () => new ConflictError("Relasi tidak valid: data terkait tidak ada atau masih dipakai tabel lain"),
  // PostgreSQL 18 reports ON DELETE/UPDATE RESTRICT violations as restrict_violation.
  "23001": () => new ConflictError("Data masih dipakai tabel lain sehingga tidak bisa dihapus"),
  "23514": () => new ValidationError("Nilai melanggar aturan validasi"),
  "23502": () => new ValidationError("Kolom wajib tidak boleh kosong"),
  "22P02": () => new ValidationError("Format nilai tidak valid"),
  "22001": () => new ValidationError("Nilai terlalu panjang"),
  "22007": () => new ValidationError("Format tanggal tidak valid"),
  "22008": () => new ValidationError("Tanggal di luar rentang"),
};

export function translatePgError(err: unknown): never {
  const e = err as { code?: string; detail?: string };
  const make = e?.code ? MAP[e.code] : undefined;
  if (make) {
    const domain = make() as Error & { detail?: string };
    Object.assign(domain, { detail: e.detail });
    throw domain;
  }
  throw err;
}

/** Run a query and convert constraint violations into domain errors. */
export async function guard<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    translatePgError(err);
  }
}
