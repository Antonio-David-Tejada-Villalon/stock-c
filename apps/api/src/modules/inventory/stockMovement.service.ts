import mongoose, { Types } from "mongoose";
import { Branch, type BranchDocument } from "../../db/models/branch.model.js";
import { Product } from "../../db/models/product.model.js";
import { StockMovement, type StockMovementDocument } from "../../db/models/stockMovement.model.js";
import { StockLevel, type StockLevelDocument } from "../../db/models/stockLevel.model.js";
import type { CreateMovementBody, ListMovementsQuery } from "./stockMovement.schemas.js";

export class InventoryError extends Error {
  constructor(
    public code:
      | "not_found"
      | "no_active_branch"
      | "invalid_quantity"
      | "reason_required"
      | "insufficient_stock",
  ) {
    super(code);
  }
}

const DEFAULT_LIMIT = 20;

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

/**
 * Resuelve la única sucursal activa de la empresa — Fase 9 asume
 * sucursal única implícita (decisión explícita del usuario, ver
 * docs/09-control-inventario.md, sección 2). Falla ruidosamente en vez
 * de elegir "cualquiera" si hay 0 o más de 1 sucursal activa.
 */
async function resolveActiveBranch(companyId: string): Promise<BranchDocument> {
  const branches = await Branch.find({ companyId, active: true }).limit(2);
  const [branch] = branches;
  if (branches.length !== 1 || !branch) {
    throw new InventoryError("no_active_branch");
  }
  return branch;
}

export function createInventoryService() {
  return {
    async createMovement(companyId: string, userId: string, body: CreateMovementBody) {
      const branch = await resolveActiveBranch(companyId);

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

      const session = await mongoose.startSession();
      try {
        let movementDoc: StockMovementDocument | undefined;
        let levelDoc: StockLevelDocument | undefined;

        await session.withTransaction(async () => {
          const existing = await StockLevel.findOne({
            companyId,
            branchId: branch._id,
            productId: body.productId,
          }).session(session);

          // Comparación en memoria solo para decidir si bloquear — el
          // valor guardado sale siempre del $inc nativo de Mongo.
          const current = existing ? Number(existing.quantity.toString()) : 0;
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
        throw err;
      } finally {
        await session.endSession();
      }
    },

    async listMovements(companyId: string, query: ListMovementsQuery) {
      const limit = query.limit ?? DEFAULT_LIMIT;
      const branch = await resolveActiveBranch(companyId);

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
      const branch = await resolveActiveBranch(companyId);
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
