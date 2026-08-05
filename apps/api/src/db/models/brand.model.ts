import type { Types } from "mongoose";
import { Schema, model } from "mongoose";
import { tenantScopePlugin } from "../plugins/tenantScope.js";

export interface BrandDocument {
  _id: string;
  companyId: Types.ObjectId;
  name: string;
  active: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const brandSchema = new Schema<BrandDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company" },
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, required: true, default: true },
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

brandSchema.index({ companyId: 1, name: 1 }, { unique: true });
brandSchema.plugin(tenantScopePlugin);

export const Brand = model<BrandDocument>("Brand", brandSchema);
