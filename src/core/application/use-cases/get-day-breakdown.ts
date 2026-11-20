import { ValidationError } from "../../domain/errors";
import { isIsoDate } from "../../domain/period";
import type { RevenueRepository } from "../ports";

export class GetDayBreakdown {
  constructor(private readonly revenue: RevenueRepository) {}

  async execute(date: string) {
    if (!isIsoDate(date)) throw new ValidationError("Tanggal tidak valid");
    return this.revenue.dayBreakdown(date);
  }
}

export type DayBreakdownOutput = Awaited<ReturnType<GetDayBreakdown["execute"]>>;
