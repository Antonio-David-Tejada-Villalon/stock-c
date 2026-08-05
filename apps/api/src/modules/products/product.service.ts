import { Types } from "mongoose";
import { Product, type ProductDocument } from "../../db/models/product.model.js";
import type {
  CreateProductBody,
  ListProductsQuery,
  UpdateProductBody,
} from "./product.schemas.js";

export class ProductError extends Error {
  constructor(public code: "not_found" | "duplicate_sku" | "version_conflict") {
    super(code);
  }
}

const DEFAULT_LIMIT = 20;
const MAX_SEARCH_RESULTS = 50;

function toView(doc: ProductDocument) {
  return {
    id: doc._id.toString(),
    sku: doc.sku,
    name: doc.name,
    description: doc.description,
    barcode: doc.barcode,
    price: doc.price.toString(),
    cost: doc.cost?.toString(),
    active: doc.active,
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

interface Cursor {
  name: string;
  id: string;
}

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

function decodeCursor(raw: string): Cursor {
  const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Cursor).name !== "string" ||
    typeof (parsed as Cursor).id !== "string"
  ) {
    throw new Error("invalid cursor");
  }
  return parsed as Cursor;
}

export function createProductService() {
  return {
    async list(companyId: string, query: ListProductsQuery) {
      const limit = query.limit ?? DEFAULT_LIMIT;
      const activeFilter = query.active === undefined ? {} : { active: query.active };

      if (query.q) {
        // Búsqueda de texto: primer corte, sin paginación por cursor —
        // ver docs/07-productos.md, sección 6, limitación aceptada.
        const docs = await Product.find(
          { companyId, ...activeFilter, $text: { $search: query.q } },
          { score: { $meta: "textScore" } },
        )
          .sort({ score: { $meta: "textScore" } })
          .limit(MAX_SEARCH_RESULTS);
        return { items: docs.map(toView), nextCursor: null };
      }

      const seek = query.cursor ? decodeCursor(query.cursor) : null;
      const seekFilter = seek
        ? {
            $or: [
              { name: { $gt: seek.name } },
              { name: seek.name, _id: { $gt: new Types.ObjectId(seek.id) } },
            ],
          }
        : {};

      const docs = await Product.find({ companyId, ...activeFilter, ...seekFilter })
        .sort({ name: 1, _id: 1 })
        .limit(limit + 1);

      const hasMore = docs.length > limit;
      const page = hasMore ? docs.slice(0, limit) : docs;
      const last = page[page.length - 1];
      const nextCursor = hasMore && last ? encodeCursor({ name: last.name, id: last._id.toString() }) : null;

      return { items: page.map(toView), nextCursor };
    },

    async get(companyId: string, id: string) {
      const doc = await Product.findOne({ companyId, _id: id });
      if (!doc) throw new ProductError("not_found");
      return toView(doc);
    },

    async create(companyId: string, userId: string, body: CreateProductBody) {
      try {
        const doc = await Product.create({
          companyId,
          sku: body.sku,
          name: body.name,
          description: body.description,
          barcode: body.barcode,
          price: body.price,
          cost: body.cost,
          updatedBy: userId,
        });
        return toView(doc);
      } catch (err) {
        if (isDuplicateKeyError(err)) throw new ProductError("duplicate_sku");
        throw err;
      }
    },

    async update(companyId: string, userId: string, id: string, body: UpdateProductBody) {
      const { version, ...fields } = body;
      try {
        const doc = await Product.findOneAndUpdate(
          { companyId, _id: id, version },
          { $set: { ...fields, updatedBy: userId }, $inc: { version: 1 } },
          { new: true },
        );
        if (!doc) {
          const exists = await Product.findOne({ companyId, _id: id });
          throw new ProductError(exists ? "version_conflict" : "not_found");
        }
        return toView(doc);
      } catch (err) {
        if (isDuplicateKeyError(err)) throw new ProductError("duplicate_sku");
        throw err;
      }
    },

    /** Soft delete: nunca se borra un producto de verdad (puede quedar
     * referenciado por movimientos de stock a partir de Fase 9). */
    async deactivate(companyId: string, userId: string, id: string) {
      const doc = await Product.findOneAndUpdate(
        { companyId, _id: id },
        { $set: { active: false, updatedBy: userId }, $inc: { version: 1 } },
        { new: true },
      );
      if (!doc) throw new ProductError("not_found");
      return toView(doc);
    },
  };
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

export type ProductService = ReturnType<typeof createProductService>;
