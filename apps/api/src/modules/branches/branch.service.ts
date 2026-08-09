import { Branch, type BranchDocument } from "../../db/models/branch.model.js";
import type { CreateBranchBody, UpdateBranchBody } from "./branch.schemas.js";

export class BranchError extends Error {
  constructor(public code: "not_found" | "version_conflict" | "duplicate_code" | "cannot_delete_active") {
    super(code);
  }
}

function toView(doc: BranchDocument) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    code: doc.code,
    address: doc.address,
    active: doc.active,
    version: doc.version,
  };
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

export function createBranchService() {
  return {
    async list(companyId: string) {
      const docs = await Branch.find({ companyId }).sort({ name: 1 });
      return docs.map(toView);
    },

    async create(companyId: string, body: CreateBranchBody) {
      try {
        const doc = await Branch.create({
          companyId,
          name: body.name,
          code: body.code,
          address: body.address,
          active: false,
        });
        return toView(doc);
      } catch (err) {
        if (isDuplicateKeyError(err)) throw new BranchError("duplicate_code");
        throw err;
      }
    },

    async update(companyId: string, id: string, body: UpdateBranchBody) {
      const { version, ...fields } = body;
      const $set: Record<string, unknown> = {};
      const $unset: Record<string, ""> = {};
      if (fields.name !== undefined) $set.name = fields.name;
      if (fields.code !== undefined) $set.code = fields.code;
      if ("address" in fields) {
        if (fields.address === null) $unset.address = "";
        else if (fields.address !== undefined) $set.address = fields.address;
      }

      try {
        const doc = await Branch.findOneAndUpdate(
          { companyId, _id: id, version },
          { $set, ...(Object.keys($unset).length > 0 ? { $unset } : {}), $inc: { version: 1 } },
          { new: true },
        );
        if (!doc) {
          const exists = await Branch.findOne({ companyId, _id: id });
          throw new BranchError(exists ? "version_conflict" : "not_found");
        }
        return toView(doc);
      } catch (err) {
        if (isDuplicateKeyError(err)) throw new BranchError("duplicate_code");
        throw err;
      }
    },

    /**
     * Activa `id` y desactiva todas las demás sucursales de la empresa —
     * sin transacción de Mongo (justificado en docs/13). Activa la
     * elegida ANTES de desactivar el resto (no al revés): si algo falla
     * a mitad de camino, el peor caso es un momento con dos activas
     * (`resolveActiveBranch` lo rechaza y listo) en vez de un momento con
     * cero activas — preferible porque falla igual de fuerte pero se
     * autocorrige solo en el siguiente intento, sin dejar a la empresa
     * sin ninguna sucursal operable en el medio.
     */
    async activate(companyId: string, id: string) {
      const target = await Branch.findOne({ companyId, _id: id });
      if (!target) throw new BranchError("not_found");

      await Branch.updateOne({ companyId, _id: id }, { $set: { active: true } });
      await Branch.updateMany({ companyId, _id: { $ne: id } }, { $set: { active: false } });
    },

    /**
     * Borrado definitivo, no desactivación (mismo criterio que
     * Usuarios, ver docs/13, "Revisión"). Única guarda: no se puede
     * borrar la sucursal activa — hacerlo dejaría a la empresa sin
     * ninguna sucursal activa, y `resolveActiveBranch()` rechaza
     * *todas* las operaciones de inventario (movimientos, stock,
     * reportes) hasta que alguien active otra a mano. Las sucursales
     * inactivas no se referencian en ninguna consulta en vivo — el
     * sistema siempre opera contra "la sucursal activa" (Fase 9), así
     * que borrar una inactiva no rompe nada que ya estuviera visible.
     */
    async delete(companyId: string, id: string) {
      const target = await Branch.findOne({ companyId, _id: id });
      if (!target) throw new BranchError("not_found");
      if (target.active) throw new BranchError("cannot_delete_active");

      await Branch.deleteOne({ companyId, _id: id });
    },
  };
}

export type BranchService = ReturnType<typeof createBranchService>;
