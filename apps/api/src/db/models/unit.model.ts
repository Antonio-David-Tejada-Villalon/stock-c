import type { Types } from "mongoose";
import { Schema, model } from "mongoose";
import { tenantScopePlugin } from "../plugins/tenantScope.js";

export interface UnitDocument {
  _id: string;
  companyId: Types.ObjectId;
  name: string;
  abbreviation?: string;
  active: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const unitSchema = new Schema<UnitDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company" },
    name: { type: String, required: true, trim: true },
    abbreviation: { type: String, trim: true },
    active: { type: Boolean, required: true, default: true },
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

unitSchema.index({ companyId: 1, name: 1 }, { unique: true });
unitSchema.plugin(tenantScopePlugin);

export const Unit = model<UnitDocument>("Unit", unitSchema);
