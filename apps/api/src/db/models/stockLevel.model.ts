import type { Types } from "mongoose";
import { Schema, model } from "mongoose";
import { tenantScopePlugin } from "../plugins/tenantScope.js";

export interface StockLevelDocument {
  _id: string;
  companyId: Types.ObjectId;
  branchId: Types.ObjectId;
  productId: Types.ObjectId;
  quantity: Types.Decimal128;
  lastSequence: number;
  updatedAt: Date;
}

// Caché materializado, nunca editable a mano — 100% reconstruible desde
// stockMovements. Ver docs/03-modelo-datos.md, sección 3.11.
const stockLevelSchema = new Schema<StockLevelDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company" },
    branchId: { type: Schema.Types.ObjectId, required: true, ref: "Branch" },
    productId: { type: Schema.Types.ObjectId, required: true, ref: "Product" },
    quantity: { type: Schema.Types.Decimal128, required: true, default: "0" },
    lastSequence: { type: Number, required: true, default: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

stockLevelSchema.index({ companyId: 1, branchId: 1, productId: 1 }, { unique: true });
stockLevelSchema.plugin(tenantScopePlugin);

export const StockLevel = model<StockLevelDocument>("StockLevel", stockLevelSchema);
