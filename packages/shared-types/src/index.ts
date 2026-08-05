// Tipos compartidos entre apps/web y apps/api. Los tipos de dominio de
// inventario (Product, StockMovement, etc.) se agregan a partir de la
// Fase 7 en adelante, sobre el modelo definido en docs/03-modelo-datos.md.

export interface HealthStatus {
  status: "ok" | "error";
  service: string;
  timestamp: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  companyId: string;
  role: {
    id: string;
    name: string;
    permissions: string[];
  };
  branchRestrictions: string[];
}

// Strings libres, no enum cerrado — ver docs/03-modelo-datos.md, colección
// `roles`: módulos futuros pueden registrar permisos nuevos sin migrar.
export const PERMISSIONS = {
  PRODUCT_CREATE: "product:create",
  PRODUCT_UPDATE: "product:update",
  PRODUCT_DELETE: "product:delete",
  CATEGORY_CREATE: "category:create",
  CATEGORY_UPDATE: "category:update",
  CATEGORY_DELETE: "category:delete",
  BRAND_CREATE: "brand:create",
  BRAND_UPDATE: "brand:update",
  BRAND_DELETE: "brand:delete",
  UNIT_CREATE: "unit:create",
  UNIT_UPDATE: "unit:update",
  UNIT_DELETE: "unit:delete",
  INVENTORY_MOVEMENT_CREATE: "inventory:movement:create",
  USER_MANAGE: "user:manage",
  ROLE_MANAGE: "role:manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface DashboardRecentMovement {
  id: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantity: string;
  createdAt: string;
}

export interface DashboardSummary {
  branchCount: number;
  activeUserCount: number;
  productCount: number;
  movementsTodayCount: number;
  recentMovements: DashboardRecentMovement[];
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  brandId?: string;
  unitId?: string;
  barcode?: string;
  /** String decimal, nunca number — ver docs/07-productos.md, sección 2. */
  price: string;
  cost?: string;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductListResponse {
  items: Product[];
  nextCursor: string | null;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryListResponse {
  items: Category[];
}

export interface Brand {
  id: string;
  name: string;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface BrandListResponse {
  items: Brand[];
}

export interface Unit {
  id: string;
  name: string;
  abbreviation?: string;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface UnitListResponse {
  items: Unit[];
}

export type StockMovementType = "entrada" | "salida" | "ajuste";

export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  /** String decimal — positivo en entrada/salida, positivo o negativo en
   * ajuste. Ver docs/09-control-inventario.md, sección 2. */
  quantity: string;
  sequence: number;
  reason?: string;
  reference?: string;
  createdBy: string;
  createdAt: string;
}

export interface StockMovementListResponse {
  items: StockMovement[];
  nextCursor: string | null;
}

export interface StockLevel {
  productId: string;
  quantity: string;
}

export interface StockLevelListResponse {
  items: StockLevel[];
}

export interface CreateStockMovementResponse {
  movement: StockMovement;
  stockLevel: StockLevel;
}
