import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import RedisMock from "ioredis-mock";
import type { FastifyInstance } from "fastify";

let mongod: MongoMemoryServer;
let app: FastifyInstance;
let accessToken: string;

const EMAIL = "owner@dashboard-test.local";
const PASSWORD = "clave-super-segura-123";

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("stockc-dashboard-test");
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.NODE_ENV = "test";

  const { buildApp } = await import("../src/app.js");
  const { Company } = await import("../src/db/models/company.model.js");
  const { Branch } = await import("../src/db/models/branch.model.js");
  const { Role } = await import("../src/db/models/role.model.js");
  const { User } = await import("../src/db/models/user.model.js");
  const { hashPassword } = await import("../src/modules/auth/password.js");

  app = await buildApp({ redisClient: new RedisMock(), rateLimitRedis: false });

  const company = await Company.create({ name: "Dashboard Test Co", slug: "dashboard-test-co" });
  await Branch.create({ companyId: company._id, name: "Central", code: "CENTRAL" });
  await Branch.create({ companyId: company._id, name: "Norte", code: "NORTE" });
  await Branch.create({
    companyId: company._id,
    name: "Cerrada",
    code: "CERRADA",
    active: false,
  });

  const role = await Role.create({
    companyId: null,
    name: "Owner",
    isSystem: true,
    permissions: [],
  });
  const passwordHash = await hashPassword(PASSWORD);
  await User.create({
    companyId: company._id,
    email: EMAIL,
    passwordHash,
    name: "Owner Test",
    roleId: role._id,
    branchRestrictions: [],
  });
  // Un segundo usuario activo y uno inactivo, para probar el filtro.
  await User.create({
    companyId: company._id,
    email: "segundo@dashboard-test.local",
    passwordHash,
    name: "Segundo Usuario",
    roleId: role._id,
    branchRestrictions: [],
  });
  await User.create({
    companyId: company._id,
    email: "inactivo@dashboard-test.local",
    passwordHash,
    name: "Usuario Inactivo",
    roleId: role._id,
    branchRestrictions: [],
    active: false,
  });

  const login = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: EMAIL, password: PASSWORD },
  });
  accessToken = login.json().accessToken;
});

afterAll(async () => {
  await app.close();
  await mongod.stop();
});

describe("GET /dashboard/summary", () => {
  it("requires a bearer token", async () => {
    const res = await app.inject({ method: "GET", url: "/dashboard/summary" });
    expect(res.statusCode).toBe(401);
  });

  it("returns counts scoped to the caller's company, excluding inactive records", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/dashboard/summary",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    // Esta empresa tiene 2 sucursales activas a propósito (para probar el
    // filtro de branchCount) — por eso movementsTodayCount/recentMovements
    // quedan en su valor "sin sucursal única resuelta" (ver dashboard.routes.ts).
    expect(res.json()).toEqual({
      branchCount: 2,
      activeUserCount: 2,
      productCount: 0,
      movementsTodayCount: 0,
      lowStockCount: 0,
      recentMovements: [],
    });
  });

  it("counts today's movements and lists the most recent ones when there is exactly one active branch", async () => {
    const { Company } = await import("../src/db/models/company.model.js");
    const { Branch } = await import("../src/db/models/branch.model.js");
    const { Role } = await import("../src/db/models/role.model.js");
    const { User } = await import("../src/db/models/user.model.js");
    const { Product } = await import("../src/db/models/product.model.js");
    const { StockMovement } = await import("../src/db/models/stockMovement.model.js");
    const { StockLevel } = await import("../src/db/models/stockLevel.model.js");
    const { hashPassword } = await import("../src/modules/auth/password.js");

    const company = await Company.create({ name: "Single Branch Co", slug: "single-branch-co" });
    const branch = await Branch.create({ companyId: company._id, name: "Central", code: "CENTRAL" });
    const role = await Role.create({ companyId: null, name: "Owner", isSystem: true, permissions: [] });
    const passwordHash = await hashPassword(PASSWORD);
    await User.create({
      companyId: company._id,
      email: "owner@single-branch-co.local",
      passwordHash,
      name: "Owner",
      roleId: role._id,
      branchRestrictions: [],
    });
    const product = await Product.create({ companyId: company._id, sku: "DASH-001", name: "Producto Dashboard", price: "1.00" });
    await StockMovement.create({
      companyId: company._id,
      branchId: branch._id,
      productId: product._id,
      type: "entrada",
      quantity: "5",
      sequence: 1,
      clientMutationId: "dash-test-1",
      createdBy: role._id,
      clientCreatedAt: new Date(),
    });
    // Producto con umbral cargado y stock por debajo — debe contar en
    // lowStockCount (Fase 11).
    const lowStockProduct = await Product.create({
      companyId: company._id,
      sku: "DASH-002",
      name: "Bajo stock",
      price: "1.00",
      minStock: "10",
    });
    await StockLevel.create({ companyId: company._id, branchId: branch._id, productId: lowStockProduct._id, quantity: "3" });

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "owner@single-branch-co.local", password: PASSWORD },
    });
    const singleBranchToken = login.json().accessToken;

    const res = await app.inject({
      method: "GET",
      url: "/dashboard/summary",
      headers: { authorization: `Bearer ${singleBranchToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.movementsTodayCount).toBe(1);
    expect(body.lowStockCount).toBe(1);
    expect(body.recentMovements).toHaveLength(1);
    expect(body.recentMovements[0]).toMatchObject({
      productName: "Producto Dashboard",
      type: "entrada",
      quantity: "5",
    });
  });
});
