// Use cases tested with in-memory fakes: no database, no web server.
import { describe, expect, it } from "vitest";
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from "../../domain/errors";
import type { Order } from "../../domain/order";
import type { DayRevenue } from "../../domain/revenue";
import type { User } from "../../domain/user";
import type { DatasetRepository, OrderRepository, RevenueRepository, TokenService } from "../ports";
import { DetectRevenueAnomalies } from "./detect-revenue-anomalies";
import { GetDailyRevenue } from "./get-daily-revenue";
import { Login } from "./login";
import { CreateRecord, DeleteRecord, UpdateRecord } from "./manage-dataset";
import { ShipOrder } from "./ship-order";

// ---------- fakes ----------

const tokens: TokenService = {
  ttlSeconds: 60,
  sign: async (u) => `token-for-${u.id}`,
  verify: async (t) => (t === "token-for-1" ? { id: 1, name: "A", email: "a@x.io", role: "admin" } : null),
};

function fakeRevenue(days: DayRevenue[], coverage = { first: "2017-01-01", last: "2017-12-31" }): RevenueRepository {
  return {
    daily: async ({ start, end }) => days.filter((d) => d.date >= start && d.date < end),
    monthly: async (range) => {
      const map = new Map<string, { revenue: number; orders: number }>();
      for (const d of days) {
        if (range && (d.date < range.start || d.date >= range.end)) continue;
        const m = map.get(d.date.slice(0, 7)) ?? { revenue: 0, orders: 0 };
        map.set(d.date.slice(0, 7), { revenue: m.revenue + d.revenue, orders: m.orders + d.orders });
      }
      return [...map].map(([month, v]) => ({ month, ...v }));
    },
    coverage: async () => coverage,
    periods: async () => [{ year: 2017, month: 10 }, { year: 2017, month: 11 }],
    dayBreakdown: async () => ({ categories: [], statuses: [], maxOrderValue: null, avgOrderValue: null }),
  };
}

const month = (m: number, base: number, spikeDay?: number): DayRevenue[] =>
  Array.from({ length: 30 }, (_, i) => ({
    date: `2017-${String(m).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
    revenue: i + 1 === spikeDay ? base * 6 : base + ((i * 7919) % 900) - 450,
    orders: 10,
  }));

// ---------- tests ----------

describe("Login", () => {
  const user: User = { id: 1, name: "A", email: "a@x.io", role: "admin", passwordHash: "HASH" };
  const users = { findByEmail: async (e: string) => (e === "a@x.io" ? user : null) };
  const calls: (string | null)[] = [];
  const hasher = { verify: async (p: string, h: string | null) => { calls.push(h); return p === "secret" && h === "HASH"; } };
  const login = new Login(users, hasher, tokens);

  it("issues a token for valid credentials (email is normalized)", async () => {
    const out = await login.execute({ email: "  A@X.io ", password: "secret" });
    expect(out).toMatchObject({ token: "token-for-1", expiresIn: 60, user: { email: "a@x.io" } });
    expect(out.user).not.toHaveProperty("passwordHash");
  });

  it("rejects wrong passwords and unknown users, still verifying a hash", async () => {
    calls.length = 0;
    await expect(login.execute({ email: "a@x.io", password: "nope" })).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(login.execute({ email: "who@x.io", password: "secret" })).rejects.toBeInstanceOf(UnauthorizedError);
    expect(calls).toEqual(["HASH", null]); // hasher ran for the unknown user too
  });

  it("validates input", async () => {
    await expect(login.execute({ email: "not-an-email", password: "x" })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("ShipOrder", () => {
  const base: Order = {
    id: "o1", customerId: "c", status: "invoiced", purchasedAt: "2018-01-01 00:00:00",
    deliveredToCarrierAt: null, estimatedDeliveryAt: null,
  };
  const clock = { now: () => "2026-11-20 10:00:00" };
  const repo = (order: Order | null, updated = true) => {
    const shipped: [string, string][] = [];
    const r = {
      findById: async () => order,
      markShipped: async (id: string, at: string) => { shipped.push([id, at]); return updated; },
    } as unknown as OrderRepository;
    return { r, shipped };
  };

  it("ships an order that is awaiting shipment, using the clock", async () => {
    const { r, shipped } = repo(base);
    await expect(new ShipOrder(r, clock).execute("o1")).resolves.toEqual({ orderId: "o1", shippedAt: "2026-11-20 10:00:00" });
    expect(shipped).toEqual([["o1", "2026-11-20 10:00:00"]]);
  });

  it("refuses orders that are missing, already shipped or changed concurrently", async () => {
    await expect(new ShipOrder(repo(null).r, clock).execute("x")).rejects.toBeInstanceOf(NotFoundError);
    const delivered = repo({ ...base, status: "delivered", deliveredToCarrierAt: "2018-01-02 00:00:00" });
    await expect(new ShipOrder(delivered.r, clock).execute("o1")).rejects.toBeInstanceOf(ValidationError);
    expect(delivered.shipped).toEqual([]);
    await expect(new ShipOrder(repo(base, false).r, clock).execute("o1")).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("DetectRevenueAnomalies", () => {
  const data = [...month(10, 10_000), ...month(11, 30_000, 24)];

  it("scores each day against its own month and returns the selected day", async () => {
    const r = await new DetectRevenueAnomalies(fakeRevenue(data)).execute({
      year: 2017, month: 11, method: "mad", date: "2017-11-24",
    });
    expect(r.anomalies.map((d) => d.date)).toEqual(["2017-11-24"]);
    expect(r.spikes).toBe(1);
    expect(r.threshold).toBe(3.5);
    expect(r.monthStats?.baseline).toBeGreaterThan(29_000);
    expect(r.selected?.isAnomaly).toBe(true);
  });

  it("whole-year mode does not flag October just because November is higher", async () => {
    const r = await new DetectRevenueAnomalies(fakeRevenue(data)).execute({ year: 2017, month: null, method: "mad" });
    expect(r.anomalies.map((d) => d.date)).toEqual(["2017-11-24"]);
    expect(r.monthStats).toBeNull();
  });

  it("ignores days outside the data coverage", async () => {
    const r = await new DetectRevenueAnomalies(fakeRevenue(data, { first: "2017-11-01", last: "2017-11-30" }))
      .execute({ year: 2017, month: null, method: "zscore" });
    expect(r.yearDays.every((d) => d.date.startsWith("2017-11"))).toBe(true);
  });
});

describe("GetDailyRevenue", () => {
  it("returns the month with a summary and growth vs previous month", async () => {
    const data = [...month(10, 10_000), ...month(11, 20_000)];
    const r = await new GetDailyRevenue(fakeRevenue(data)).execute({ year: 2017, month: 11 });
    expect(r.days).toHaveLength(30);
    expect(r.summary.growthPct).toBeCloseTo(100, 0);
    expect(r.availableYears).toEqual([2017]);
  });
});

describe("dataset CRUD", () => {
  const repo: DatasetRepository = {
    list: async () => ({ rows: [], total: 0 }),
    insert: async (_t, v) => v,
    update: async () => null,
    delete: async () => false,
  };

  it("rejects unknown tables", async () => {
    await expect(new CreateRecord(repo).execute({ table: "pg_shadow", values: {} })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("validates before reaching the repository", async () => {
    await expect(new CreateRecord(repo).execute({ table: "sellers", values: { seller_id: "s1" } }))
      .rejects.toThrow("Zip prefix wajib diisi");
  });

  it("reports missing rows as not found", async () => {
    const key = { product_category_name: "x" };
    await expect(new UpdateRecord(repo).execute({
      table: "product_category_name_translation", key, values: { product_category_name_english: "y" },
    })).rejects.toBeInstanceOf(NotFoundError);
    await expect(new DeleteRecord(repo).execute({ table: "product_category_name_translation", key }))
      .rejects.toBeInstanceOf(NotFoundError);
  });
});
