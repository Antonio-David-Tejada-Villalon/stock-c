import type { Types } from "mongoose";
import { Schema, model } from "mongoose";
export { PERMISSIONS } from "@stock-c/shared-types";

export interface RoleDocument {
  _id: string;
  companyId: Types.ObjectId | null;
  name: string;
  permissions: string[];
  isSystem: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<RoleDocument>(
  {
    // null = rol de sistema, disponible a todo tenant (ver docs/03-modelo-datos.md).
    // No lleva tenantScopePlugin porque los roles de sistema son intencionalmente
    // legibles sin companyId; el filtrado por empresa lo hace la capa de servicio.
    companyId: { type: Schema.Types.ObjectId, ref: "Company", default: null },
    name: { type: String, required: true, trim: true },
    permissions: { type: [String], required: true, default: [] },
    isSystem: { type: Boolean, required: true, default: false },
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

roleSchema.index({ companyId: 1, name: 1 });

export const Role = model<RoleDocument>("Role", roleSchema);

export const SYSTEM_ROLES = {
  OWNER: "Owner",
  ADMIN: "Admin",
  WAREHOUSE_OPERATOR: "Operador de almacén",
  VIEWER: "Visor",
} as const;
