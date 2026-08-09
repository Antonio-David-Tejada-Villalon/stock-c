import mongoose, { Types } from "mongoose";
import { Product, type ProductDocument } from "../../db/models/product.model.js";
import { StockMovement, type StockMovementDocument } from "../../db/models/stockMovement.model.js";
import { StockLevel, type StockLevelDocument } from "../../db/models/stockLevel.model.js";
import { User } from "../../db/models/user.model.js";
import { resolveActiveBranch, NoActiveBranchError } from "../../db/helpers/resolveActiveBranch.js";
import { createNotification } from "../notifications/notification.service.js";
import { addDecimal, compareDecimal } from "../../lib/decimal.js";
import type { CreateMovementBody, ListMovementsQuery } from "./stockMovement.schemas.js";

export interface DuplicateMovementDetail {
  byUserName: string;
  quantity: string;
  createdAt: string;
}

export class InventoryError extends Error {
  constructor(
    public code:
      | "not_found"
      | "no_active_branch"
      | "invalid_quantity"
      | "reason_required"
      | "insufficient_stock"
      | "possible_duplicate",
    public detail?: DuplicateMovementDetail,
  ) {
    super(code);
  }
}

const DEFAULT_LIMIT = 20;

// Ventana para el aviso de "posible duplicado" entre operadores distintos
// (ver docs/13-configuracion-general.md, adenda post-verificación) — no
// bloquea, es una advertencia: el movimiento ya se guardó de forma
// optimista (Fase 10) y este chequeo corre recién al sincronizar contra
// el servidor, así que se resuelve en la sección "Con error" de
// /movimientos, con el mismo mecanismo de Reintentar/Descartar que
// insufficient_stock.
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

function toMovementView(doc: StockMovementDocument) {
  return {
    id: doc._id.toString(),
    productId: doc.productId.toString(),
    type: doc.type,
    quantity: doc.quantity.toString(),
    sequence: doc.sequence,
    reason: doc.reason,
    reference: doc.reference,
    createdBy: doc.createdBy.toString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

function toStockLevelView(productId: string, doc: StockLevelDocument | null) {
  return { productId, quantity: doc ? doc.quantity.toString() : "0" };
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

/**
 * Notifica solo en la transición de "ok" a "bajo" (no en cada movimiento
 * mientras ya está bajo) — mismo umbral `<=` que
 * `reportService.lowStock()` (Fase 11). Se llama después de que la
 * transacción del movimiento ya confirmó — un fallo acá no debe hacer
 * rollback de un movimiento que sí se aplicó. Ver docs/12-notificaciones.md,
 * sección 2.
 */
async function notifyIfCrossedLowStock(
  companyId: string,
  product: ProductDocument,
  previousQtyStr: string,
  deltaStr: string,
): Promise<void> {
  if (!product.minStock) return;
  const minStock = product.minStock.toString();
  const newQtyStr = addDecimal(previousQtyStr, deltaStr);
  const wasOk = compareDecimal(previousQtyStr, minStock) > 0;
  const isLowNow = compareDecimal(newQtyStr, minStock) <= 0;
  if (wasOk && isLowNow) {
    await createNotification(
      companyId,
      "low_stock",
      `Stock bajo: «${product.name}» quedó en ${newQtyStr} (mínimo ${minStock}).`,
      product._id.toString(),
    );
  }
}

interface GeneralCursor {
  createdAt: string;
  id: string;
}

function encodeGeneralCursor(c: GeneralCursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

function decodeGeneralCursor(raw: string): GeneralCursor {
  const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as GeneralCursor).createdAt !== "string" ||
    typeof (parsed as GeneralCursor).id !== "string"
  ) {
    throw new Error("invalid cursor");
  }
  return parsed as GeneralCursor;
}

/** Traduce el error genérico del helper compartido al código que ya
 * espera `errorToResponse` en stockMovement.routes.ts. */
async function resolveBranch(companyId: string) {
  try {
    return await resolveActiveBranch(companyId);
  } catch (err) {
    if (err instanceof NoActiveBranchError) throw new InventoryError("no_active_branch");
    throw err;
  }
}

export function createInventoryService() {
  return {
    async createMovement(companyId: string, userId: string, body: CreateMovementBody) {
      const branch = await resolveBranch(companyId);

      const product = await Product.findOne({ companyId, _id: body.productId });
      if (!product) throw new InventoryError("not_found");

      const quantityNum = Number(body.quantity);
      if (body.type === "ajuste") {
        if (quantityNum === 0) throw new InventoryError("invalid_quantity");
        if (!body.reason?.trim()) throw new InventoryError("reason_required");
      } else if (quantityNum <= 0) {
        throw new InventoryError("invalid_quantity");
      }

      // Aritmética por string, no por float: delta exacto para lo que se
      // persiste. El $inc lo resuelve Mongo de forma nativa sobre
      // Decimal128 — ver docs/09-control-inventario.md, sección 2.
      const deltaStr = body.type === "salida" ? `-${body.quantity}` : body.quantity;

      if (!body.confirmDuplicate) {
        const windowStart = new Date(Date.now() - DUPLICATE_WINDOW_MS);
        const recent = await StockMovement.findOne({
          companyId,
          branchId: branch._id,
          productId: body.productId,
          type: body.type,
          createdBy: { $ne: userId },
          createdAt: { $gte: windowStart },
        }).sort({ createdAt: -1 });
        if (recent) {
          const byUser = await User.findOne({ companyId, _id: recent.createdBy });
          throw new InventoryError("possible_duplicate", {
            byUserName: byUser?.name ?? "otro usuario",
            quantity: recent.quantity.toString(),
            createdAt: recent.createdAt.toISOString(),
          });
        }
      }

      const session = await mongoose.startSession();
      try {
        let movementDoc: StockMovementDocument | undefined;
        let levelDoc: StockLevelDocument | undefined;
        let previousQtyStr = "0";

        await session.withTransaction(async () => {
          const existing = await StockLevel.findOne({
            companyId,
            branchId: branch._id,
            productId: body.productId,
          }).session(session);

          previousQtyStr = existing ? existing.quantity.toString() : "0";

          // Comparación en memoria solo para decidir si bloquear — el
          // valor guardado sale siempre del $inc nativo de Mongo.
          const current = Number(previousQtyStr);
          if (current + Number(deltaStr) < 0) {
            throw new InventoryError("insufficient_stock");
          }

          levelDoc = await StockLevel.findOneAndUpdate(
            { companyId, branchId: branch._id, productId: body.productId },
            { $inc: { quantity: deltaStr, lastSequence: 1 } },
            { upsert: true, new: true, session },
          ) as StockLevelDocument;

          const created = await StockMovement.create(
            [
              {
                companyId,
                branchId: branch._id,
                productId: body.productId,
                type: body.type,
                quantity: body.quantity,
                sequence: levelDoc.lastSequence,
                reason: body.reason,
                reference: body.reference,
                clientMutationId: body.clientMutationId,
                createdBy: userId,
                clientCreatedAt: new Date(),
              },
            ],
            { session },
          );
          movementDoc = created[0];
        });

        await notifyIfCrossedLowStock(companyId, product, previousQtyStr, deltaStr);

        return {
          movement: toMovementView(movementDoc!),
          stockLevel: toStockLevelView(body.productId, levelDoc!),
          replayed: false,
        };
      } catch (err) {
        if (isDuplicateKeyError(err)) {
          // Reintento de una request ya procesada (mismo clientMutationId)
          // — idempotencia, no error. Devuelve lo ya creado.
          const existingMovement = await StockMovement.findOne({ companyId, clientMutationId: body.clientMutationId });
          if (existingMovement) {
            const level = await StockLevel.findOne({ companyId, branchId: branch._id, productId: body.productId });
            return {
              movement: toMovementView(existingMovement),
              stockLevel: toStockLevelView(body.productId, level),
              replayed: true,
            };
          }
        }
        // `source: "sync"` distingue un movimiento que llega del outbox
        // offline (Fase 10) de uno tipeado en el formulario online — el
        // segundo ya muestra el error al instante, no necesita notificación
        // (ver docs/12-notificaciones.md, sección 2).
        if (err instanceof InventoryError && err.code === "insufficient_stock" && body.source === "sync") {
          await createNotification(
            companyId,
            "movement_rejected",
            `No se pudo sincronizar un movimiento de «${product.name}»: dejaría el stock en negativo.`,
            body.productId,
            body.clientMutationId,
          );
        }
        throw err;
      } finally {
        await session.endSession();
      }
    },

    async listMovements(companyId: string, query: ListMovementsQuery) {
      const limit = query.limit ?? DEFAULT_LIMIT;
      const branch = await resolveBranch(companyId);

      if (query.productId) {
        // Kardex real de un producto: orden por `sequence`, denso y sin
        // ambigüedad para ese producto — cursor numérico simple.
        const cursorSeq = query.cursor ? Number(query.cursor) : null;
        const filter: Record<string, unknown> = {
          companyId,
          branchId: branch._id,
          productId: query.productId,
        };
        if (cursorSeq !== null) filter.sequence = { $lt: cursorSeq };

        const docs = await StockMovement.find(filter)
          .sort({ sequence: -1 })
          .limit(limit + 1);
        const hasMore = docs.length > limit;
        const page = hasMore ? docs.slice(0, limit) : docs;
        const last = page[page.length - 1];
        const nextCursor = hasMore && last ? String(last.sequence) : null;
        return { items: page.map(toMovementView), nextCursor };
      }

      // Feed general (todos los productos): orden por `createdAt`, mismo
      // patrón de cursor tipo seek que productos (Fase 7).
      const seek = query.cursor ? decodeGeneralCursor(query.cursor) : null;
      const seekFilter = seek
        ? {
            $or: [
              { createdAt: { $lt: new Date(seek.createdAt) } },
              { createdAt: new Date(seek.createdAt), _id: { $lt: new Types.ObjectId(seek.id) } },
            ],
          }
        : {};

      const docs = await StockMovement.find({ companyId, branchId: branch._id, ...seekFilter })
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1);
      const hasMore = docs.length > limit;
      const page = hasMore ? docs.slice(0, limit) : docs;
      const last = page[page.length - 1];
      const nextCursor =
        hasMore && last ? encodeGeneralCursor({ createdAt: last.createdAt.toISOString(), id: last._id.toString() }) : null;

      return { items: page.map(toMovementView), nextCursor };
    },

    async getStockLevels(companyId: string, productIds: string[]) {
      const branch = await resolveBranch(companyId);
      const docs = await StockLevel.find({
        companyId,
        branchId: branch._id,
        productId: { $in: productIds },
      });
      const byProduct = new Map(docs.map((d) => [d.productId.toString(), d]));
      return productIds.map((id) => toStockLevelView(id, byProduct.get(id) ?? null));
    },
  };
}

export type InventoryService = ReturnType<typeof createInventoryService>;
