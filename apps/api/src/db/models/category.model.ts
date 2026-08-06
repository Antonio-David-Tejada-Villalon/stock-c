import type { Types } from "mongoose";
import { Schema, model } from "mongoose";
import { tenantScopePlugin } from "../plugins/tenantScope.js";

export interface CategoryDocument {
  _id: string;
  companyId: Types.ObjectId;
  name: string;
  parentId?: Types.ObjectId | null;
  /** Único por empresa cuando está presente (índice disperso) — ver
   * docs/08-categorias-marcas-unidades.md, adenda. */
  code?: string;
  /** Nombre de ícono de lucide-react (ej. "Wrench") — sin validar contra
   * una lista cerrada acá, ver justificación en la adenda de docs/08. */
  icon?: string;
  color?: string;
  imageUrl?: string;
  /** Orden manual, scoped a (companyId, parentId) — no compara hermanos
   * de ramas distintas del árbol. */
  order: number;
  active: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<CategoryDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company" },
    name: { type: String, required: true, trim: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    code: { type: String, trim: true },
    icon: { type: String, trim: true, maxlength: 100 },
    color: { type: String, trim: true },
    imageUrl: { type: String, trim: true, maxlength: 2000 },
    order: { type: Number, required: true, default: 0 },
    active: { type: Boolean, required: true, default: true },
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

// Sin índice único en name: una misma categoría (ej. "Tornillos") puede
// repetirse como subcategoría bajo padres distintos — ver docs/08, sección 2.
categorySchema.index({ companyId: 1, parentId: 1 });
categorySchema.index({ companyId: 1, name: 1 });
categorySchema.index({ companyId: 1, parentId: 1, order: 1 });
// `sparse` en un índice compuesto NO alcanza acá: un compound index sparse
// solo excluye un documento si TODOS sus campos indexados están ausentes,
// y `companyId` siempre está presente — dos categorías sin `code` igual
// chocarían indexadas como `code: null`. `partialFilterExpression` sí
// excluye exactamente los documentos sin `code`, sea cual sea el resto.
categorySchema.index(
  { companyId: 1, code: 1 },
  { unique: true, partialFilterExpression: { code: { $exists: true, $type: "string" } } },
);
categorySchema.plugin(tenantScopePlugin);

export const Category = model<CategoryDocument>("Category", categorySchema);
