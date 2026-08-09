import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import RedisMock from "ioredis-mock";
import type { FastifyInstance } from "fastify";

// Las transacciones de Mongo (Fase 9, docs/09-control-inventario.md,
// sección 9) requieren un replica set — a diferencia de las fases
// anteriores, acá no alcanza con MongoMemoryServer standalone.
let replSet: MongoMemoryReplSet;
let app: FastifyInstance;
let ownerToken: string;
let viewerToken: string;
let productId: string;

const OWNER_EMAIL = "owner@inventory-test.local";
const VIEWER_EMAIL = "viewer@inventory-test.local";
const PASSWORD = "clave-super-segura-123";

async function login(email: string) {
  const res = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email, password: PASSWORD },
  });
  return res.json().accessToken as string;
}

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replSet.getUri("stockc-inventory-test");
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

  const company = await Company.create({ name: "Inventory Test Co", slug: "inventory-test-co" });
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

  const product = await Product.create({ companyId: company._id, sku: "INV-001", name: "Martillo", price: "100.00" });
  productId = product._id.toString();

  ownerToken = await login(OWNER_EMAIL);
  viewerToken = await login(VIEWER_EMAIL);
}, 60000);

afterAll(async () => {
  await app.close();
  await replSet.stop();
});

function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}

describe("POST /stock-movements", () => {
  it("requires the inventory:movement:create permission", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/stock-movements",
      headers: authHeader(viewerToken),
      payload: { productId, type: "entrada", quantity: "10", clientMutationId: crypto.randomUUID() },
    });
    expect(res.statusCode).toBe(403);
  });

  it("creates an entrada and updates the stock level", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/stock-movements",
      headers: authHeader(ownerToken),
      payload: { productId, type: "entrada", quantity: "10", clientMutationId: crypto.randomUUID() },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.movement.type).toBe("entrada");
    expect(body.movement.quantity).toBe("10");
    expect(body.movement.sequence).toBe(1);
    expect(body.stockLevel.quantity).toBe("10");
  });

  it("creates a salida and reduces the stock level", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/stock-movements",
      headers: authHeader(ownerToken),
      payload: { productId, type: "salida", quantity: "4", clientMutationId: crypto.randomUUID() },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.stockLevel.quantity).toBe("6");
  });

  it("rejects a salida that would leave stock negative", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/stock-movements",
      headers: authHeader(ownerToken),
      payload: { productId, type: "salida", quantity: "999", clientMutationId: crypto.randomUUID() },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("insufficient_stock");
  });

  it("requires a reason for ajuste", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/stock-movements",
      headers: authHeader(ownerToken),
      payload: { productId, type: "ajuste", quantity: "-1", clientMutationId: crypto.randomUUID() },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("reason_required");
  });

  it("applies a negative ajuste to subtract stock, with a reason", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/stock-movements",
      headers: authHeader(ownerToken),
      payload: {
        productId,
        type: "ajuste",
        quantity: "-2",
        reason: "Corrección de conteo físico",
        clientMutationId: crypto.randomUUID(),
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().stockLevel.quantity).toBe("4");
  });

  it("does not duplicate a movement when clientMutationId is retried", async () => {
    const clientMutationId = crypto.randomUUID();
    const first = await app.inject({
      method: "POST",
      url: "/stock-movements",
      headers: authHeader(ownerToken),
      payload: { productId, type: "entrada", quantity: "1", clientMutationId },
    });
    expect(first.statusCode).toBe(201);
    const stockAfterFirst = first.json().stockLevel.quantity;

    const retry = await app.inject({
      method: "POST",
      url: "/stock-movements",
      headers: authHeader(ownerToken),
      payload: { productId, type: "entrada", quantity: "1", clientMutationId },
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.json().movement.id).toBe(first.json().movement.id);
    expect(retry.json().stockLevel.quantity).toBe(stockAfterFirst);
  });
});

describe("Aviso de posible duplicado", () => {
  let dupProductId: string;
  let operator2Token: string;

  beforeAll(async () => {
    const { Company } = await import("../src/db/models/company.model.js");
    const { Product } = await import("../src/db/models/product.model.js");
    const { Role } = await import("../src/db/models/role.model.js");
    const { User } = await import("../src/db/models/user.model.js");
    const { hashPassword } = await import("../src/modules/auth/password.js");

    const company = await Company.findOne({ slug: "inventory-test-co" });
    const product = await Product.create({ companyId: company!._id, sku: "INV-DUP", name: "Tornillo", price: "5.00" });
    dupProductId = product._id.toString();

    const role = await Role.findOne({ name: "Owner", isSystem: true, companyId: null });
    const passwordHash = await hashPassword(PASSWORD);
    await User.create({
      companyId: company!._id,
      email: "operator2@inventory-test.local",
      passwordHash,
      name: "Operator Two",
      roleId: role!._id,
      branchRestrictions: [],
    });
    operator2Token = await login("operator2@inventory-test.local");
  });

  it("avisa cuando otro usuario registró el mismo producto y tipo hace poco", async () => {
    const first = await app.inject({
      method: "POST",
      url: "/stock-movements",
      headers: authHeader(ownerToken),
      payload: { productId: dupProductId, type: "entrada", quantity: "5", clientMutationId: crypto.randomUUID() },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: "POST",
      url: "/stock-movements",
      headers: authHeader(operator2Token),
      payload: { productId: dupProductId, type: "entrada", quantity: "5", clientMutationId: crypto.randomUUID() },
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error).toBe("possible_duplicate");
    expect(second.json().detail.byUserName).toBe("Owner Test");
  });

  it("no avisa cuando es el mismo usuario repitiendo la acción", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/stock-movements",
      headers: authHeader(ownerToken),
      payload: { productId: dupProductId, type: "entrada", quantity: "3", clientMutationId: crypto.randomUUID() },
    });
    expect(res.statusCode).toBe(201);
  });

  it("no avisa para un tipo de movimiento distinto", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/stock-movements",
      headers: authHeader(operator2Token),
      payload: { productId: dupProductId, type: "salida", quantity: "1", clientMutationId: crypto.randomUUID() },
    });
    expect(res.statusCode).toBe(201);
  });

  it("confirmDuplicate:true salta el aviso y registra igual", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/stock-movements",
      headers: authHeader(operator2Token),
      payload: {
        productId: dupProductId,
        type: "entrada",
        quantity: "5",
        clientMutationId: crypto.randomUUID(),
        confirmDuplicate: true,
      },
    });
    expect(res.statusCode).toBe(201);
  });
});

describe("GET /stock-movements (kardex)", () => {
  it("pages through a product's kardex ordered by sequence, without gaps or repeats", async () => {
    const seenSequences: number[] = [];
    let cursor: string | undefined;
    do {
      const res = await app.inject({
        method: "GET",
        url: `/stock-movements?productId=${productId}&limit=2${cursor ? `&cursor=${cursor}` : ""}`,
        headers: authHeader(ownerToken),
      });
      const body = res.json();
      for (const item of body.items) seenSequences.push(item.sequence);
      cursor = body.nextCursor ?? undefined;
    } while (cursor);

    expect(new Set(seenSequences).size).toBe(seenSequences.length);
    const sorted = [...seenSequences].sort((a, b) => b - a);
    expect(seenSequences).toEqual(sorted);
  });
});

describe("Aislamiento por empresa", () => {
  it("keeps stock movements and levels isolated per company", async () => {
    const { Company } = await import("../src/db/models/company.model.js");
    const { Branch } = await import("../src/db/models/branch.model.js");
    const { Role } = await import("../src/db/models/role.model.js");
    const { User } = await import("../src/db/models/user.model.js");
    const { hashPassword } = await import("../src/modules/auth/password.js");

    const otherCompany = await Company.create({ name: "Other Inventory Co", slug: "other-inventory-co" });
    await Branch.create({ companyId: otherCompany._id, name: "Central", code: "CENTRAL" });
    const role = await Role.create({ companyId: null, name: "Owner", isSystem: true, permissions: [] });
    const passwordHash = await hashPassword(PASSWORD);
    await User.create({
      companyId: otherCompany._id,
      email: "owner@other-inventory-co.local",
      passwordHash,
      name: "Other Owner",
      roleId: role._id,
      branchRestrictions: [],
    });
    const otherToken = await login("owner@other-inventory-co.local");

    const movements = await app.inject({
      method: "GET",
      url: "/stock-movements",
      headers: authHeader(otherToken),
    });
    expect(movements.json().items).toEqual([]);

    const levels = await app.inject({
      method: "GET",
      url: `/stock-levels?productIds=${productId}`,
      headers: authHeader(otherToken),
    });
    expect(levels.json().items).toEqual([{ productId, quantity: "0" }]);
  });
});

describe("Sucursal única implícita", () => {
  it("fails loudly when a company has more than one active branch", async () => {
    const { Company } = await import("../src/db/models/company.model.js");
    const { Branch } = await import("../src/db/models/branch.model.js");
    const { Role } = await import("../src/db/models/role.model.js");
    const { User } = await import("../src/db/models/user.model.js");
    const { hashPassword } = await import("../src/modules/auth/password.js");

    const multiCompany = await Company.create({ name: "Multi Branch Co", slug: "multi-branch-co" });
    await Branch.create({ companyId: multiCompany._id, name: "Norte", code: "NORTE" });
    await Branch.create({ companyId: multiCompany._id, name: "Sur", code: "SUR" });
    const role = await Role.create({
      companyId: null,
      name: "Owner",
      isSystem: true,
      permissions: ["inventory:movement:create"],
    });
    const passwordHash = await hashPassword(PASSWORD);
    await User.create({
      companyId: multiCompany._id,
      email: "owner@multi-branch-co.local",
      passwordHash,
      name: "Multi Owner",
      roleId: role._id,
      branchRestrictions: [],
    });
    const multiToken = await login("owner@multi-branch-co.local");

    const res = await app.inject({
      method: "GET",
      url: "/stock-movements",
      headers: authHeader(multiToken),
    });
    expect(res.statusCode).toBe(500);
    expect(res.json().error).toBe("no_active_branch");
  });
});
