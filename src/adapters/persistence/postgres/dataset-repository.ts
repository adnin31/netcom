// Generic table access for the dataset CRUD. Table and column names only
// ever come from the domain metadata (whitelist); values are parameterized.
import type { Fragment, Sql } from "postgres";
import type { DatasetRepository } from "@/core/application/ports";
import type { Column, ListQuery, RecordKey, RecordValues, TableDef } from "@/core/domain/dataset";
import { guard } from "./pg-errors";

export class PostgresDatasetRepository implements DatasetRepository {
  constructor(private readonly sql: Sql) {}

  private join(parts: Fragment[], separator: Fragment): Fragment {
    const sql = this.sql;
    return parts.reduce<Fragment | null>((acc, part) => (acc ? sql`${acc}${separator}${part}` : part), null) ?? sql``;
  }

  /** Read expression per column: timestamps as text (no TZ shifts), numerics as numbers. */
  private selectList(t: TableDef): Fragment {
    const sql = this.sql;
    return this.join(
      t.columns.map((c: Column) => {
        const col = sql(c.name);
        if (c.type === "timestamp") return sql`to_char(${col}, 'YYYY-MM-DD HH24:MI:SS') as ${col}`;
        if (c.type === "money" || c.type === "float") return sql`${col}::float8 as ${col}`;
        if (c.auto) return sql`${col}::int as ${col}`;
        return sql`${col}`;
      }),
      sql`, `,
    );
  }

  private keyWhere(t: TableDef, key: RecordKey): Fragment {
    const sql = this.sql;
    return this.join(t.primaryKey.map((col) => sql`${sql(col)} = ${key[col]}`), sql` and `);
  }

  async list(t: TableDef, q: ListQuery) {
    const sql = this.sql;
    const where = q.search
      ? sql`where ${this.join(
          t.searchable.map((name) => {
            const col = t.columns.find((c) => c.name === name)!;
            // IDs: prefix match; free text: contains.
            return col.type === "id"
              ? sql`${sql(name)} like ${q.search.toLowerCase() + "%"}`
              : sql`${sql(name)}::text ilike ${"%" + q.search + "%"}`;
          }),
          sql` or `,
        )}`
      : sql``;
    const order = sql`order by ${sql(q.sort)} ${q.dir === "asc" ? sql`asc` : sql`desc`} nulls last, ${this.join(
      t.primaryKey.map((k) => sql`${sql(k)}`),
      sql`, `,
    )}`;

    const [rows, [{ total }]] = await Promise.all([
      sql<RecordValues[]>`select ${this.selectList(t)} from ${sql(t.name)} ${where} ${order}
                          limit ${q.pageSize} offset ${(q.page - 1) * q.pageSize}`,
      sql<{ total: number }[]>`select count(*)::int as total from ${sql(t.name)} ${where}`,
    ]);
    return { rows, total };
  }

  insert(t: TableDef, values: RecordValues) {
    return guard(async () => {
      const [row] = await this.sql<RecordValues[]>`
        insert into ${this.sql(t.name)} ${this.sql(values)} returning ${this.selectList(t)}`;
      return row;
    });
  }

  update(t: TableDef, key: RecordKey, values: RecordValues) {
    return guard(async () => {
      const rows = await this.sql<RecordValues[]>`
        update ${this.sql(t.name)} set ${this.sql(values)}
        where ${this.keyWhere(t, key)} returning ${this.selectList(t)}`;
      return rows[0] ?? null;
    });
  }

  delete(t: TableDef, key: RecordKey) {
    return guard(async () => {
      const rows = await this.sql`delete from ${this.sql(t.name)} where ${this.keyWhere(t, key)} returning 1`;
      return rows.length > 0;
    });
  }
}
