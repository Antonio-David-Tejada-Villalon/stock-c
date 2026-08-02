import type { Types } from "mongoose";
import { Schema, model } from "mongoose";
import { tenantScopePlugin } from "../plugins/tenantScope.js";

export interface UserDocument {
  _id: string;
  companyId: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  avatarUrl?: string;
  roleId: Types.ObjectId;
  branchRestrictions: Types.ObjectId[];
  active: boolean;
  lastLoginAt?: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company" },
    email: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    avatarUrl: { type: String },
    roleId: { type: Schema.Types.ObjectId, required: true, ref: "Role" },
    branchRestrictions: { type: [Schema.Types.ObjectId], ref: "Branch", default: [] },
    active: { type: Boolean, required: true, default: true },
    lastLoginAt: { type: Date },
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

userSchema.index({ companyId: 1, email: 1 }, { unique: true });
userSchema.index({ companyId: 1, active: 1 });
userSchema.plugin(tenantScopePlugin);

export const User = model<UserDocument>("User", userSchema);
