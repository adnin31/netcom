import { describe, expect, it } from "vitest";
import { detectAnomalies } from "./anomaly";
import { getTable, normalizeListQuery, parseKey, parseRecord } from "./dataset";
import { ValidationError } from "./errors";
import { assertCanShip, isAwaitingShipment, waitingInfo, type Order } from "./order";
import { daysBetween, isIsoDate, monthRange, previousMonth } from "./period";
import { clipToCoverage, summarizeMonth, type DayRevenue } from "./revenue";

const day = (d: number, revenue: number, orders = 10): DayRevenue => ({
  date: `2017-11-${String(d).padStart(2, "0")}`, revenue, orders,
});
// 30 ordinary days around 30k with a Black-Friday-like spike on the 24th.
const november = Array.from({ length: 30 }, (_, i) =>
  day(i + 1, i + 1 === 24 ? 178_000 : 30_000 + ((i * 7919) % 9000) - 4500),
);

describe("anomaly detection", () => {
  it("flags the spike with the robust MAD method", () => {
    const { days } = detectAnomalies(november, "mad");
    const flagged = days.filter((d) => d.isAnomaly);
    expect(flagged.map((d) => d.date)).toEqual(["2017-11-24"]);
    expect(flagged[0].direction).toBe("spike");
    expect(flagged[0].deviationPct).toBeGreaterThan(400);
  });

  it("flags drops below the normal band", () => {
    const series = november.map((d) => (d.date === "2017-11-10" ? { ...d, revenue: 500 } : d));
    const { days } = detectAnomalies(series, "iqr");
    expect(days.find((d) => d.date === "2017-11-10")?.direction).toBe("drop");
  });

  it("does not flag anything with fewer than 7 days of data", () => {
    const { days } = detectAnomalies(november.slice(20, 26), "zscore", 1);
    expect(days.some((d) => d.isAnomaly)).toBe(false);
  });
});

describe("revenue rules", () => {
  it("summarizes a month and computes growth vs previous month", () => {
    const s = summarizeMonth([day(1, 100, 2), day(2, 0, 0), day(3, 300, 3)], 200);
    expect(s).toMatchObject({ total: 400, orders: 5, activeDays: 2, averagePerActiveDay: 200, averageOrderValue: 80 });
    expect(s.best?.date).toBe("2017-11-03");
    expect(s.worst?.date).toBe("2017-11-01");
    expect(s.growthPct).toBe(100);
  });

  it("has no growth when there is no previous revenue", () => {
    expect(summarizeMonth([day(1, 100)], null).growthPct).toBeNull();
  });

  it("drops days outside the data coverage", () => {
    expect(clipToCoverage(november, { first: "2017-11-05", last: "2017-11-06" }).map((d) => d.date))
      .toEqual(["2017-11-05", "2017-11-06"]);
  });
});

describe("order rules", () => {
  const order = (patch: Partial<Order> = {}): Order => ({
    id: "a", customerId: "c", status: "processing", purchasedAt: "2018-01-01 10:00:00",
    deliveredToCarrierAt: null, estimatedDeliveryAt: "2018-01-20 00:00:00", ...patch,
  });

  it("only orders still waiting can be shipped", () => {
    expect(isAwaitingShipment(order())).toBe(true);
    expect(() => assertCanShip(order())).not.toThrow();
    expect(() => assertCanShip(order({ status: "canceled" }))).toThrow(ValidationError);
    expect(() => assertCanShip(order({ status: "shipped", deliveredToCarrierAt: "2018-01-02 00:00:00" }))).toThrow(ValidationError);
  });

  it("computes waiting days and overdue flag relative to a reference date", () => {
    expect(waitingInfo("2018-01-01 10:00", "2018-01-20", "2018-02-01")).toEqual({ daysWaiting: 30, overdue: true });
    expect(waitingInfo("2018-01-01 10:00", "2018-03-01", "2018-02-01").overdue).toBe(false);
  });
});

describe("periods", () => {
  it("handles month boundaries", () => {
    expect(monthRange(2017, 12)).toEqual({ start: "2017-12-01", end: "2018-01-01" });
    expect(previousMonth(2018, 1)).toEqual({ year: 2017, month: 12 });
    expect(daysBetween("2017-11-01", "2017-12-01")).toBe(30);
  });

  it("validates ISO dates", () => {
    expect(isIsoDate("2017-11-24")).toBe(true);
    expect(isIsoDate("2017-02-30")).toBe(false);
    expect(isIsoDate("24-11-2017")).toBe(false);
  });
});

describe("dataset validation", () => {
  const items = getTable("order_items")!;

  it("coerces types and lowercases ids", () => {
    const rec = parseRecord(items, {
      order_id: "ABC123", order_item_id: "2", product_id: "p1", seller_id: "s1",
      shipping_limit_date: "2018-01-01T10:00", price: "10.5", freight_value: "0",
    }, "create");
    expect(rec).toEqual({
      order_id: "abc123", order_item_id: 2, product_id: "p1", seller_id: "s1",
      shipping_limit_date: "2018-01-01 10:00", price: 10.5, freight_value: 0,
    });
  });

  it("rejects invalid values with a readable message", () => {
    expect(() => parseRecord(items, { order_id: "a", order_item_id: "x" }, "create")).toThrow("Item # harus bilangan bulat");
    expect(() => parseRecord(items, { price: "-1" }, "update")).toThrow("tidak boleh negatif");
    expect(() => parseRecord(items, { order_id: "a;drop" }, "create")).toThrow(ValidationError);
  });

  it("ignores primary key columns on update", () => {
    expect(parseRecord(items, { order_id: "zzz", price: "5" }, "update")).toEqual({ price: 5 });
  });

  it("requires every part of a composite key", () => {
    expect(parseKey(items, { order_id: "a", order_item_id: 1 })).toEqual({ order_id: "a", order_item_id: "1" });
    expect(() => parseKey(items, { order_id: "a" })).toThrow("order_item_id");
  });

  it("whitelists the sort column and bounds the page size", () => {
    const q = normalizeListQuery(items, { sort: "price; drop table orders", pageSize: 10_000, page: -3 });
    expect(q).toMatchObject({ sort: items.defaultSort.column, pageSize: 100, page: 1 });
  });
});
