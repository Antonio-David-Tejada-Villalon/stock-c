import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import RedisMock from "ioredis-mock";
import type { FastifyInstance } from "fastify";

// Los disparadores de notificaciones (stock bajo, movimiento rechazado)
// viven dentro de la transacción de `createMovement()` (Fase 9) — igual
// que inventory.test.ts, necesita un replica set real.
let replSet: MongoMemoryReplSet;
let app: FastifyInstance;
let ownerToken: string;
let viewerToken: string;
let lowStockProductId: string;
let rejectionProductId: string;

const OWNER_EMAIL = "owner@notifications-test.local";
const VIEWER_EMAIL = "viewer@notifications-test.local";
const PASSWORD = "clave-super-segura-123";

async function login(email: string) {
  const res = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email, password: PASSWORD },
  });
  return res.json().accessToken as string;
}

function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function move(
  token: string,
  payload: { productId: string; type: string; quantity: string; source?: "sync"; clientMutationId?: string },
) {
  return app.inject({
    method: "POST",
    url: "/stock-movements",
    headers: authHeader(token),
    payload: { clientMutationId: crypto.randomUUID(), ...payload },
  });
}

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replSet.getUri("stockc-notifications-test");
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.NODE_ENV = "test";

  const { buildApp } = await import("../src/app.js");
  const { Company } = await import("../src/db/models/company.model.js");
  const { Branch } = await import("../src/db/models/branch.model.js");
  const { Role } = await import("../src/db/models/role.model.js");
  const { User } = await import("../src/db/models/user.model.js");
  const { Product } = await import("../src/db/models/product.model.js");
  const { hashPassword } = await import("../src/modules/auth/password.js");

  app = await buildApp({ redisClient: new RedisMock(), rateLimitRedis: false });

  const company = await Company.create({ name: "Notifications Test Co", slug: "notifications-test-co" });
  await Branch.create({ companyId: company._id, name: "Central", code: "CENTRAL" });
  const passwordHash = await hashPassword(PASSWORD);

  const ownerRole = await Role.create({
    companyId: null,
    name: "Owner",
    isSystem: true,
    permissions: ["inventory:movement:create"],
  });
  const viewerRole = await Role.create({ companyId: null, name: "Visor", isSystem: true, permissions: [] });

  await User.create({
    companyId: company._id,
    email: OWNER_EMAIL,
    passwordHash,
    name: "Owner Test",
    roleId: ownerRole._id,
    branchRestrictions: [],
  });
  await User.create({
    companyId: company._id,
    email: VIEWER_EMAIL,
    passwordHash,
    name: "Viewer Test",
    roleId: viewerRole._id,
    branchRestrictions: [],
  });

  const lowStockProduct = await Product.create({
    companyId: company._id,
    sku: "NOT-001",
    name: "Producto con umbral",
    price: "10.00",
    minStock: "10",
  });
  lowStockProductId = lowStockProduct._id.toString();

  const rejectionProduct = await Product.create({
    companyId: company._id,
    sku: "NOT-002",
    name: "Producto para rechazo",
    price: "10.00",
  });
  rejectionProductId = rejectionProduct._id.toString();

  ownerToken = await login(OWNER_EMAIL);
  viewerToken = await login(VIEWER_EMAIL);
}, 60000);

afterAll(async () => {
  await app.close();
  await replSet.stop();
});

describe("Notificación de stock bajo", () => {
  it("no notifica mientras el stock se mantiene por encima del umbral", async () => {
    const res = await move(ownerToken, { productId: lowStockProductId, type: "entrada", quantity: "20" });
    expect(res.statusCode).toBe(201);

    const list = await app.inject({ method: "GET", url: "/notifications", headers: authHeader(ownerToken) });
    expect(list.json().items).toHaveLength(0);
  });

  it("notifica al cruzar el umbral hacia abajo", async () => {
    // 20 -> 5, cruza el umbral de 10
    const res = await move(ownerToken, { productId: lowStockProductId, type: "salida", quantity: "15" });
    expect(res.statusCode).toBe(201);

    const list = await app.inject({ method: "GET", url: "/notifications", headers: authHeader(ownerToken) });
    const items = list.json().items;
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("low_stock");
    expect(items[0].productId).toBe(lowStockProductId);
    expect(items[0].read).toBe(false);

    const count = await app.inject({ method: "GET", url: "/notifications/unread-count", headers: authHeader(ownerToken) });
    expect(count.json().count).toBe(1);
  });

  it("no repite la notificación mientras sigue por debajo del umbral", async () => {
    // 5 -> 4, sigue bajo, no es una transición nueva
    const res = await move(ownerToken, { productId: lowStockProductId, type: "salida", quantity: "1" });
    expect(res.statusCode).toBe(201);

    const list = await app.inject({ method: "GET", url: "/notifications", headers: authHeader(ownerToken) });
    expect(list.json().items).toHaveLength(1);
  });

  it("notifica de nuevo si se repone y vuelve a cruzar el umbral", async () => {
    // 4 -> 24 (recupera, no notifica) -> 4 (cruza de nuevo, notifica)
    const recover = await move(ownerToken, { productId: lowStockProductId, type: "entrada", quantity: "20" });
    expect(recover.statusCode).toBe(201);
    const crossAgain = await move(ownerToken, { productId: lowStockProductId, type: "salida", quantity: "20" });
    expect(crossAgain.statusCode).toBe(201);

    const list = await app.inject({ method: "GET", url: "/notifications", headers: authHeader(ownerToken) });
    const lowStockItems = list.json().items.filter((i: { type: string }) => i.type === "low_stock");
    expect(lowStockItems).toHaveLength(2);
  });
});

describe("Notificación de movimiento rechazado al sincronizar", () => {
  it("no notifica un rechazo que viene del formulario online (sin source)", async () => {
    const res = await move(ownerToken, { productId: rejectionProductId, type: "salida", quantity: "999" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("insufficient_stock");

    const list = await app.inject({ method: "GET", url: "/notifications", headers: authHeader(ownerToken) });
    expect(list.json().items.filter((i: { type: string }) => i.type === "movement_rejected")).toHaveLength(0);
  });

  it("notifica un rechazo que viene del outbox offline (source: sync)", async () => {
    const res = await move(ownerToken, {
      productId: rejectionProductId,
      type: "salida",
      quantity: "999",
      source: "sync",
    });
    expect(res.statusCode).toBe(400);

    const list = await app.inject({ method: "GET", url: "/notifications", headers: authHeader(ownerToken) });
    const rejected = list.json().items.filter((i: { type: string }) => i.type === "movement_rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0].productId).toBe(rejectionProductId);
  });

  it("no duplica la notificación si el mismo intento de sync se reintenta con el mismo clientMutationId", async () => {
    // Reproduce el incidente real: dos llamadas concurrentes (o casi) del
    // motor de sync con el mismo clientMutationId, ambas fallan con
    // insufficient_stock — solo debe quedar una notificación.
    const clientMutationId = crypto.randomUUID();
    const [first, second] = await Promise.all([
      move(ownerToken, { productId: rejectionProductId, type: "salida", quantity: "999", source: "sync", clientMutationId }),
      move(ownerToken, { productId: rejectionProductId, type: "salida", quantity: "999", source: "sync", clientMutationId }),
    ]);
    expect(first.statusCode).toBe(400);
    expect(second.statusCode).toBe(400);

    const list = await app.inject({ method: "GET", url: "/notifications", headers: authHeader(ownerToken) });
    const matching = list
      .json()
      .items.filter((i: { type: string; message: string }) => i.type === "movement_rejected");
    // 1 del test anterior + 1 de este (no 2, aunque se llamó dos veces)
    expect(matching).toHaveLength(2);
  });
});

describe("Lectura por usuario", () => {
  it("marcar como leída solo afecta al usuario que la marca", async () => {
    const list = await app.inject({ method: "GET", url: "/notifications", headers: authHeader(ownerToken) });
    const firstId = list.json().items[0].id;

    const markRes = await app.inject({
      method: "POST",
      url: `/notifications/${firstId}/read`,
      headers: authHeader(ownerToken),
    });
    expect(markRes.statusCode).toBe(204);

    const asOwner = await app.inject({ method: "GET", url: "/notifications", headers: authHeader(ownerToken) });
    expect(asOwner.json().items.find((i: { id: string }) => i.id === firstId).read).toBe(true);

    const asViewer = await app.inject({ method: "GET", url: "/notifications", headers: authHeader(viewerToken) });
    expect(asViewer.json().items.find((i: { id: string }) => i.id === firstId).read).toBe(false);
  });

  it("marcar como leída es idempotente", async () => {
    const list = await app.inject({ method: "GET", url: "/notifications", headers: authHeader(ownerToken) });
    const firstId = list.json().items[0].id;

    const first = await app.inject({ method: "POST", url: `/notifications/${firstId}/read`, headers: authHeader(ownerToken) });
    const second = await app.inject({ method: "POST", url: `/notifications/${firstId}/read`, headers: authHeader(ownerToken) });
    expect(first.statusCode).toBe(204);
    expect(second.statusCode).toBe(204);
  });
});

describe("Aislamiento por empresa", () => {
  it("no expone notificaciones de otra empresa", async () => {
    const { Company } = await import("../src/db/models/company.model.js");
    const { Branch } = await import("../src/db/models/branch.model.js");
    const { Role } = await import("../src/db/models/role.model.js");
    const { User } = await import("../src/db/models/user.model.js");
    const { hashPassword } = await import("../src/modules/auth/password.js");

    const otherCompany = await Company.create({ name: "Other Notifications Co", slug: "other-notifications-co" });
    await Branch.create({ companyId: otherCompany._id, name: "Central", code: "CENTRAL" });
    const role = await Role.create({ companyId: null, name: "Owner", isSystem: true, permissions: [] });
    const passwordHash = await hashPassword(PASSWORD);
    await User.create({
      companyId: otherCompany._id,
      email: "owner@other-notifications-co.local",
      passwordHash,
      name: "Other Owner",
      roleId: role._id,
      branchRestrictions: [],
    });
    const otherToken = await login("owner@other-notifications-co.local");

    const list = await app.inject({ method: "GET", url: "/notifications", headers: authHeader(otherToken) });
    expect(list.json().items).toEqual([]);
    const count = await app.inject({ method: "GET", url: "/notifications/unread-count", headers: authHeader(otherToken) });
    expect(count.json().count).toBe(0);
  });
});
