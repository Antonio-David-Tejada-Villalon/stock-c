import { Category, type CategoryDocument } from "../../db/models/category.model.js";
import type { CreateCategoryBody, MoveCategoryBody, UpdateCategoryBody } from "./category.schemas.js";

export class CategoryError extends Error {
  constructor(
    public code: "not_found" | "version_conflict" | "invalid_parent" | "cycle" | "duplicate_code" | "already_at_edge",
  ) {
    super(code);
  }
}

function toView(doc: CategoryDocument) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    parentId: doc.parentId?.toString(),
    code: doc.code,
    icon: doc.icon,
    color: doc.color,
    imageUrl: doc.imageUrl,
    order: doc.order,
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

/** order = max de los hermanos existentes (mismo companyId+parentId) + 1,
 * o 0 si es la primera — ver adenda de docs/08, sección "Arquitectura". */
async function nextOrder(companyId: string, parentId: string | null): Promise<number> {
  const last = await Category.findOne({ companyId, parentId }).sort({ order: -1 });
  return last ? last.order + 1 : 0;
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

/** Separa un patch en $set/$unset — un campo explícitamente `null` se
 * *elimina* del documento en vez de guardarse como `null`: necesario para
 * que el índice disperso y único de `code` no trate dos "null" como
 * duplicados entre sí (un índice sparse sí indexa un `null` explícito). */
function splitPatch(fields: Record<string, unknown>): { $set: Record<string, unknown>; $unset: Record<string, ""> } {
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ""> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === null) $unset[key] = "";
    else $set[key] = value;
  }
  return { $set, $unset };
}

export function createCategoryService() {
  return {
    async list(companyId: string, activeOnly?: boolean) {
      const filter = activeOnly === undefined ? {} : { active: activeOnly };
      const docs = await Category.find({ companyId, ...filter })
        .sort({ order: 1, name: 1 })
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
      const parentId = body.parentId ?? null;
      const order = await nextOrder(companyId, parentId);
      try {
        // No pasar code/icon/color/imageUrl como `undefined`: el driver de
        // Mongo los serializa como BSON `null`, y el índice sparse+único de
        // `code` sí indexa un `null` explícito (solo ignora el campo
        // *ausente*) — dos categorías sin código chocarían entre sí. Se
        // arma el objeto solo con las claves que realmente vienen.
        const doc = await Category.create({
          companyId,
          name: body.name,
          parentId,
          order,
          ...(body.code !== undefined ? { code: body.code } : {}),
          ...(body.icon !== undefined ? { icon: body.icon } : {}),
          ...(body.color !== undefined ? { color: body.color } : {}),
          ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
        });
        return toView(doc);
      } catch (err) {
        if (isDuplicateKeyError(err)) throw new CategoryError("duplicate_code");
        throw err;
      }
    },

    async update(companyId: string, id: string, body: UpdateCategoryBody) {
      const { version, ...fields } = body;
      if ("parentId" in fields) {
        await assertValidParent(companyId, id, fields.parentId ?? null);
      }
      const { $set, $unset } = splitPatch(fields);
      try {
        const doc = await Category.findOneAndUpdate(
          { companyId, _id: id, version },
          { $set, ...(Object.keys($unset).length > 0 ? { $unset } : {}), $inc: { version: 1 } },
          { new: true },
        );
        if (!doc) {
          const exists = await Category.findOne({ companyId, _id: id });
          throw new CategoryError(exists ? "version_conflict" : "not_found");
        }
        return toView(doc);
      } catch (err) {
        if (isDuplicateKeyError(err)) throw new CategoryError("duplicate_code");
        throw err;
      }
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

    /** Intercambia `order` con el hermano adyacente (mismo parentId) —
     * sin transacción, ver justificación en la adenda de docs/08. */
    async move(companyId: string, id: string, direction: MoveCategoryBody["direction"]) {
      const doc = await Category.findOne({ companyId, _id: id });
      if (!doc) throw new CategoryError("not_found");

      const siblings = await Category.find({ companyId, parentId: doc.parentId ?? null }).sort({ order: 1, name: 1 });
      const index = siblings.findIndex((s) => s._id.toString() === id);
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= siblings.length) {
        throw new CategoryError("already_at_edge");
      }

      const target = siblings[targetIndex]!;
      const [docOrder, targetOrder] = [doc.order, target.order];
      await Promise.all([
        Category.updateOne({ companyId, _id: doc._id }, { $set: { order: targetOrder } }),
        Category.updateOne({ companyId, _id: target._id }, { $set: { order: docOrder } }),
      ]);
    },
  };
}

export type CategoryService = ReturnType<typeof createCategoryService>;
