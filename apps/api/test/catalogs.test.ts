import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import RedisMock from "ioredis-mock";
import type { FastifyInstance } from "fastify";

let mongod: MongoMemoryServer;
let app: FastifyInstance;
let ownerToken: string;
let viewerToken: string;

const OWNER_EMAIL = "owner@catalogs-test.local";
const VIEWER_EMAIL = "viewer@catalogs-test.local";
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
  process.env.MONGODB_URI = mongod.getUri("stockc-catalogs-test");
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.NODE_ENV = "test";

  const { buildApp } = await import("../src/app.js");
  const { Company } = await import("../src/db/models/company.model.js");
  const { Role } = await import("../src/db/models/role.model.js");
  const { User } = await import("../src/db/models/user.model.js");
  const { hashPassword } = await import("../src/modules/auth/password.js");

  app = await buildApp({ redisClient: new RedisMock(), rateLimitRedis: false });

  const company = await Company.create({ name: "Catalogs Test Co", slug: "catalogs-test-co" });
  const passwordHash = await hashPassword(PASSWORD);

  const ownerRole = await Role.create({
    companyId: null,
    name: "Owner",
    isSystem: true,
    permissions: [
      "category:create",
      "category:update",
      "category:delete",
      "brand:create",
      "brand:update",
      "brand:delete",
      "unit:create",
      "unit:update",
      "unit:delete",
    ],
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

describe("Categorías", () => {
  it("requires category:create permission", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/categories",
      headers: authHeader(viewerToken),
      payload: { name: "Ferretería" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("creates a root category and a subcategory under it", async () => {
    const root = await app.inject({
      method: "POST",
      url: "/categories",
      headers: authHeader(ownerToken),
      payload: { name: "Ferretería" },
    });
    expect(root.statusCode).toBe(201);
    const rootBody = root.json();
    expect(rootBody.parentId).toBeUndefined();

    const child = await app.inject({
      method: "POST",
      url: "/categories",
      headers: authHeader(ownerToken),
      payload: { name: "Tornillos", parentId: rootBody.id },
    });
    expect(child.statusCode).toBe(201);
    expect(child.json().parentId).toBe(rootBody.id);
  });

  it("rejects a nonexistent parent with invalid_parent", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/categories",
      headers: authHeader(ownerToken),
      payload: { name: "Huérfana", parentId: "000000000000000000000000" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_parent");
  });

  it("detects a cycle when a category is set as its own descendant's parent", async () => {
    const a = await app.inject({
      method: "POST",
      url: "/categories",
      headers: authHeader(ownerToken),
      payload: { name: "Categoría A" },
    });
    const aId = a.json().id;

    const b = await app.inject({
      method: "POST",
      url: "/categories",
      headers: authHeader(ownerToken),
      payload: { name: "Categoría B", parentId: aId },
    });
    const b_ = b.json();

    // Intentar que A (ancestro de B) pase a tener a B como padre → ciclo.
    const res = await app.inject({
      method: "PATCH",
      url: `/categories/${aId}`,
      headers: authHeader(ownerToken),
      payload: { version: a.json().version, parentId: b_.id },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("cycle");
  });

  it("updates with optimistic concurrency and deactivates without deleting", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/categories",
      headers: authHeader(ownerToken),
      payload: { name: "Jardín" },
    });
    const { id, version } = created.json();

    const updated = await app.inject({
      method: "PATCH",
      url: `/categories/${id}`,
      headers: authHeader(ownerToken),
      payload: { version, name: "Jardín y exteriores" },
    });
    expect(updated.statusCode).toBe(200);

    const stale = await app.inject({
      method: "PATCH",
      url: `/categories/${id}`,
      headers: authHeader(ownerToken),
      payload: { version, name: "Otro nombre" },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error).toBe("version_conflict");

    const deleted = await app.inject({
      method: "DELETE",
      url: `/categories/${id}`,
      headers: authHeader(ownerToken),
    });
    expect(deleted.statusCode).toBe(204);

    const got = await app.inject({
      method: "GET",
      url: `/categories/${id}`,
      headers: authHeader(ownerToken),
    });
    expect(got.json().active).toBe(false);
  });
});

describe("Marcas", () => {
  it("requires brand:create permission", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/brands",
      headers: authHeader(viewerToken),
      payload: { name: "Stanley" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("creates a brand and rejects a duplicate name within the same company", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/brands",
      headers: authHeader(ownerToken),
      payload: { name: "Stanley" },
    });
    expect(created.statusCode).toBe(201);

    const duplicate = await app.inject({
      method: "POST",
      url: "/brands",
      headers: authHeader(ownerToken),
      payload: { name: "Stanley" },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error).toBe("duplicate_name");
  });

  it("deactivates a brand without deleting it", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/brands",
      headers: authHeader(ownerToken),
      payload: { name: "Truper" },
    });
    const { id } = created.json();

    const res = await app.inject({
      method: "DELETE",
      url: `/brands/${id}`,
      headers: authHeader(ownerToken),
    });
    expect(res.statusCode).toBe(204);

    const got = await app.inject({ method: "GET", url: `/brands/${id}`, headers: authHeader(ownerToken) });
    expect(got.json().active).toBe(false);
  });
});

describe("Unidades", () => {
  it("creates a unit with an abbreviation", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/units",
      headers: authHeader(ownerToken),
      payload: { name: "Kilogramo", abbreviation: "kg" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().abbreviation).toBe("kg");
  });

  it("requires unit:delete permission to deactivate", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/units",
      headers: authHeader(ownerToken),
      payload: { name: "Metro" },
    });
    const { id } = created.json();

    const res = await app.inject({
      method: "DELETE",
      url: `/units/${id}`,
      headers: authHeader(viewerToken),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("Aislamiento por empresa", () => {
  it("keeps categories, brands and units isolated per company", async () => {
    const { Company } = await import("../src/db/models/company.model.js");
    const { Role } = await import("../src/db/models/role.model.js");
    const { User } = await import("../src/db/models/user.model.js");
    const { hashPassword } = await import("../src/modules/auth/password.js");

    const otherCompany = await Company.create({ name: "Other Catalogs Co", slug: "other-catalogs-co" });
    const role = await Role.create({ companyId: null, name: "Owner", isSystem: true, permissions: [] });
    const passwordHash = await hashPassword(PASSWORD);
    await User.create({
      companyId: otherCompany._id,
      email: "owner@other-catalogs-co.local",
      passwordHash,
      name: "Other Owner",
      roleId: role._id,
      branchRestrictions: [],
    });
    const otherToken = await login("owner@other-catalogs-co.local");

    const categories = await app.inject({ method: "GET", url: "/categories", headers: authHeader(otherToken) });
    const brands = await app.inject({ method: "GET", url: "/brands", headers: authHeader(otherToken) });
    const units = await app.inject({ method: "GET", url: "/units", headers: authHeader(otherToken) });

    expect(categories.json().items).toEqual([]);
    expect(brands.json().items).toEqual([]);
    expect(units.json().items).toEqual([]);
  });
});
