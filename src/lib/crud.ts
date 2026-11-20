import "server-only";
import type { Fragment } from "postgres";
import { sql } from "./db";
import type { Column, TableDef } from "./tables";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Row = Record<string, unknown>;

function join(parts: Fragment[], separator: Fragment): Fragment {
  return parts.reduce<Fragment | null>(
    (acc, part) => (acc ? sql`${acc}${separator}${part}` : part),
    null,
  ) ?? sql``;
}

/** Column expression for reads: timestamps as plain text, numerics as numbers. */
function selectExpr(c: Column): Fragment {
  const col = sql(c.name);
  if (c.type === "timestamp") return sql`to_char(${col}, 'YYYY-MM-DD HH24:MI:SS') as ${col}`;
  if (c.type === "money" || c.type === "float") return sql`${col}::float8 as ${col}`;
  if (c.name === "id") return sql`${col}::int as ${col}`;
  return sql`${col}`;
}

const selectList = (t: TableDef) => join(t.columns.map(selectExpr), sql`, `);

export type ListParams = { q?: string; page?: number; pageSize?: number; sort?: string; dir?: string };

export async function listRows(t: TableDef, p: ListParams) {
  const pageSize = Math.min(Math.max(Number(p.pageSize) || 20, 5), 100);
  const page = Math.max(Number(p.page) || 1, 1);
  const sortCol = t.columns.some((c) => c.name === p.sort) ? p.sort! : t.defaultSort.column;
  const dir = p.dir === "asc" || p.dir === "desc" ? p.dir : t.defaultSort.dir;
  const q = (p.q ?? "").trim();

  const where = q
    ? sql`where ${join(
        t.searchable.map((c) => {
          const col = t.columns.find((x) => x.name === c)!;
          // IDs: prefix match (cheap); free text: contains.
          return col.type === "id"
            ? sql`${sql(c)} like ${q.toLowerCase() + "%"}`
            : sql`${sql(c)}::text ilike ${"%" + q + "%"}`;
        }),
        sql` or `,
      )}`
    : sql``;

  const order = sql`order by ${sql(sortCol)} ${dir === "asc" ? sql`asc` : sql`desc`} nulls last, ${join(
    t.primaryKey.map((k) => sql`${sql(k)}`),
    sql`, `,
  )}`;

  const [rows, [{ total }]] = await Promise.all([
    sql<Row[]>`select ${selectList(t)} from ${sql(t.name)} ${where} ${order}
               limit ${pageSize} offset ${(page - 1) * pageSize}`,
    sql<{ total: number }[]>`select count(*)::int as total from ${sql(t.name)} ${where}`,
  ]);
  return { rows, total, page, pageSize, sort: sortCol, dir };
}

/** Validate and coerce form input according to the column metadata. */
export function parseValues(t: TableDef, input: Row, mode: "create" | "update"): Row {
  const out: Row = {};
  for (const c of t.columns) {
    if (c.auto) continue;
    if (mode === "update" && t.primaryKey.includes(c.name)) continue;
    if (!(c.name in input) && mode === "update") continue;

    const raw = input[c.name];
    const str = raw === null || raw === undefined ? "" : String(raw).trim();
    if (str === "") {
      if (c.required) throw new HttpError(400, `${c.label} wajib diisi`);
      out[c.name] = null;
      continue;
    }
    if (c.maxLength && str.length > c.maxLength) {
      throw new HttpError(400, `${c.label} maksimal ${c.maxLength} karakter`);
    }
    switch (c.type) {
      case "int": {
        const n = Number(str);
        if (!Number.isInteger(n)) throw new HttpError(400, `${c.label} harus bilangan bulat`);
        out[c.name] = n;
        break;
      }
      case "float":
      case "money": {
        const n = Number(str);
        if (!Number.isFinite(n)) throw new HttpError(400, `${c.label} harus angka`);
        if (c.type === "money" && n < 0) throw new HttpError(400, `${c.label} tidak boleh negatif`);
        out[c.name] = n;
        break;
      }
      case "timestamp": {
        const v = str.replace("T", " ");
        if (!/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/.test(v) || Number.isNaN(Date.parse(v.replace(" ", "T")))) {
          throw new HttpError(400, `${c.label} harus format YYYY-MM-DD HH:MM:SS`);
        }
        out[c.name] = v;
        break;
      }
      case "select":
        if (c.options && !c.options.includes(str)) throw new HttpError(400, `${c.label} tidak valid`);
        out[c.name] = c.name === "review_score" ? Number(str) : str;
        break;
      case "id":
        if (!/^[0-9a-z]+$/i.test(str)) throw new HttpError(400, `${c.label} hanya boleh huruf/angka`);
        out[c.name] = str.toLowerCase();
        break;
      default:
        out[c.name] = str;
    }
  }
  return out;
}

function keyWhere(t: TableDef, key: unknown): Fragment {
  if (!key || typeof key !== "object") throw new HttpError(400, "Primary key wajib dikirim");
  const k = key as Row;
  return join(
    t.primaryKey.map((col) => {
      if (k[col] === undefined || k[col] === null || k[col] === "") {
        throw new HttpError(400, `Primary key ${col} wajib dikirim`);
      }
      return sql`${sql(col)} = ${String(k[col])}`;
    }),
    sql` and `,
  );
}

export async function createRow(t: TableDef, input: Row) {
  const values = parseValues(t, input, "create");
  const [row] = await sql<Row[]>`insert into ${sql(t.name)} ${sql(values)} returning ${selectList(t)}`;
  return row;
}

export async function updateRow(t: TableDef, key: unknown, input: Row) {
  const values = parseValues(t, input, "update");
  if (Object.keys(values).length === 0) throw new HttpError(400, "Tidak ada perubahan");
  const rows = await sql<Row[]>`update ${sql(t.name)} set ${sql(values)}
                                where ${keyWhere(t, key)} returning ${selectList(t)}`;
  if (rows.length === 0) throw new HttpError(404, "Data tidak ditemukan");
  return rows[0];
}

export async function deleteRow(t: TableDef, key: unknown) {
  const rows = await sql`delete from ${sql(t.name)} where ${keyWhere(t, key)} returning 1`;
  if (rows.length === 0) throw new HttpError(404, "Data tidak ditemukan");
}

/** Map errors (validation + PostgreSQL constraint codes) to an HTTP response. */
export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
  const e = err as { code?: string; detail?: string; message?: string };
  const map: Record<string, [number, string]> = {
    "23505": [409, "Data dengan primary key tersebut sudah ada"],
    "23503": [409, "Relasi tidak valid: data terkait tidak ada atau masih dipakai tabel lain"],
    "23514": [400, "Nilai melanggar aturan validasi"],
    "23502": [400, "Kolom wajib tidak boleh kosong"],
    "22P02": [400, "Format nilai tidak valid"],
    "22001": [400, "Nilai terlalu panjang"],
  };
  if (e.code && map[e.code]) {
    const [status, message] = map[e.code];
    return Response.json({ error: message, detail: e.detail }, { status });
  }
  console.error(err);
  return Response.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
}
