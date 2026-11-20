import { describe, expect, it } from "vitest";
import { ConflictError, ValidationError } from "@/core/domain/errors";
import { guard } from "./pg-errors";

const pgError = (code: string) => Object.assign(new Error("pg"), { code, detail: "Key (x)=(1)" });

describe("translatePgError", () => {
  it.each([
    ["23505", ConflictError], // unique_violation
    ["23503", ConflictError], // foreign_key_violation (PG <= 17 for RESTRICT too)
    ["23001", ConflictError], // restrict_violation (PG 18, e.g. Neon)
    ["23514", ValidationError], // check_violation
  ])("maps SQLSTATE %s to a domain error and keeps the detail", async (code, type) => {
    const err = await guard(() => Promise.reject(pgError(code))).catch((e) => e);
    expect(err).toBeInstanceOf(type);
    expect(err.detail).toBe("Key (x)=(1)");
  });

  it("rethrows unknown errors untouched", async () => {
    const original = pgError("57014");
    await expect(guard(() => Promise.reject(original))).rejects.toBe(original);
  });
});
