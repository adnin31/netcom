// Composition root: the only place that knows every concrete class and wires
// adapters into use cases. Everything else depends on abstractions.
import "server-only";
import { connection } from "next/server";
import { AuthController, DatasetController, OrderController } from "@/adapters/http/controllers";
import { PostgresDashboardRepository } from "@/adapters/persistence/postgres/dashboard-repository";
import { PostgresDatasetRepository } from "@/adapters/persistence/postgres/dataset-repository";
import { PostgresOrderRepository } from "@/adapters/persistence/postgres/order-repository";
import { PostgresRevenueRepository } from "@/adapters/persistence/postgres/revenue-repository";
import { PostgresUserRepository } from "@/adapters/persistence/postgres/user-repository";
import { BcryptPasswordHasher } from "@/adapters/security/bcrypt-password-hasher";
import { JoseTokenService } from "@/adapters/security/jose-token-service";
import { SystemClock } from "@/adapters/system-clock";
import { Authenticate } from "@/core/application/use-cases/authenticate";
import { DetectRevenueAnomalies } from "@/core/application/use-cases/detect-revenue-anomalies";
import { GetDailyRevenue } from "@/core/application/use-cases/get-daily-revenue";
import { GetDayBreakdown } from "@/core/application/use-cases/get-day-breakdown";
import { GetOverview } from "@/core/application/use-cases/get-overview";
import { ListUnshippedOrders } from "@/core/application/use-cases/list-unshipped-orders";
import { Login } from "@/core/application/use-cases/login";
import { CreateRecord, DeleteRecord, ListRecords, UpdateRecord } from "@/core/application/use-cases/manage-dataset";
import { ShipOrder } from "@/core/application/use-cases/ship-order";
import { config } from "./config";
import { getDatabase } from "./database";

function build() {
  const sql = getDatabase();
  const revenue = new PostgresRevenueRepository(sql);
  const orders = new PostgresOrderRepository(sql);
  const dataset = new PostgresDatasetRepository(sql);
  const tokens = new JoseTokenService(config.authSecret, config.sessionTtlSeconds);
  const authenticate = new Authenticate(tokens);

  const useCases = {
    authenticate,
    login: new Login(new PostgresUserRepository(sql), new BcryptPasswordHasher(), tokens),
    getOverview: new GetOverview(new PostgresDashboardRepository(sql), revenue),
    getDailyRevenue: new GetDailyRevenue(revenue),
    detectRevenueAnomalies: new DetectRevenueAnomalies(revenue),
    getDayBreakdown: new GetDayBreakdown(revenue),
    listUnshippedOrders: new ListUnshippedOrders(orders, revenue),
    shipOrder: new ShipOrder(orders, new SystemClock()),
    listRecords: new ListRecords(dataset),
    createRecord: new CreateRecord(dataset),
    updateRecord: new UpdateRecord(dataset),
    deleteRecord: new DeleteRecord(dataset),
  };

  const controllers = {
    auth: new AuthController(useCases.login, config.cookieSecure),
    dataset: new DatasetController(authenticate, {
      list: useCases.listRecords,
      create: useCases.createRecord,
      update: useCases.updateRecord,
      remove: useCases.deleteRecord,
    }),
    orders: new OrderController(authenticate, useCases.shipOrder),
  };

  return { useCases, controllers };
}

let instance: ReturnType<typeof build> | undefined;

/** Lazily built so `next build` never needs secrets or a database. */
export function container() {
  instance ??= build();
  return instance;
}

/**
 * For Server Components: wait for an incoming request first, so data is never
 * fetched during prerendering (Next.js Cache Components).
 */
export async function getUseCases() {
  await connection();
  return container().useCases;
}
