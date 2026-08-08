import type { StockMovementType } from "@stock-c/shared-types";
import { ApiAuthError } from "../features/auth/api";
import { listProducts } from "../features/products/api";
import { createMovement, getStockLevels } from "../features/inventory/api";
import { db, PRODUCTS_SYNC_CURSOR_KEY, type OutboxMovement } from "./db";

const PRODUCTS_PULL_LIMIT = 100;

function computeDelta(type: StockMovementType, quantity: string): number {
  const n = Number(quantity);
  return type === "salida" ? -n : n;
}

/**
 * Ajuste optimista del stock cacheado — solo para mostrar de inmediato,
 * nunca se persiste en el servidor. Ver docs/10-offline-first.md, sección 2.
 */
async function applyOptimisticDelta(productId: string, delta: number): Promise<void> {
  const level = await db.stockLevels.get(productId);
  const current = level ? Number(level.quantity) : 0;
  await db.stockLevels.put({ productId, quantity: String(current + delta) });
}

async function getSyncCursor(): Promise<string | undefined> {
  const row = await db.meta.get(PRODUCTS_SYNC_CURSOR_KEY);
  return row?.value;
}

async function setSyncCursor(value: string): Promise<void> {
  await db.meta.put({ key: PRODUCTS_SYNC_CURSOR_KEY, value });
}

/** Trae los productos cambiados desde el último cursor guardado (o todos,
 * la primera vez) y los vuelca en el caché local — ver docs/10, secciones
 * 2 y 6 (modo delta de GET /products). */
export async function pullProducts(accessToken: string): Promise<void> {
  const since = (await getSyncCursor()) ?? new Date(0).toISOString();
  let cursor: string | null = null;
  let latestUpdatedAt: string | undefined;

  do {
    const res = await listProducts(accessToken, { updatedSince: since, cursor, limit: PRODUCTS_PULL_LIMIT });
    if (res.items.length > 0) {
      await db.products.bulkPut(res.items);
      latestUpdatedAt = res.items[res.items.length - 1]?.updatedAt;
    }
    cursor = res.nextCursor;
  } while (cursor);

  if (latestUpdatedAt) await setSyncCursor(latestUpdatedAt);
}

/** Refresca el stock cacheado para todos los productos ya en el caché —
 * ver docs/10, sección 2, sobre por qué se reusa el endpoint por lote de
 * Fase 9 en vez de diseñar un delta específico para stockLevels. */
export async function pullStockLevels(accessToken: string): Promise<void> {
  const productIds = await db.products.toCollection().primaryKeys();
  if (productIds.length === 0) return;
  const res = await getStockLevels(accessToken, productIds);
  await db.stockLevels.bulkPut(res.items);
}

/** Único punto de entrada para crear un movimiento: siempre pasa por la
 * cola, esté online o no — ver docs/10, sección 2. */
export async function queueMovement(input: {
  productId: string;
  type: StockMovementType;
  quantity: string;
  reason?: string;
  reference?: string;
}): Promise<void> {
  await db.outboxMovements.add({
    clientMutationId: crypto.randomUUID(),
    productId: input.productId,
    type: input.type,
    quantity: input.quantity,
    reason: input.reason,
    reference: input.reference,
    createdAt: new Date().toISOString(),
    status: "pending",
  });
  await applyOptimisticDelta(input.productId, computeDelta(input.type, input.quantity));
}

/** Vacía la cola contra el servidor. Fallas de red dejan el movimiento
 * "pending" (se reintenta solo en la próxima sync); un rechazo real del
 * servidor (ej. insufficient_stock) lo deja "failed", visible para que
 * el usuario decida — nunca se descarta en silencio ni se reintenta solo. */
export async function pushOutbox(accessToken: string): Promise<void> {
  const pending = await db.outboxMovements.where("status").equals("pending").toArray();

  for (const movement of pending) {
    if (movement.localId === undefined) continue;
    await db.outboxMovements.update(movement.localId, { status: "syncing" });
    try {
      await createMovement(accessToken, {
        productId: movement.productId,
        type: movement.type,
        quantity: movement.quantity,
        reason: movement.reason,
        reference: movement.reference,
        clientMutationId: movement.clientMutationId,
        source: "sync",
      });
      await db.outboxMovements.delete(movement.localId);
    } catch (err) {
      if (err instanceof ApiAuthError) {
        await applyOptimisticDelta(movement.productId, -computeDelta(movement.type, movement.quantity));
        await db.outboxMovements.update(movement.localId, { status: "failed", errorMessage: err.message });
      } else {
        // No llegó a responder el servidor (sin red) — reintenta en la próxima sync.
        await db.outboxMovements.update(movement.localId, { status: "pending" });
      }
    }
  }
}

export async function retryFailedMovement(localId: number): Promise<void> {
  const movement = await db.outboxMovements.get(localId);
  if (!movement) return;
  await applyOptimisticDelta(movement.productId, computeDelta(movement.type, movement.quantity));
  await db.outboxMovements.update(localId, { status: "pending", errorMessage: undefined });
}

export async function discardFailedMovement(localId: number): Promise<void> {
  await db.outboxMovements.delete(localId);
}

export async function pendingMovementsCount(): Promise<number> {
  return db.outboxMovements.where("status").anyOf(["pending", "syncing"]).count();
}

/** Orquesta una sync completa: primero vacía la cola (para que el pull
 * de después ya refleje esos movimientos), después trae deltas de
 * productos y refresca el stock. */
export async function runSync(accessToken: string): Promise<void> {
  await pushOutbox(accessToken);
  await pullProducts(accessToken);
  await pullStockLevels(accessToken);
}

export type { OutboxMovement };
