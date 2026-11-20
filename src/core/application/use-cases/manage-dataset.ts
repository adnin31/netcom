// CRUD use cases for the 9 dataset tables.
import {
  getTable, normalizeListQuery, parseKey, parseRecord,
  type RecordValues, type TableDef,
} from "../../domain/dataset";
import { NotFoundError, ValidationError } from "../../domain/errors";
import type { DatasetRepository } from "../ports";

function resolveTable(name: string): TableDef {
  const table = getTable(name);
  if (!table) throw new NotFoundError("Tabel tidak dikenal");
  return table;
}

export type ListRecordsInput = {
  table: string; q?: string | null; page?: unknown; pageSize?: unknown; sort?: string | null; dir?: string | null;
};
export type ListRecordsOutput = {
  rows: RecordValues[]; total: number; page: number; pageSize: number; sort: string; dir: "asc" | "desc";
};

export class ListRecords {
  constructor(private readonly repo: DatasetRepository) {}

  async execute(input: ListRecordsInput): Promise<ListRecordsOutput> {
    const table = resolveTable(input.table);
    const q = normalizeListQuery(table, input);
    const { rows, total } = await this.repo.list(table, q);
    return { rows, total, page: q.page, pageSize: q.pageSize, sort: q.sort, dir: q.dir };
  }
}

export class CreateRecord {
  constructor(private readonly repo: DatasetRepository) {}

  async execute(input: { table: string; values: unknown }): Promise<RecordValues> {
    const table = resolveTable(input.table);
    return this.repo.insert(table, parseRecord(table, asObject(input.values), "create"));
  }
}

export class UpdateRecord {
  constructor(private readonly repo: DatasetRepository) {}

  async execute(input: { table: string; key: unknown; values: unknown }): Promise<RecordValues> {
    const table = resolveTable(input.table);
    const key = parseKey(table, input.key);
    const values = parseRecord(table, asObject(input.values), "update");
    if (Object.keys(values).length === 0) throw new ValidationError("Tidak ada perubahan");
    const row = await this.repo.update(table, key, values);
    if (!row) throw new NotFoundError("Data tidak ditemukan");
    return row;
  }
}

export class DeleteRecord {
  constructor(private readonly repo: DatasetRepository) {}

  async execute(input: { table: string; key: unknown }): Promise<void> {
    const table = resolveTable(input.table);
    const deleted = await this.repo.delete(table, parseKey(table, input.key));
    if (!deleted) throw new NotFoundError("Data tidak ditemukan");
  }
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
