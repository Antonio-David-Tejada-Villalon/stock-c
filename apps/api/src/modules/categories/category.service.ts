import { Category, type CategoryDocument } from "../../db/models/category.model.js";
import type { CreateCategoryBody, UpdateCategoryBody } from "./category.schemas.js";

export class CategoryError extends Error {
  constructor(public code: "not_found" | "version_conflict" | "invalid_parent" | "cycle") {
    super(code);
  }
}

function toView(doc: CategoryDocument) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    parentId: doc.parentId?.toString(),
    active: doc.active,
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/**
 * Camina desde el padre propuesto hacia la raíz; si el recorrido llega al
 * propio documento (`id`), asignarlo como padre crearía un ciclo — ver
 * docs/08-categorias-marcas-unidades.md, sección 2.
 */
async function assertValidParent(companyId: string, id: string | null, parentId: string | null | undefined) {
  if (!parentId) return;
  if (id && parentId === id) throw new CategoryError("cycle");

  let cursor: string | undefined = parentId;
  const visited = new Set<string>();
  while (cursor) {
    if (id && cursor === id) throw new CategoryError("cycle");
    if (visited.has(cursor)) return; // ciclo preexistente ajeno: no es problema de esta operación
    visited.add(cursor);
    const parentDoc: CategoryDocument | null = await Category.findOne({ companyId, _id: cursor });
    if (!parentDoc) throw new CategoryError("invalid_parent");
    cursor = parentDoc.parentId?.toString();
  }
}

export function createCategoryService() {
  return {
    async list(companyId: string, activeOnly?: boolean) {
      const filter = activeOnly === undefined ? {} : { active: activeOnly };
      const docs = await Category.find({ companyId, ...filter })
        .sort({ name: 1 })
        .limit(1000);
      return docs.map(toView);
    },

    async get(companyId: string, id: string) {
      const doc = await Category.findOne({ companyId, _id: id });
      if (!doc) throw new CategoryError("not_found");
      return toView(doc);
    },

    async create(companyId: string, body: CreateCategoryBody) {
      await assertValidParent(companyId, null, body.parentId ?? null);
      const doc = await Category.create({
        companyId,
        name: body.name,
        parentId: body.parentId ?? null,
      });
      return toView(doc);
    },

    async update(companyId: string, id: string, body: UpdateCategoryBody) {
      const { version, ...fields } = body;
      if ("parentId" in fields) {
        await assertValidParent(companyId, id, fields.parentId ?? null);
      }
      const doc = await Category.findOneAndUpdate(
        { companyId, _id: id, version },
        { $set: fields, $inc: { version: 1 } },
        { new: true },
      );
      if (!doc) {
        const exists = await Category.findOne({ companyId, _id: id });
        throw new CategoryError(exists ? "version_conflict" : "not_found");
      }
      return toView(doc);
    },

    /** Soft delete, igual que productos (Fase 7) — no bloquea aunque haya
     * productos activos referenciándola (decisión confirmada, ver docs/08). */
    async deactivate(companyId: string, id: string) {
      const doc = await Category.findOneAndUpdate(
        { companyId, _id: id },
        { $set: { active: false }, $inc: { version: 1 } },
        { new: true },
      );
      if (!doc) throw new CategoryError("not_found");
      return toView(doc);
    },
  };
}

export type CategoryService = ReturnType<typeof createCategoryService>;
