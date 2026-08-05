import type { Model } from "mongoose";

/**
 * Factory de servicio CRUD para catálogos simples (sin jerarquía) que
 * comparten forma: `name`, `active`, `version`. Usado por Brand y Unit —
 * ver docs/08-categorias-marcas-unidades.md, sección 2, sobre por qué
 * Category (que sí tiene jerarquía) no usa este factory.
 *
 * Internamente opera contra el modelo como `Model<any>`: Mongoose no puede
 * inferir filtros/updates genéricos sobre un `TDoc` de tipo variable, y
 * forzar esa inferencia con `as unknown as TDoc` en cada llamada sería más
 * ruido que valor — la forma pública del factory (`TCreate`/`TUpdate`/
 * `TView`) es la que sí queda tipada para quien lo consume.
 */
export class CatalogError extends Error {
  constructor(public code: "not_found" | "duplicate_name" | "version_conflict") {
    super(code);
  }
}

interface BaseCatalogDoc {
  _id: string;
  companyId: unknown;
  active: boolean;
  version: number;
}

export interface SimpleCatalogService<TCreate, TUpdate, TView> {
  list(companyId: string, activeOnly?: boolean): Promise<TView[]>;
  get(companyId: string, id: string): Promise<TView>;
  create(companyId: string, body: TCreate): Promise<TView>;
  update(companyId: string, id: string, body: TUpdate & { version: number }): Promise<TView>;
  deactivate(companyId: string, id: string): Promise<TView>;
}

export function createSimpleCatalogService<
  TDoc extends BaseCatalogDoc,
  TView,
  TCreate extends object = Partial<TDoc>,
  TUpdate extends object = Partial<TDoc>,
>(model: Model<TDoc>, toView: (doc: TDoc) => TView): SimpleCatalogService<TCreate, TUpdate, TView> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ver comentario del factory arriba
  const anyModel = model as unknown as Model<any>;

  return {
    async list(companyId, activeOnly) {
      const filter = { companyId, ...(activeOnly === undefined ? {} : { active: activeOnly }) };
      const docs = await anyModel.find(filter).sort({ name: 1 }).limit(500);
      return docs.map((doc: TDoc) => toView(doc));
    },

    async get(companyId, id) {
      const doc = await anyModel.findOne({ companyId, _id: id });
      if (!doc) throw new CatalogError("not_found");
      return toView(doc);
    },

    async create(companyId, body) {
      try {
        const doc = await anyModel.create({ ...body, companyId });
        return toView(doc);
      } catch (err) {
        if (isDuplicateKeyError(err)) throw new CatalogError("duplicate_name");
        throw err;
      }
    },

    async update(companyId, id, body) {
      const { version, ...fields } = body;
      try {
        const doc = await anyModel.findOneAndUpdate(
          { companyId, _id: id, version },
          { $set: fields, $inc: { version: 1 } },
          { new: true },
        );
        if (!doc) {
          const exists = await anyModel.findOne({ companyId, _id: id });
          throw new CatalogError(exists ? "version_conflict" : "not_found");
        }
        return toView(doc);
      } catch (err) {
        if (err instanceof CatalogError) throw err;
        if (isDuplicateKeyError(err)) throw new CatalogError("duplicate_name");
        throw err;
      }
    },

    async deactivate(companyId, id) {
      const doc = await anyModel.findOneAndUpdate(
        { companyId, _id: id },
        { $set: { active: false }, $inc: { version: 1 } },
        { new: true },
      );
      if (!doc) throw new CatalogError("not_found");
      return toView(doc);
    },
  };
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}
