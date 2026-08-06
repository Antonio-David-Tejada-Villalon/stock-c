import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import RedisMock from "ioredis-mock";
import type { FastifyInstance } from "fastify";

// Reportes son de solo lectura — a diferencia de inventory.test.ts (que
// necesita transacciones reales para POST /stock-movements), acá los
// fixtures de stockLevels/stockMovements se siembran directo con los
// modelos de Mongoose, sin pasar por el service transaccional de Fase 9.
// No hace falta un replica set.
let mongod: MongoMemoryServer;
let app: FastifyInstance;
let ownerToken: string;
let viewerToken: string; // permisos vacíos — confirma que reportes no exige un permiso nuevo
let categoryA: string;
let productWithCost1: string;
let productWithCost2: string;
let productLowStock: string;
let productOkStock: string;
let productNoThreshold: string;

const OWNER_EMAIL = "owner@reports-test.local";
const VIEWER_EMAIL = "viewer@reports-test.local";
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

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("stockc-reports-test");
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.NODE_ENV = "test";

  const { buildApp } = await import("../src/app.js");
  const { Company } = await import("../src/db/models/company.model.js");
  const { Branch } = await import("../src/db/models/branch.model.js");
  const { Role } = await import("../src/db/models/role.model.js");
  const { User } = await import("../src/db/models/user.model.js");
  const { Category } = await import("../src/db/models/category.model.js");
  const { Product } = await import("../src/db/models/product.model.js");
  const { StockLevel } = await import("../src/db/models/stockLevel.model.js");
  const { StockMovement } = await import("../src/db/models/stockMovement.model.js");
  const { hashPassword } = await import("../src/modules/auth/password.js");

  app = await buildApp({ redisClient: new RedisMock(), rateLimitRedis: false });

  const company = await Company.create({ name: "Reports Test Co", slug: "reports-test-co" });
  const branch = await Branch.create({ companyId: company._id, name: "Central", code: "CENTRAL" });
  const passwordHash = await hashPassword(PASSWORD);

  const ownerRole = await Role.create({ companyId: null, name: "Owner", isSystem: true, permissions: [] });
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
    roleId: ownerRole._id,
    branchRestrictions: [],
  });

  const catA = await Category.create({ companyId: company._id, name: "Herramientas" });
  const catB = await Category.create({ companyId: company._id, name: "Consumibles" });
  categoryA = catA._id.toString();

  const p1 = await Product.create({
    companyId: company._id,
    sku: "RPT-001",
    name: "Martillo",
    price: "20.00",
    cost: "10.00",
    categoryId: catA._id,
  });
  const p2 = await Product.create({
    companyId: company._id,
    sku: "RPT-002",
    name: "Destornillador",
    price: "8.00",
    cost: "4.00",
    categoryId: catA._id,
  });
  await Product.create({ companyId: company._id, sku: "RPT-003", name: "Sin costo", price: "5.00" });
  const p4 = await Product.create({
    companyId: company._id,
    sku: "RPT-004",
    name: "Tornillos",
    price: "1.00",
    categoryId: catB._id,
    minStock: "50",
  });
  const p5 = await Product.create({
    companyId: company._id,
    sku: "RPT-005",
    name: "Clavos",
    price: "1.00",
    categoryId: catB._id,
    minStock: "10",
  });
  const p6 = await Product.create({ companyId: company._id, sku: "RPT-006", name: "Sin umbral", price: "1.00" });
  const inactive = await Product.create({
    companyId: company._id,
    sku: "RPT-007",
    name: "Descontinuado",
    price: "1.00",
    active: false,
  });
  productWithCost1 = p1._id.toString();
  productWithCost2 = p2._id.toString();
  productLowStock = p4._id.toString();
  productOkStock = p5._id.toString();
  productNoThreshold = p6._id.toString();
  void inactive;

  await StockLevel.create({ companyId: company._id, branchId: branch._id, productId: p1._id, quantity: "5" });
  await StockLevel.create({ companyId: company._id, branchId: branch._id, productId: p2._id, quantity: "3" });
  await StockLevel.create({ companyId: company._id, branchId: branch._id, productId: p4._id, quantity: "20" }); // 20 < minStock 50
  await StockLevel.create({ companyId: company._id, branchId: branch._id, productId: p5._id, quantity: "40" }); // 40 >= minStock 10

  const OLD_DATE = new Date("2026-01-01T10:00:00.000Z");
  const RECENT_DATE = new Date("2026-06-01T10:00:00.000Z");
  const owner = await User.findOne({ companyId: company._id, email: OWNER_EMAIL });

  await StockMovement.create([
    {
      companyId: company._id,
      branchId: branch._id,
      productId: p1._id,
      type: "entrada",
      quantity: "5",
      sequence: 1,
      clientMutationId: "seed-1",
      createdBy: owner!._id,
      clientCreatedAt: OLD_DATE,
      createdAt: OLD_DATE,
    },
    {
      companyId: company._id,
      branchId: branch._id,
      productId: p2._id,
      type: "entrada",
      quantity: "3",
      sequence: 1,
      clientMutationId: "seed-2",
      createdBy: owner!._id,
      clientCreatedAt: RECENT_DATE,
      createdAt: RECENT_DATE,
    },
    {
      companyId: company._id,
      branchId: branch._id,
      productId: p1._id,
      type: "salida",
      quantity: "2",
      sequence: 2,
      clientMutationId: "seed-3",
      createdBy: owner!._id,
      clientCreatedAt: RECENT_DATE,
      createdAt: RECENT_DATE,
    },
  ]);

  ownerToken = await login(OWNER_EMAIL);
  viewerToken = await login(VIEWER_EMAIL);
}, 60000);

afterAll(async () => {
  await app.close();
  await mongod.stop();
});

describe("GET /reports/inventory-valuation", () => {
  it("valoriza solo productos activos con costo cargado, agrupa por categoría, y cuenta los excluidos", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/reports/inventory-valuation",
      headers: authHeader(ownerToken),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    // p1: 5 * 10.00 = 50.00 — p2: 3 * 4.00 = 12.00 — total 62.00
    expect(body.grandTotal).toBe("62.0000");
    // p3 (sin costo), p4/p5/p6 (sin costo) están activos y sin costo → excluidos
    expect(body.excludedCount).toBe(4);
    expect(body.items).toHaveLength(2);
    expect(body.items.map((i: { productId: string }) => i.productId).sort()).toEqual(
      [productWithCost1, productWithCost2].sort(),
    );

    const herramientas = body.byCategory.find((g: { id: string }) => g.id === categoryA);
    expect(herramientas.totalValue).toBe("62.0000");
  });

  it("no exige ningún permiso extra, alcanza con estar autenticado", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/reports/inventory-valuation",
      headers: authHeader(viewerToken),
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("GET /reports/movements", () => {
  it("filtra por rango de fechas", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/reports/movements?dateFrom=2026-05-01&dateTo=2026-06-30",
      headers: authHeader(ownerToken),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Solo los 2 movimientos de RECENT_DATE (2026-06-01) — el de OLD_DATE
    // (2026-01-01) queda fuera del rango.
    expect(body.items).toHaveLength(2);
    expect(body.totalsByType.entrada).toBe("3.0000");
    expect(body.totalsByType.salida).toBe("2.0000");
  });

  it("filtra por categoría", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/reports/movements?dateFrom=2026-01-01&dateTo=2026-12-31&categoryId=${categoryA}`,
      headers: authHeader(ownerToken),
    });
    const body = res.json();
    // Los 3 movimientos son de p1/p2, ambos en categoryA
    expect(body.items).toHaveLength(3);
  });

  it("rechaza un rango de fechas inválido (desde > hasta)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/reports/movements?dateFrom=2026-12-31&dateTo=2026-01-01",
      headers: authHeader(ownerToken),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_date_range");
  });
});

describe("GET /reports/catalog-summary", () => {
  it("cuenta activos/inactivos y agrupa stock por categoría, con balde 'sin categoría'", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/reports/catalog-summary",
      headers: authHeader(ownerToken),
    });
    const body = res.json();
    expect(body.totalActiveProducts).toBe(6);
    expect(body.totalInactiveProducts).toBe(1);

    const sinCategoria = body.byCategory.find((g: { id: string }) => g.id === "none");
    expect(sinCategoria).toBeDefined();
    expect(sinCategoria.activeCount).toBe(2); // productNoCost + productNoThreshold
  });
});

describe("GET /reports/low-stock", () => {
  it("solo incluye productos con minStock cargado y stock por debajo del umbral", async () => {
    const res = await app.inject({ method: "GET", url: "/reports/low-stock", headers: authHeader(ownerToken) });
    const body = res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].productId).toBe(productLowStock);
    expect(body.items[0].deficit).toBe("30.0000");
    // productOkStock (40 >= 10) y productNoThreshold (sin minStock) no aparecen
    expect(body.items.some((i: { productId: string }) => i.productId === productOkStock)).toBe(false);
    expect(body.items.some((i: { productId: string }) => i.productId === productNoThreshold)).toBe(false);
  });
});

describe("Aislamiento por empresa", () => {
  it("no expone datos de otra empresa en los reportes", async () => {
    const { Company } = await import("../src/db/models/company.model.js");
    const { Branch } = await import("../src/db/models/branch.model.js");
    const { Role } = await import("../src/db/models/role.model.js");
    const { User } = await import("../src/db/models/user.model.js");
    const { hashPassword } = await import("../src/modules/auth/password.js");

    const otherCompany = await Company.create({ name: "Other Reports Co", slug: "other-reports-co" });
    await Branch.create({ companyId: otherCompany._id, name: "Central", code: "CENTRAL" });
    const role = await Role.create({ companyId: null, name: "Owner", isSystem: true, permissions: [] });
    const passwordHash = await hashPassword(PASSWORD);
    await User.create({
      companyId: otherCompany._id,
      email: "owner@other-reports-co.local",
      passwordHash,
      name: "Other Owner",
      roleId: role._id,
      branchRestrictions: [],
    });
    const otherToken = await login("owner@other-reports-co.local");

    const res = await app.inject({
      method: "GET",
      url: "/reports/inventory-valuation",
      headers: authHeader(otherToken),
    });
    expect(res.json().items).toEqual([]);
    expect(res.json().grandTotal).toBe("0.0000");
  });
});
