// Controllers: convert an HTTP request into use case input, and the use case
// output (or a domain error) into an HTTP response. They depend on the use
// cases (inward), never on the database or the web framework.
import type { Authenticate } from "@/core/application/use-cases/authenticate";
import type { Login } from "@/core/application/use-cases/login";
import type { CreateRecord, DeleteRecord, ListRecords, UpdateRecord } from "@/core/application/use-cases/manage-dataset";
import type { ShipOrder } from "@/core/application/use-cases/ship-order";
import { presentError } from "./error-presenter";
import { clearSessionCookie, readCookie, sessionCookie } from "./session-cookie";

async function body(request: Request): Promise<Record<string, unknown>> {
  const data = await request.json().catch(() => null);
  return data && typeof data === "object" ? data : {};
}

/** Wrap a handler: require a session, present any error. */
function secured(auth: Authenticate, handler: () => Promise<Response>) {
  return async (request: Request) => {
    try {
      await auth.require(readCookie(request));
      return await handler();
    } catch (err) {
      return presentError(err);
    }
  };
}

export class AuthController {
  constructor(private readonly login: Login, private readonly secureCookie: boolean) {}

  async postLogin(request: Request): Promise<Response> {
    try {
      const b = await body(request);
      const out = await this.login.execute({ email: String(b.email ?? ""), password: String(b.password ?? "") });
      const res = Response.json({ ok: true, user: { name: out.user.name, email: out.user.email } });
      res.headers.append("Set-Cookie", sessionCookie(out.token, out.expiresIn, this.secureCookie));
      return res;
    } catch (err) {
      return presentError(err);
    }
  }

  postLogout(): Response {
    const res = Response.json({ ok: true });
    res.headers.append("Set-Cookie", clearSessionCookie());
    return res;
  }
}

export class DatasetController {
  constructor(
    private readonly auth: Authenticate,
    private readonly uc: { list: ListRecords; create: CreateRecord; update: UpdateRecord; remove: DeleteRecord },
  ) {}

  list(request: Request, table: string) {
    const p = new URL(request.url).searchParams;
    return secured(this.auth, async () =>
      Response.json(await this.uc.list.execute({
        table, q: p.get("q"), page: p.get("page"), pageSize: p.get("pageSize"), sort: p.get("sort"), dir: p.get("dir"),
      })),
    )(request);
  }

  create(request: Request, table: string) {
    return secured(this.auth, async () => {
      const b = await body(request);
      return Response.json({ row: await this.uc.create.execute({ table, values: b.values }) }, { status: 201 });
    })(request);
  }

  update(request: Request, table: string) {
    return secured(this.auth, async () => {
      const b = await body(request);
      return Response.json({ row: await this.uc.update.execute({ table, key: b.key, values: b.values }) });
    })(request);
  }

  remove(request: Request, table: string) {
    return secured(this.auth, async () => {
      const b = await body(request);
      await this.uc.remove.execute({ table, key: b.key });
      return Response.json({ ok: true });
    })(request);
  }
}

export class OrderController {
  constructor(private readonly auth: Authenticate, private readonly shipOrder: ShipOrder) {}

  ship(request: Request, orderId: string) {
    return secured(this.auth, async () => Response.json({ ok: true, ...(await this.shipOrder.execute(orderId)) }))(request);
  }
}
