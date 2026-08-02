import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import RedisMock from "ioredis-mock";
import type { FastifyInstance } from "fastify";
import type { Types } from "mongoose";

/**
 * Integración sin Docker: Mongo corre en memoria (mongodb-memory-server) y
 * Redis se reemplaza por un mock en memoria (ioredis-mock) — no hay
 * infraestructura real en esta máquina de desarrollo todavía (ver
 * docs/05-autenticacion.md, sección "Verificación"). Cubre el camino
 * completo: login, /me, rotación de refresh, detección de reuso, logout,
 * rate limiting y el plugin de aislamiento por tenant.
 *
 * Cada test usa un usuario con email propio (misma empresa/rol) para que
 * el rate limit de /auth/login, que es por email+IP, no contamine tests
 * que no lo están probando a propósito.
 */

let mongod: MongoMemoryServer;
let app: FastifyInstance;
let companyId: Types.ObjectId;
let roleId: Types.ObjectId;

const PASSWORD = "clave-super-segura-123";
let userCounter = 0;

async function createTestUser() {
  const { User } = await import("../src/db/models/user.model.js");
  const { hashPassword } = await import("../src/modules/auth/password.js");

  userCounter += 1;
  const email = `user${userCounter}@test.local`;
  const passwordHash = await hashPassword(PASSWORD);
  const user = await User.create({
    companyId,
    email,
    passwordHash,
    name: `Test User ${userCounter}`,
    roleId,
    branchRestrictions: [],
  });
  return { email, id: user._id.toString() };
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("stockc-test");
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.NODE_ENV = "test";

  const { buildApp } = await import("../src/app.js");
  const { Company } = await import("../src/db/models/company.model.js");
  const { Role } = await import("../src/db/models/role.model.js");

  app = await buildApp({ redisClient: new RedisMock() });

  const company = await Company.create({ name: "Test Co", slug: "test-co" });
  const role = await Role.create({
    companyId: null,
    name: "Owner",
    isSystem: true,
    permissions: ["product:create"],
  });
  companyId = company._id;
  roleId = role._id;
});

afterAll(async () => {
  await app.close();
  await mongod.stop();
});

function extractCookie(res: { cookies: Array<{ name: string; value: string }> }, name: string) {
  return res.cookies.find((c) => c.name === name)?.value;
}

async function loginAs(email: string, password = PASSWORD) {
  return app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
}

describe("POST /auth/login", () => {
  it("rejects unknown email with a generic message", async () => {
    const res = await loginAs("nadie@test.local", "lo-que-sea");
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "invalid_credentials" });
  });

  it("rejects a wrong password with the same generic message", async () => {
    const { email } = await createTestUser();
    const res = await loginAs(email, "incorrecta");
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "invalid_credentials" });
  });

  it("logs in with valid credentials, returns an access token and sets the refresh cookie", async () => {
    const { email } = await createTestUser();
    const res = await loginAs(email);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.user.email).toBe(email);
    expect(body.user).not.toHaveProperty("passwordHash");
    expect(extractCookie(res, "refresh_token")).toBeTruthy();
  });

  it("blocks further attempts after 5 tries on the same email within the window", async () => {
    const { email } = await createTestUser();
    const attempts = await Promise.all(
      Array.from({ length: 5 }, () => loginAs(email, "incorrecta")),
    );
    for (const res of attempts) {
      expect(res.statusCode).toBe(401);
    }
    const sixth = await loginAs(email, "incorrecta");
    expect(sixth.statusCode).toBe(429);

    // El bloqueo es por email+IP: otro usuario no se ve afectado.
    const { email: otherEmail } = await createTestUser();
    const unrelated = await loginAs(otherEmail);
    expect(unrelated.statusCode).toBe(200);
  });
});

describe("GET /auth/me", () => {
  it("requires a bearer token", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("returns the current user with a valid access token", async () => {
    const { email, id } = await createTestUser();
    const login = await loginAs(email);
    expect(login.statusCode).toBe(200);
    const { accessToken } = login.json();

    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.id).toBe(id);
  });
});

describe("POST /auth/refresh y /auth/logout", () => {
  it("rejects refresh without the CSRF header", async () => {
    const res = await app.inject({ method: "POST", url: "/auth/refresh" });
    expect(res.statusCode).toBe(403);
  });

  it("rotates the refresh token on use and invalidates the previous one", async () => {
    const { email } = await createTestUser();
    const login = await loginAs(email);
    expect(login.statusCode).toBe(200);
    const firstRefreshToken = extractCookie(login, "refresh_token")!;

    const refreshed = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { "x-requested-with": "stock-c", cookie: `refresh_token=${firstRefreshToken}` },
    });
    expect(refreshed.statusCode).toBe(200);
    const secondRefreshToken = extractCookie(refreshed, "refresh_token")!;
    expect(secondRefreshToken).not.toBe(firstRefreshToken);

    // Reusar el token ya rotado se interpreta como robo: se rechaza y
    // además revoca todas las sesiones del usuario (incluida la nueva).
    const reused = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { "x-requested-with": "stock-c", cookie: `refresh_token=${firstRefreshToken}` },
    });
    expect(reused.statusCode).toBe(401);

    const secondAfterReuse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { "x-requested-with": "stock-c", cookie: `refresh_token=${secondRefreshToken}` },
    });
    expect(secondAfterReuse.statusCode).toBe(401);
  });

  it("logs out and clears the session", async () => {
    const { email } = await createTestUser();
    const login = await loginAs(email);
    expect(login.statusCode).toBe(200);
    const refreshToken = extractCookie(login, "refresh_token")!;

    const logout = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: { "x-requested-with": "stock-c", cookie: `refresh_token=${refreshToken}` },
    });
    expect(logout.statusCode).toBe(204);

    const afterLogout = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { "x-requested-with": "stock-c", cookie: `refresh_token=${refreshToken}` },
    });
    expect(afterLogout.statusCode).toBe(401);
  });
});

describe("Aislamiento por tenant (Fase 1, Decisión 3)", () => {
  it("rechaza queries sobre User sin companyId", async () => {
    const { User } = await import("../src/db/models/user.model.js");
    await expect(User.find({})).rejects.toThrow(/companyId/);
  });

  it("permite el escape hatch explícito para el lookup de login por email", async () => {
    const { email } = await createTestUser();
    const { User } = await import("../src/db/models/user.model.js");
    const user = await User.findOne({ email }).setOptions({ allowCrossTenant: true });
    expect(user).not.toBeNull();
  });
});
