import type { Types } from "mongoose";
import { Schema, model } from "mongoose";
import { tenantScopePlugin } from "../plugins/tenantScope.js";

export type StockMovementType = "entrada" | "salida" | "ajuste";

export interface StockMovementDocument {
  _id: string;
  companyId: Types.ObjectId;
  branchId: Types.ObjectId;
  productId: Types.ObjectId;
  type: StockMovementType;
  // Positivo en entrada/salida (el signo lo da `type`); positivo o
  // negativo en ajuste — ver docs/09-control-inventario.md, sección 2.
  quantity: Types.Decimal128;
  sequence: number;
  reason?: string;
  reference?: string;
  clientMutationId: string;
  createdBy: Types.ObjectId;
  clientCreatedAt: Date;
  createdAt: Date;
}

const stockMovementSchema = new Schema<StockMovementDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company" },
    branchId: { type: Schema.Types.ObjectId, required: true, ref: "Branch" },
    productId: { type: Schema.Types.ObjectId, required: true, ref: "Product" },
    type: { type: String, required: true, enum: ["entrada", "salida", "ajuste"] },
    quantity: { type: Schema.Types.Decimal128, required: true },
    sequence: { type: Number, required: true },
    reason: { type: String, trim: true },
    reference: { type: String, trim: true },
    clientMutationId: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    clientCreatedAt: { type: Date, required: true },
  },
  // Append-only: sin updatedAt, un movimiento nunca se edita.
  { timestamps: { createdAt: true, updatedAt: false } },
);

stockMovementSchema.index({ companyId: 1, clientMutationId: 1 }, { unique: true });
stockMovementSchema.index({ companyId: 1, branchId: 1, productId: 1, sequence: 1 });
stockMovementSchema.index({ companyId: 1, branchId: 1, createdAt: -1 });
stockMovementSchema.plugin(tenantScopePlugin);

export const StockMovement = model<StockMovementDocument>("StockMovement", stockMovementSchema);
