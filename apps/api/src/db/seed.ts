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
import { Category } from "./models/category.model.js";
import { Brand } from "./models/brand.model.js";
import { Unit } from "./models/unit.model.js";
import { Product } from "./models/product.model.js";
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
    // `$set` (no `$setOnInsert`): un rol de sistema ya existente tiene que
    // sincronizar sus permisos en cada corrida del seed, no solo al
    // crearse — si no, un rol creado en una fase temprana nunca recibe
    // los permisos que se agregan en fases posteriores (bug real
    // encontrado al verificar la adenda de Categorías, ver docs/08).
    const role = await Role.findOneAndUpdate(
      { companyId: null, name: spec.name, isSystem: true },
      { $set: { permissions: spec.permissions } },
      { upsert: true, new: true },
    );
    roles.set(spec.name, role._id.toString());
  }
  return roles;
}

/**
 * Datos de ejemplo con sabor a San Juan, Argentina (Cuyo) — nombres de
 * marca ficticios, no empresas reales, para no implicar una asociación
 * real con ningún negocio existente. Sirven para probar Fase 7/8 con
 * datos que no sean genéricos ("Producto 1", "Marca A").
 */
async function ensureCategories(companyId: string): Promise<Map<string, string>> {
  const byName = new Map<string, string>();

  // `$set` (no `$setOnInsert`) en `order`: las categorías de este seed se
  // crearon en Fase 8, antes de que existiera el campo `order` (adenda de
  // Categorías) — todas quedaron con el default 0, así que las flechas
  // ▲/▼ intercambiaban 0 por 0 y no se veía ningún cambio. Reasignar el
  // order en cada corrida del seed backfillea las categorías ya existentes.
  const root = await Category.findOneAndUpdate(
    { companyId, name: "Ferretería", parentId: null },
    { $set: { order: 0 } },
    { upsert: true, new: true },
  );
  byName.set("Ferretería", root._id.toString());

  const children = ["Herramientas manuales", "Herramientas eléctricas", "Tornillería y fijaciones"];
  for (const [index, name] of children.entries()) {
    const doc = await Category.findOneAndUpdate(
      { companyId, name, parentId: root._id },
      { $set: { order: index } },
      { upsert: true, new: true },
    );
    byName.set(name, doc._id.toString());
  }

  const topLevelSiblings = ["Pinturería", "Jardín"];
  for (const [index, name] of topLevelSiblings.entries()) {
    const doc = await Category.findOneAndUpdate(
      { companyId, name, parentId: null },
      // +1 porque "Ferretería" ya ocupa el order 0 en este mismo nivel (parentId: null)
      { $set: { order: index + 1 } },
      { upsert: true, new: true },
    );
    byName.set(name, doc._id.toString());
  }

  return byName;
}

async function ensureBrands(companyId: string): Promise<Map<string, string>> {
  const names = ["Cuyo Herramientas", "Pie de Palo Ferretera", "Zonda Tools", "Calingasta Hierros"];
  const byName = new Map<string, string>();
  for (const name of names) {
    const doc = await Brand.findOneAndUpdate(
      { companyId, name },
      { $setOnInsert: {} },
      { upsert: true, new: true },
    );
    byName.set(name, doc._id.toString());
  }
  return byName;
}

async function ensureUnits(companyId: string): Promise<Map<string, string>> {
  const specs = [
    { name: "Unidad", abbreviation: "un" },
    { name: "Kilogramo", abbreviation: "kg" },
    { name: "Metro", abbreviation: "mt" },
    { name: "Litro", abbreviation: "lt" },
  ];
  const byName = new Map<string, string>();
  for (const spec of specs) {
    const doc = await Unit.findOneAndUpdate(
      { companyId, name: spec.name },
      { $setOnInsert: { abbreviation: spec.abbreviation } },
      { upsert: true, new: true },
    );
    byName.set(spec.name, doc._id.toString());
  }
  return byName;
}

async function ensureProducts(
  companyId: string,
  categories: Map<string, string>,
  brands: Map<string, string>,
  units: Map<string, string>,
) {
  const products = [
    {
      sku: "SJ-MART-001",
      name: "Martillo carpintero 20oz",
      category: "Herramientas manuales",
      brand: "Cuyo Herramientas",
      unit: "Unidad",
      price: "8500.00",
      cost: "5200.00",
    },
    {
      sku: "SJ-DEST-002",
      name: "Juego de destornilladores x6",
      category: "Herramientas manuales",
      brand: "Pie de Palo Ferretera",
      unit: "Unidad",
      price: "6200.00",
      cost: "3800.00",
    },
    {
      sku: "SJ-TALA-003",
      name: "Taladro percutor 650W",
      category: "Herramientas eléctricas",
      brand: "Zonda Tools",
      unit: "Unidad",
      price: "45000.00",
      cost: "31000.00",
    },
    {
      sku: "SJ-AMOL-004",
      name: 'Amoladora angular 4 1/2"',
      category: "Herramientas eléctricas",
      brand: "Zonda Tools",
      unit: "Unidad",
      price: "38000.00",
      cost: "26000.00",
    },
    {
      sku: "SJ-TORN-005",
      name: "Tornillos autoperforantes 8x1 (caja x100)",
      category: "Tornillería y fijaciones",
      brand: "Calingasta Hierros",
      unit: "Unidad",
      price: "3200.00",
      cost: "1900.00",
    },
    {
      sku: "SJ-PINT-006",
      name: "Pintura látex interior blanco",
      category: "Pinturería",
      brand: "Pie de Palo Ferretera",
      unit: "Litro",
      price: "5400.00",
      cost: "3600.00",
    },
    {
      sku: "SJ-CABL-007",
      name: "Cable eléctrico unipolar 2.5mm",
      category: "Ferretería",
      brand: "Cuyo Herramientas",
      unit: "Metro",
      price: "850.00",
      cost: "520.00",
    },
    {
      sku: "SJ-PALA-008",
      name: "Pala punta redonda",
      category: "Jardín",
      brand: "Calingasta Hierros",
      unit: "Unidad",
      price: "7200.00",
      cost: "4700.00",
    },
  ];

  for (const p of products) {
    await Product.findOneAndUpdate(
      { companyId, sku: p.sku },
      {
        $setOnInsert: {
          name: p.name,
          categoryId: categories.get(p.category),
          brandId: brands.get(p.brand),
          unitId: units.get(p.unit),
          price: p.price,
          cost: p.cost,
        },
      },
      { upsert: true, new: true },
    );
  }
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

  const categories = await ensureCategories(company._id);
  const brands = await ensureBrands(company._id);
  const units = await ensureUnits(company._id);
  await ensureProducts(company._id, categories, brands, units);
  console.log("Categorías, marcas, unidades y productos de ejemplo listos");

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
