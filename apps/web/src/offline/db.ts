import Dexie, { type EntityTable } from "dexie";
import type { Product, StockLevel, StockMovementType } from "@stock-c/shared-types";

export interface OutboxMovement {
  localId?: number;
  clientMutationId: string;
  productId: string;
  type: StockMovementType;
  /** Positivo en entrada/salida; positivo o negativo en ajuste. */
  quantity: string;
  reason?: string;
  reference?: string;
  createdAt: string;
  status: "pending" | "syncing" | "failed";
  errorMessage?: string;
}

export interface MetaRow {
  key: string;
  value: string;
}

/**
 * Caché local (IndexedDB vía Dexie) para el recorte de Fase 10:
 * productos + stock de solo lectura, movimientos como cola de escritura
 * — ver docs/10-offline-first.md, sección 5.
 */
export class StockCOfflineDB extends Dexie {
  products!: EntityTable<Product, "id">;
  stockLevels!: EntityTable<StockLevel, "productId">;
  outboxMovements!: EntityTable<OutboxMovement, "localId">;
  meta!: EntityTable<MetaRow, "key">;

  constructor() {
    super("stock-c-offline");
    this.version(1).stores({
      products: "id, sku, name, updatedAt",
      stockLevels: "productId",
      outboxMovements: "++localId, status, createdAt",
      meta: "key",
    });
  }
}

export const db = new StockCOfflineDB();

export const PRODUCTS_SYNC_CURSOR_KEY = "productsSyncCursor";

/**
 * Se llama al cerrar sesión: sin esto, los datos cacheados de una
 * empresa podrían quedar visibles si otro usuario (de otra empresa)
 * inicia sesión después en el mismo dispositivo — el servidor aísla por
 * tenant, pero IndexedDB no sabe nada de tenants por sí solo.
 */
export async function clearOfflineData(): Promise<void> {
  await Promise.all([
    db.products.clear(),
    db.stockLevels.clear(),
    db.outboxMovements.clear(),
    db.meta.clear(),
  ]);
}
