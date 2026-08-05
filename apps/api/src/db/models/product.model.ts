import type { Types } from "mongoose";
import { Schema, model } from "mongoose";
import { tenantScopePlugin } from "../plugins/tenantScope.js";

export interface ProductDocument {
  _id: string;
  companyId: Types.ObjectId;
  sku: string;
  name: string;
  description?: string;
  categoryId?: Types.ObjectId;
  brandId?: Types.ObjectId;
  unitId?: Types.ObjectId;
  barcode?: string;
  price: Types.Decimal128;
  cost?: Types.Decimal128;
  images: string[];
  active: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: Types.ObjectId;
}

const productSchema = new Schema<ProductDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company" },
    sku: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    // Opcionales por ahora — ver docs/07-productos.md, sección 1
    // (Categorías/Marcas/Unidades son Fase 8, todavía no existen).
    categoryId: { type: Schema.Types.ObjectId, ref: "Category" },
    brandId: { type: Schema.Types.ObjectId, ref: "Brand" },
    unitId: { type: Schema.Types.ObjectId, ref: "Unit" },
    barcode: { type: String, trim: true },
    price: { type: Schema.Types.Decimal128, required: true },
    cost: { type: Schema.Types.Decimal128 },
    images: { type: [String], default: [] },
    active: { type: Boolean, required: true, default: true },
    version: { type: Number, required: true, default: 0 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

productSchema.index({ companyId: 1, sku: 1 }, { unique: true });
productSchema.index({ companyId: 1, categoryId: 1 });
productSchema.index({ companyId: 1, active: 1, name: 1 });
productSchema.index({ name: "text", sku: "text", barcode: "text" });
productSchema.plugin(tenantScopePlugin);

export const Product = model<ProductDocument>("Product", productSchema);
