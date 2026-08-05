import type { Types } from "mongoose";
import { Schema, model } from "mongoose";
import { tenantScopePlugin } from "../plugins/tenantScope.js";

export interface CategoryDocument {
  _id: string;
  companyId: Types.ObjectId;
  name: string;
  parentId?: Types.ObjectId | null;
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
    active: { type: Boolean, required: true, default: true },
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

// Sin índice único en name: una misma categoría (ej. "Tornillos") puede
// repetirse como subcategoría bajo padres distintos — ver docs/08, sección 2.
categorySchema.index({ companyId: 1, parentId: 1 });
categorySchema.index({ companyId: 1, name: 1 });
categorySchema.plugin(tenantScopePlugin);

export const Category = model<CategoryDocument>("Category", categorySchema);
