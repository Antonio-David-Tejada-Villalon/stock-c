import type { Schema } from "mongoose";

const SCOPED_QUERY_OPS = [
  "find",
  "findOne",
  "findOneAndUpdate",
  "findOneAndDelete",
  "countDocuments",
  "updateMany",
  "deleteMany",
] as const;

/**
 * Aislamiento multiempresa (Fase 1, Decisión 3): cualquier query sobre un
 * modelo con este plugin que no incluya `companyId` en el filtro lanza en
 * vez de ejecutarse. Es un cinturón de seguridad a nivel de ORM, no
 * reemplaza pasar `companyId` explícitamente en la capa de servicio.
 *
 * Única excepción deliberada: el login necesita ubicar a un usuario por
 * email *antes* de saber su companyId (el email es único por empresa, no
 * global — ver docs/03-modelo-datos.md, Decisión 1). Para ese único caso,
 * la query debe optar explícitamente con `.setOptions({ allowCrossTenant:
 * true })` — no hay forma de saltear el chequeo por accidente.
 */
export function tenantScopePlugin(schema: Schema) {
  for (const op of SCOPED_QUERY_OPS) {
    schema.pre(
      op,
      function (this: { getQuery: () => Record<string, unknown>; getOptions: () => Record<string, unknown> }) {
        if (this.getOptions().allowCrossTenant === true) {
          return;
        }
        const query = this.getQuery();
        if (!("companyId" in query)) {
          throw new Error(
            `Refused to run "${op}" without a companyId filter — every tenant-scoped ` +
              `query must be explicitly scoped, or opt out via setOptions({ allowCrossTenant: true }). ` +
              `See docs/01-arquitectura.md, Decisión 3.`,
          );
        }
      },
    );
  }
}
