import type { Types } from "mongoose";
import { Schema, model } from "mongoose";
import { tenantScopePlugin } from "../plugins/tenantScope.js";

export type NotificationType = "low_stock" | "movement_rejected";

export interface NotificationDocument {
  _id: string;
  companyId: Types.ObjectId;
  type: NotificationType;
  /** Texto ya armado al crear la notificación — snapshot histórico, no se
   * recalcula a partir del producto (que puede cambiar de nombre después).
   * Ver docs/12-notificaciones.md, sección 2. */
  message: string;
  productId?: Types.ObjectId;
  /** Solo presente en `movement_rejected` — dedup de reintentos
   * concurrentes del mismo intento de sync (incidente real, ver docs/12,
   * sección "Revisión"): a diferencia de un movimiento que sí se crea
   * (protegido por este mismo campo en `StockMovement`), un rechazo no
   * deja rastro propio, así que sin esto dos llamadas a `createMovement()`
   * con el mismo `clientMutationId` generaban dos notificaciones. */
  clientMutationId?: string;
  /** userIds que marcaron esta notificación como leída — el estado de
   * lectura es por usuario, no por empresa. Ver docs/12, sección 2. */
  readBy: Types.ObjectId[];
  createdAt: Date;
}

const notificationSchema = new Schema<NotificationDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company" },
    type: { type: String, required: true, enum: ["low_stock", "movement_rejected"] },
    message: { type: String, required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    clientMutationId: { type: String, trim: true },
    readBy: { type: [Schema.Types.ObjectId], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ companyId: 1, createdAt: -1 });
// Mismo patrón que el índice único-y-opcional de `code` en Categorías
// (partialFilterExpression, no `sparse` — ver docs/08, adenda) para que
// dos notificaciones sin `clientMutationId` (ej. `low_stock`, que no
// tiene uno natural) nunca choquen entre sí.
notificationSchema.index(
  { companyId: 1, clientMutationId: 1 },
  { unique: true, partialFilterExpression: { clientMutationId: { $exists: true, $type: "string" } } },
);
notificationSchema.plugin(tenantScopePlugin);

export const Notification = model<NotificationDocument>("Notification", notificationSchema);
