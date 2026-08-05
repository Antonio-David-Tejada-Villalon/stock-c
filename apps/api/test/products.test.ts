import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import RedisMock from "ioredis-mock";
import type { FastifyInstance } from "fastify";

let mongod: MongoMemoryServer;
let app: FastifyInstance;
let ownerToken: string;
let viewerToken: string;

const OWNER_EMAIL = "owner@products-test.local";
const VIEWER_EMAIL = "viewer@products-test.local";
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
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("stockc-products-test");
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.NODE_ENV = "test";

  const { buildApp } = await import("../src/app.js");
  const { Company } = await import("../src/db/models/company.model.js");
  const { Role } = await import("../src/db/models/role.model.js");
  const { User } = await import("../src/db/models/user.model.js");
  const { hashPassword } = await import("../src/modules/auth/password.js");

  app = await buildApp({ redisClient: new RedisMock(), rateLimitRedis: false });

  const company = await Company.create({ name: "Products Test Co", slug: "products-test-co" });
  const passwordHash = await hashPassword(PASSWORD);

  const ownerRole = await Role.create({
    companyId: null,
    name: "Owner",
    isSystem: true,
    permissions: ["product:create", "product:update", "product:delete"],
  });
  const viewerRole = await Role.create({
    companyId: null,
    name: "Visor",
    isSystem: true,
    permissions: [],
  });

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

  ownerToken = await login(OWNER_EMAIL);
  viewerToken = await login(VIEWER_EMAIL);
});

afterAll(async () => {
  await app.close();
  await mongod.stop();
});

function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}

describe("POST /products", () => {
  it("requires the product:create permission", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/products",
      headers: authHeader(viewerToken),
      payload: { sku: "SKU-001", name: "Tornillo 1/4", price: "10.50" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("creates a product with price/cost as strings, never as float", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/products",
      headers: authHeader(ownerToken),
      payload: { sku: "SKU-002", name: "Caja de tornillos", price: "1250.99", cost: "800.00" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.price).toBe("1250.99");
    expect(body.cost).toBe("800.00");
    expect(body.active).toBe(true);
    expect(body.version).toBe(0);
  });

  it("rejects a duplicate SKU within the same company", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/products",
      headers: authHeader(ownerToken),
      payload: { sku: "SKU-002", name: "Otro producto", price: "1.00" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("duplicate_sku");
  });
});

describe("Vínculo con categoría, marca y unidad (Fase 8)", () => {
  it("creates a product linked to a category/brand/unit and can clear the link later", async () => {
    const { Category } = await import("../src/db/models/category.model.js");
    const { Brand } = await import("../src/db/models/brand.model.js");
    const { Unit } = await import("../src/db/models/unit.model.js");
    const { Company } = await import("../src/db/models/company.model.js");

    const company = await Company.findOne({ slug: "products-test-co" });
    const category = await Category.create({ companyId: company!._id, name: "Herramientas" });
    const brand = await Brand.create({ companyId: company!._id, name: "Marca Test" });
    const unit = await Unit.create({ companyId: company!._id, name: "Unidad Test" });

    const created = await app.inject({
      method: "POST",
      url: "/products",
      headers: authHeader(ownerToken),
      payload: {
        sku: "SKU-LINK-001",
        name: "Producto vinculado",
        price: "100.00",
        categoryId: category._id.toString(),
        brandId: brand._id.toString(),
        unitId: unit._id.toString(),
      },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json();
    expect(body.categoryId).toBe(category._id.toString());
    expect(body.brandId).toBe(brand._id.toString());
    expect(body.unitId).toBe(unit._id.toString());

    const cleared = await app.inject({
      method: "PATCH",
      url: `/products/${body.id}`,
      headers: authHeader(ownerToken),
      payload: { version: body.version, categoryId: null },
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().categoryId).toBeUndefined();
    expect(cleared.json().brandId).toBe(brand._id.toString());
  });
});

describe("GET /products/:id y PATCH", () => {
  it("gets a product by id and updates it with optimistic concurrency", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/products",
      headers: authHeader(ownerToken),
      payload: { sku: "SKU-003", name: "Pintura látex", price: "5000.00" },
    });
    const { id, version } = created.json();

    const got = await app.inject({
      method: "GET",
      url: `/products/${id}`,
      headers: authHeader(ownerToken),
    });
    expect(got.statusCode).toBe(200);
    expect(got.json().name).toBe("Pintura látex");

    const updated = await app.inject({
      method: "PATCH",
      url: `/products/${id}`,
      headers: authHeader(ownerToken),
      payload: { version, name: "Pintura látex blanca" },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().name).toBe("Pintura látex blanca");
    expect(updated.json().version).toBe(version + 1);

    // Reusar la versión vieja debe rechazarse (alguien más ya lo cambió).
    const staleUpdate = await app.inject({
      method: "PATCH",
      url: `/products/${id}`,
      headers: authHeader(ownerToken),
      payload: { version, name: "Otro nombre" },
    });
    expect(staleUpdate.statusCode).toBe(409);
    expect(staleUpdate.json().error).toBe("version_conflict");
  });

  it("requires the product:update permission", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/products",
      headers: authHeader(ownerToken),
      payload: { sku: "SKU-004", name: "Guantes", price: "300.00" },
    });
    const { id, version } = created.json();

    const res = await app.inject({
      method: "PATCH",
      url: `/products/${id}`,
      headers: authHeader(viewerToken),
      payload: { version, name: "Guantes de nitrilo" },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("DELETE /products/:id (soft delete)", () => {
  it("deactivates instead of deleting, and requires product:delete", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/products",
      headers: authHeader(ownerToken),
      payload: { sku: "SKU-005", name: "Cable eléctrico", price: "999.00" },
    });
    const { id } = created.json();

    const forbidden = await app.inject({
      method: "DELETE",
      url: `/products/${id}`,
      headers: authHeader(viewerToken),
    });
    expect(forbidden.statusCode).toBe(403);

    const res = await app.inject({
      method: "DELETE",
      url: `/products/${id}`,
      headers: authHeader(ownerToken),
    });
    expect(res.statusCode).toBe(204);

    const got = await app.inject({
      method: "GET",
      url: `/products/${id}`,
      headers: authHeader(ownerToken),
    });
    expect(got.statusCode).toBe(200);
    expect(got.json().active).toBe(false);
  });
});

describe("GET /products (listado paginado por cursor)", () => {
  it("pages through results ordered by name without repeats or gaps", async () => {
    for (const name of ["Zapallo", "Alambre", "Martillo", "Bisagra", "Candado"]) {
      await app.inject({
        method: "POST",
        url: "/products",
        headers: authHeader(ownerToken),
        payload: { sku: `PAGE-${name}`, name, price: "1.00" },
      });
    }

    const seenNames: string[] = [];
    let cursor: string | undefined;
    do {
      const res = await app.inject({
        method: "GET",
        url: `/products?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}&q=`,
        headers: authHeader(ownerToken),
      });
      // q="" se trata como "sin búsqueda" por el schema (string vacío);
      // si el servidor lo tratara como búsqueda, esta prueba lo detectaría.
      const body = res.json();
      for (const item of body.items) {
        if (["Zapallo", "Alambre", "Martillo", "Bisagra", "Candado"].includes(item.name)) {
          seenNames.push(item.name);
        }
      }
      cursor = body.nextCursor ?? undefined;
    } while (cursor);

    expect(seenNames).toEqual(["Alambre", "Bisagra", "Candado", "Martillo", "Zapallo"]);
    expect(new Set(seenNames).size).toBe(seenNames.length);
  });

  it("keeps products isolated per company (tenant scoping)", async () => {
    const { Company } = await import("../src/db/models/company.model.js");
    const { Role } = await import("../src/db/models/role.model.js");
    const { User } = await import("../src/db/models/user.model.js");
    const { hashPassword } = await import("../src/modules/auth/password.js");

    const otherCompany = await Company.create({ name: "Other Co", slug: "other-co" });
    const role = await Role.create({
      companyId: null,
      name: "Owner",
      isSystem: true,
      permissions: ["product:create"],
    });
    const passwordHash = await hashPassword(PASSWORD);
    await User.create({
      companyId: otherCompany._id,
      email: "owner@other-co.local",
      passwordHash,
      name: "Other Owner",
      roleId: role._id,
      branchRestrictions: [],
    });
    const otherToken = await login("owner@other-co.local");

    const res = await app.inject({
      method: "GET",
      url: "/products",
      headers: authHeader(otherToken),
    });
    expect(res.json().items).toEqual([]);
  });
});

describe("GET /products (modo delta ?updatedSince, Fase 10)", () => {
  it("includes recently deactivated products and excludes changes before the cutoff", async () => {
    const since = new Date().toISOString();

    const created = await app.inject({
      method: "POST",
      url: "/products",
      headers: authHeader(ownerToken),
      payload: { sku: "DELTA-001", name: "Delta Producto", price: "1.00" },
    });
    const { id } = created.json();

    await app.inject({
      method: "DELETE",
      url: `/products/${id}`,
      headers: authHeader(ownerToken),
    });

    const res = await app.inject({
      method: "GET",
      url: `/products?updatedSince=${encodeURIComponent(since)}`,
      headers: authHeader(ownerToken),
    });
    expect(res.statusCode).toBe(200);
    const match = res.json().items.find((p: { id: string }) => p.id === id);
    expect(match).toBeDefined();
    expect(match.active).toBe(false);

    const nothingYet = await app.inject({
      method: "GET",
      url: `/products?updatedSince=${encodeURIComponent(new Date().toISOString())}`,
      headers: authHeader(ownerToken),
    });
    expect(nothingYet.json().items).toEqual([]);
  });

  it("pages through delta results ordered by updatedAt without gaps or repeats", async () => {
    const since = new Date().toISOString();
    const skus = ["DELTA-A", "DELTA-B", "DELTA-C"];
    for (const sku of skus) {
      await app.inject({
        method: "POST",
        url: "/products",
        headers: authHeader(ownerToken),
        payload: { sku, name: `Producto ${sku}`, price: "1.00" },
      });
    }

    const seenSkus: string[] = [];
    let cursor: string | undefined;
    do {
      const res = await app.inject({
        method: "GET",
        url: `/products?updatedSince=${encodeURIComponent(since)}&limit=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        headers: authHeader(ownerToken),
      });
      const body = res.json();
      for (const item of body.items) seenSkus.push(item.sku);
      cursor = body.nextCursor ?? undefined;
    } while (cursor);

    for (const sku of skus) expect(seenSkus).toContain(sku);
    expect(new Set(seenSkus).size).toBe(seenSkus.length);
  });
});
