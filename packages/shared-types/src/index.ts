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
  /** Productos activos con `minStock` cargado y stock actual por debajo
   * de ese umbral (Fase 11). Ver `LowStockReport` para el detalle. */
  lowStockCount: number;
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
  /** Umbral para el reporte de stock bajo (Fase 11) — opcional. */
  minStock?: string;
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
  /** Único por empresa cuando está presente. */
  code?: string;
  /** Nombre de ícono de lucide-react (ej. "Wrench"). */
  icon?: string;
  color?: string;
  imageUrl?: string;
  /** Orden manual, scoped a hermanos (mismo parentId). */
  order: number;
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

// Reportes (Fase 11) — ver docs/11-reportes.md.

export interface InventoryValuationItem {
  productId: string;
  sku: string;
  name: string;
  categoryId?: string;
  brandId?: string;
  quantity: string;
  cost: string;
  value: string;
}

export interface InventoryValuationGroup {
  id: string;
  name: string;
  totalQuantity: string;
  totalValue: string;
}

export interface InventoryValuationReport {
  items: InventoryValuationItem[];
  byCategory: InventoryValuationGroup[];
  byBrand: InventoryValuationGroup[];
  grandTotal: string;
  /** Productos activos sin `cost` cargado — no entran a la valorización. */
  excludedCount: number;
}

export interface MovementsReportItem {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  categoryId?: string;
  type: StockMovementType;
  quantity: string;
  reason?: string;
  reference?: string;
  createdByName: string;
  createdAt: string;
}

export interface MovementsReportTotals {
  entrada: string;
  salida: string;
  ajuste: string;
}

export interface MovementsReport {
  items: MovementsReportItem[];
  totalsByType: MovementsReportTotals;
  /** true si había más de 5000 resultados y se cortó — ver docs/11. */
  truncated: boolean;
}

export interface CatalogSummaryGroup {
  id: string;
  name: string;
  activeCount: number;
  totalStock: string;
}

export interface CatalogSummaryReport {
  byCategory: CatalogSummaryGroup[];
  byBrand: CatalogSummaryGroup[];
  totalActiveProducts: number;
  totalInactiveProducts: number;
}

export interface LowStockItem {
  productId: string;
  sku: string;
  name: string;
  categoryId?: string;
  quantity: string;
  minStock: string;
  deficit: string;
}

export interface LowStockReport {
  items: LowStockItem[];
}

// Notificaciones (Fase 12) — ver docs/12-notificaciones.md.

export type NotificationType = "low_stock" | "movement_rejected";

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  productId?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  items: Notification[];
  nextCursor: string | null;
}

export interface UnreadNotificationCount {
  count: number;
}
