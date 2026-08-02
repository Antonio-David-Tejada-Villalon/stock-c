/**
 * Seed de desarrollo: crea una empresa, una sucursal, los roles de sistema
 * y un usuario Owner para poder loguearse. Fase 5 no incluye una pantalla
 * de registro público — ver docs/05-autenticacion.md, sección 1.
 *
 * Uso: pnpm --filter @stock-c/api seed
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../shared/env.js";
import { Company } from "./models/company.model.js";
import { Branch } from "./models/branch.model.js";
import { Role, SYSTEM_ROLES, PERMISSIONS } from "./models/role.model.js";
import { User } from "./models/user.model.js";
import { hashPassword } from "../modules/auth/password.js";

const DEV_COMPANY_SLUG = "ferreteria-demo";
const DEV_OWNER_EMAIL = "owner@ferreteria-demo.test";
const DEV_OWNER_PASSWORD = "cambiar-esta-clave-123";

async function ensureSystemRoles() {
  const allPermissions = Object.values(PERMISSIONS);

  const specs = [
    { name: SYSTEM_ROLES.OWNER, permissions: allPermissions },
    { name: SYSTEM_ROLES.ADMIN, permissions: allPermissions.filter((p) => p !== PERMISSIONS.ROLE_MANAGE) },
    {
      name: SYSTEM_ROLES.WAREHOUSE_OPERATOR,
      permissions: [PERMISSIONS.INVENTORY_MOVEMENT_CREATE, PERMISSIONS.PRODUCT_UPDATE],
    },
    { name: SYSTEM_ROLES.VIEWER, permissions: [] },
  ];

  const roles = new Map<string, string>();
  for (const spec of specs) {
    const role = await Role.findOneAndUpdate(
      { companyId: null, name: spec.name, isSystem: true },
      { $setOnInsert: { permissions: spec.permissions } },
      { upsert: true, new: true },
    );
    roles.set(spec.name, role._id.toString());
  }
  return roles;
}

async function main() {
  await mongoose.connect(env.mongodbUri);
  console.log("Conectado a MongoDB para seed");

  const roles = await ensureSystemRoles();
  console.log("Roles de sistema listos:", [...roles.keys()].join(", "));

  let company = await Company.findOne({ slug: DEV_COMPANY_SLUG });
  if (!company) {
    company = await Company.create({
      name: "Ferretería Demo",
      slug: DEV_COMPANY_SLUG,
      settings: { timezone: "America/Argentina/Buenos_Aires", currency: "ARS" },
    });
    console.log("Empresa creada:", company.slug);
  } else {
    console.log("Empresa ya existía:", company.slug);
  }

  let branch = await Branch.findOne({ companyId: company._id, code: "CENTRAL" });
  if (!branch) {
    branch = await Branch.create({
      companyId: company._id,
      name: "Sucursal Central",
      code: "CENTRAL",
    });
    console.log("Sucursal creada:", branch.code);
  }

  const existingOwner = await User.findOne({ email: DEV_OWNER_EMAIL }).setOptions({
    allowCrossTenant: true,
  });

  if (existingOwner) {
    console.log("El usuario owner ya existe:", DEV_OWNER_EMAIL);
  } else {
    const passwordHash = await hashPassword(DEV_OWNER_PASSWORD);
    await User.create({
      companyId: company._id,
      email: DEV_OWNER_EMAIL,
      passwordHash,
      name: "Owner Demo",
      roleId: roles.get(SYSTEM_ROLES.OWNER),
      branchRestrictions: [],
    });
    console.log("\nUsuario owner creado:");
    console.log(`  email:    ${DEV_OWNER_EMAIL}`);
    console.log(`  password: ${DEV_OWNER_PASSWORD}`);
    console.log("  (cambiar esta contraseña en cuanto exista una pantalla de gestión de usuarios)");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Seed falló:", err);
  process.exit(1);
});
