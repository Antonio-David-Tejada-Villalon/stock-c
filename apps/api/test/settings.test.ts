import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import RedisMock from "ioredis-mock";
import type { FastifyInstance } from "fastify";

// Configuración general (Fase 13) no usa transacciones de Mongo en
// ningún flujo nuevo — alcanza con un MongoMemoryServer standalone,
// igual que catalogs.test.ts/reports.test.ts.
let mongod: MongoMemoryServer;
let app: FastifyInstance;
let adminToken: string;
let viewerToken: string;
let companyId: string;

const ADMIN_EMAIL = "admin@settings-test.local";
const VIEWER_EMAIL = "viewer@settings-test.local";
const PASSWORD = "clave-super-segura-123";

async function login(email: string, password = PASSWORD) {
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  return res.json().accessToken as string;
}

function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("stockc-settings-test");
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.NODE_ENV = "test";

  const { buildApp } = await import("../src/app.js");
  const { Company } = await import("../src/db/models/company.model.js");
  const { Role, SYSTEM_ROLES } = await import("../src/db/models/role.model.js");
  const { User } = await import("../src/db/models/user.model.js");
  const { PERMISSIONS } = await import("@stock-c/shared-types");
  const { hashPassword } = await import("../src/modules/auth/password.js");

  app = await buildApp({ redisClient: new RedisMock(), rateLimitRedis: false });

  const company = await Company.create({ name: "Settings Test Co", slug: "settings-test-co" });
  companyId = company._id.toString();
  const passwordHash = await hashPassword(PASSWORD);

  // Roles con los nombres reales de SYSTEM_ROLES — user.service.ts busca
  // por nombre exacto al asignar un rol. Admin es el único rol de control
  // total (Owner se fusionó con Admin, ver adenda post-verificación de
  // Fase 13).
  await Role.create({
    companyId: null,
    name: SYSTEM_ROLES.ADMIN,
    isSystem: true,
    permissions: Object.values(PERMISSIONS),
  });
  await Role.create({ companyId: null, name: SYSTEM_ROLES.WAREHOUSE_OPERATOR, isSystem: true, permissions: [] });
  const viewerRole = await Role.create({ companyId: null, name: SYSTEM_ROLES.VIEWER, isSystem: true, permissions: [] });

  const adminRole = await Role.findOne({ name: SYSTEM_ROLES.ADMIN, isSystem: true });

  await User.create({
    companyId: company._id,
    email: ADMIN_EMAIL,
    passwordHash,
    name: "Admin Test",
    roleId: adminRole!._id,
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

  adminToken = await login(ADMIN_EMAIL);
  viewerToken = await login(VIEWER_EMAIL);
}, 60000);

afterAll(async () => {
  await app.close();
  await mongod.stop();
});

describe("GET/PATCH /company", () => {
  it("cualquier autenticado puede leer, pero PATCH exige company:update", async () => {
    const get = await app.inject({ method: "GET", url: "/company", headers: authHeader(viewerToken) });
    expect(get.statusCode).toBe(200);
    expect(get.json().name).toBe("Settings Test Co");

    const patch = await app.inject({
      method: "PATCH",
      url: "/company",
      headers: authHeader(viewerToken),
      payload: { version: 0, name: "Nope" },
    });
    expect(patch.statusCode).toBe(403);
  });

  it("actualiza nombre y settings con el permiso correcto", async () => {
    const get = await app.inject({ method: "GET", url: "/company", headers: authHeader(adminToken) });
    const version = get.json().version;

    const patch = await app.inject({
      method: "PATCH",
      url: "/company",
      headers: authHeader(adminToken),
      payload: { version, name: "Settings Test Co Renombrada", settings: { currency: "USD" } },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().name).toBe("Settings Test Co Renombrada");
    expect(patch.json().settings.currency).toBe("USD");
  });

  it("rechaza un accentColor sin contraste suficiente", async () => {
    const get = await app.inject({ method: "GET", url: "/company", headers: authHeader(adminToken) });
    const version = get.json().version;

    const patch = await app.inject({
      method: "PATCH",
      url: "/company",
      headers: authHeader(adminToken),
      payload: { version, settings: { accentColor: "#777777" } }, // gris medio: el mejor contraste posible (blanco o negro) queda justo debajo de 4.5:1
    });
    expect(patch.statusCode).toBe(400);
    expect(patch.json().error).toBe("invalid_contrast");
  });

  it("acepta un accentColor con contraste suficiente", async () => {
    const get = await app.inject({ method: "GET", url: "/company", headers: authHeader(adminToken) });
    const version = get.json().version;

    const patch = await app.inject({
      method: "PATCH",
      url: "/company",
      headers: authHeader(adminToken),
      payload: { version, settings: { accentColor: "#2663EB" } },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().settings.accentColor).toBe("#2663EB");
  });
});

describe("Sucursales", () => {
  let branchId: string;

  it("crea una sucursal inactiva por default", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/branches",
      headers: authHeader(adminToken),
      payload: { name: "Norte", code: "NORTE" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().active).toBe(false);
    branchId = res.json().id;
  });

  it("rechaza un código de sucursal duplicado", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/branches",
      headers: authHeader(adminToken),
      payload: { name: "Norte 2", code: "NORTE" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("duplicate_code");
  });

  it("activar una sucursal desactiva las demás", async () => {
    const second = await app.inject({
      method: "POST",
      url: "/branches",
      headers: authHeader(adminToken),
      payload: { name: "Sur", code: "SUR" },
    });
    const secondId = second.json().id;

    const activateFirst = await app.inject({
      method: "POST",
      url: `/branches/${branchId}/activate`,
      headers: authHeader(adminToken),
    });
    expect(activateFirst.statusCode).toBe(204);

    const activateSecond = await app.inject({
      method: "POST",
      url: `/branches/${secondId}/activate`,
      headers: authHeader(adminToken),
    });
    expect(activateSecond.statusCode).toBe(204);

    const list = await app.inject({ method: "GET", url: "/branches", headers: authHeader(adminToken) });
    const items = list.json().items as { id: string; active: boolean }[];
    expect(items.find((b) => b.id === secondId)!.active).toBe(true);
    expect(items.find((b) => b.id === branchId)!.active).toBe(false);
  });

  it("no se puede eliminar la sucursal activa", async () => {
    const list = await app.inject({ method: "GET", url: "/branches", headers: authHeader(adminToken) });
    const active = (list.json().items as { id: string; active: boolean }[]).find((b) => b.active)!;

    const del = await app.inject({
      method: "DELETE",
      url: `/branches/${active.id}`,
      headers: authHeader(adminToken),
    });
    expect(del.statusCode).toBe(400);
    expect(del.json().error).toBe("cannot_delete_active");
  });

  it("elimina definitivamente una sucursal inactiva", async () => {
    const del = await app.inject({
      method: "DELETE",
      url: `/branches/${branchId}`,
      headers: authHeader(adminToken),
    });
    expect(del.statusCode).toBe(204);

    const list = await app.inject({ method: "GET", url: "/branches", headers: authHeader(adminToken) });
    const items = list.json().items as { id: string }[];
    expect(items.find((b) => b.id === branchId)).toBeUndefined();
  });

  it("exige branch:manage para crear", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/branches",
      headers: authHeader(viewerToken),
      payload: { name: "X", code: "X1" },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("Usuarios (gestión de equipo)", () => {
  let createdUserId: string;
  let createdUserVersion: number;

  it("crea un usuario nuevo con contraseña inicial fijada por el admin", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/users",
      headers: authHeader(adminToken),
      payload: { name: "Operador Uno", email: "operador1@settings-test.local", password: "clave-inicial-123", roleName: "Operador de almacén" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().roleName).toBe("Operador de almacén");
    createdUserId = res.json().id;
    createdUserVersion = res.json().version;

    const loginAsNew = await login("operador1@settings-test.local", "clave-inicial-123");
    expect(typeof loginAsNew).toBe("string");
  });

  it("rechaza un email duplicado", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/users",
      headers: authHeader(adminToken),
      payload: { name: "Otro", email: "operador1@settings-test.local", password: "clave-inicial-123", roleName: "Visor" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("duplicate_email");
  });

  it("restablece la contraseña de un usuario del equipo", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/users/${createdUserId}`,
      headers: authHeader(adminToken),
      payload: { version: createdUserVersion, password: "clave-restablecida-456" },
    });
    expect(res.statusCode).toBe(200);
    createdUserVersion = res.json().version;

    const loginWithNew = await login("operador1@settings-test.local", "clave-restablecida-456");
    expect(typeof loginWithNew).toBe("string");
  });

  it("actualiza el email de un usuario del equipo", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/users/${createdUserId}`,
      headers: authHeader(adminToken),
      payload: { version: createdUserVersion, email: "operador1-nuevo@settings-test.local" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe("operador1-nuevo@settings-test.local");
    createdUserVersion = res.json().version;
  });

  it("un usuario no puede desactivarse a sí mismo", async () => {
    const me = await app.inject({ method: "GET", url: "/auth/me", headers: authHeader(adminToken) });
    const adminId = me.json().user.id;

    const res = await app.inject({
      method: "PATCH",
      url: `/users/${adminId}`,
      headers: authHeader(adminToken),
      payload: { version: 0, active: false },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("cannot_deactivate_self");
  });

  it("no se puede cambiar de rol al único Admin activo (dejaría a la empresa sin administrador)", async () => {
    const list = await app.inject({ method: "GET", url: "/users", headers: authHeader(adminToken) });
    const items = list.json().items as { id: string; roleName: string; version: number }[];
    const adminUser = items.find((u) => u.roleName === "Admin")!;

    const demote = await app.inject({
      method: "PATCH",
      url: `/users/${adminUser.id}`,
      headers: authHeader(adminToken),
      payload: { version: adminUser.version, roleName: "Visor" },
    });
    expect(demote.statusCode).toBe(400);
    expect(demote.json().error).toBe("last_admin");
  });

  it("permite cambiar de rol a un usuario que no es el único Admin", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/users/${createdUserId}`,
      headers: authHeader(adminToken),
      payload: { version: createdUserVersion, roleName: "Visor" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().roleName).toBe("Visor");
  });

  it("un usuario no puede eliminarse a sí mismo", async () => {
    const me = await app.inject({ method: "GET", url: "/auth/me", headers: authHeader(adminToken) });
    const adminId = me.json().user.id;

    const res = await app.inject({ method: "DELETE", url: `/users/${adminId}`, headers: authHeader(adminToken) });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("cannot_delete_self");
  });

  it("elimina definitivamente un usuario del equipo", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/users",
      headers: authHeader(adminToken),
      payload: {
        name: "Para Borrar",
        email: "para-borrar@settings-test.local",
        password: "clave-inicial-123",
        roleName: "Visor",
      },
    });
    const toDeleteId = create.json().id;

    const del = await app.inject({ method: "DELETE", url: `/users/${toDeleteId}`, headers: authHeader(adminToken) });
    expect(del.statusCode).toBe(204);

    const list = await app.inject({ method: "GET", url: "/users", headers: authHeader(adminToken) });
    const items = list.json().items as { id: string }[];
    expect(items.find((u) => u.id === toDeleteId)).toBeUndefined();
  });

  it("exige user:manage para listar", async () => {
    const res = await app.inject({ method: "GET", url: "/users", headers: authHeader(viewerToken) });
    expect(res.statusCode).toBe(403);
  });
});

describe("Perfil propio", () => {
  it("PATCH /auth/me actualiza nombre y avatarUrl sin permiso especial", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/auth/me",
      headers: authHeader(viewerToken),
      payload: { name: "Viewer Renombrado", avatarUrl: "https://example.com/a.png" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.name).toBe("Viewer Renombrado");
    expect(res.json().user.avatarUrl).toBe("https://example.com/a.png");
  });

  it("change-password rechaza una contraseña actual incorrecta", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/change-password",
      headers: authHeader(viewerToken),
      payload: { currentPassword: "no-es-esta", newPassword: "clave-nueva-1234" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("wrong_current_password");
  });

  it("change-password funciona con la contraseña actual correcta", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/change-password",
      headers: authHeader(viewerToken),
      payload: { currentPassword: PASSWORD, newPassword: "clave-nueva-1234" },
    });
    expect(res.statusCode).toBe(204);

    const loginWithNew = await login(VIEWER_EMAIL, "clave-nueva-1234");
    expect(typeof loginWithNew).toBe("string");
  });
});

describe("Aislamiento por empresa", () => {
  it("no expone la empresa/sucursales/usuarios de otro tenant", async () => {
    const { Company } = await import("../src/db/models/company.model.js");
    const { Branch } = await import("../src/db/models/branch.model.js");
    const { Role } = await import("../src/db/models/role.model.js");
    const { User } = await import("../src/db/models/user.model.js");
    const { hashPassword } = await import("../src/modules/auth/password.js");

    const otherCompany = await Company.create({ name: "Other Settings Co", slug: "other-settings-co" });
    await Branch.create({ companyId: otherCompany._id, name: "Central", code: "CENTRAL", active: true });
    const role = await Role.create({ companyId: null, name: "Admin", isSystem: true, permissions: ["branch:manage", "user:manage"] });
    const passwordHash = await hashPassword(PASSWORD);
    await User.create({
      companyId: otherCompany._id,
      email: "admin@other-settings-co.local",
      passwordHash,
      name: "Other Admin",
      roleId: role._id,
      branchRestrictions: [],
    });
    const otherToken = await login("admin@other-settings-co.local");

    const company = await app.inject({ method: "GET", url: "/company", headers: authHeader(otherToken) });
    expect(company.json().id).not.toBe(companyId);

    const branches = await app.inject({ method: "GET", url: "/branches", headers: authHeader(otherToken) });
    expect(branches.json().items).toHaveLength(1);

    const users = await app.inject({ method: "GET", url: "/users", headers: authHeader(otherToken) });
    expect(users.json().items).toHaveLength(1);
  });
});
