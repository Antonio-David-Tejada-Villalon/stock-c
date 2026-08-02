import type { Types } from "mongoose";
import { Schema, model } from "mongoose";
import { tenantScopePlugin } from "../plugins/tenantScope.js";

export interface BranchDocument {
  _id: string;
  companyId: Types.ObjectId;
  name: string;
  code: string;
  address?: string;
  active: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const branchSchema = new Schema<BranchDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company" },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    address: { type: String, trim: true },
    active: { type: Boolean, required: true, default: true },
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

branchSchema.index({ companyId: 1, code: 1 }, { unique: true });
branchSchema.index({ companyId: 1, active: 1 });
branchSchema.plugin(tenantScopePlugin);

export const Branch = model<BranchDocument>("Branch", branchSchema);
