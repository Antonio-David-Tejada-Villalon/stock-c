import { Types } from "mongoose";
import { Notification, type NotificationDocument, type NotificationType } from "../../db/models/notification.model.js";
import type { ListNotificationsQuery } from "./notification.schemas.js";

const DEFAULT_LIMIT = 20;

function toView(doc: NotificationDocument, userId: string) {
  return {
    id: doc._id.toString(),
    type: doc.type,
    message: doc.message,
    productId: doc.productId?.toString(),
    read: doc.readBy.some((id) => id.toString() === userId),
    createdAt: doc.createdAt.toISOString(),
  };
}

interface Cursor {
  createdAt: string;
  id: string;
}

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

function decodeCursor(raw: string): Cursor {
  const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Cursor).createdAt !== "string" ||
    typeof (parsed as Cursor).id !== "string"
  ) {
    throw new Error("invalid cursor");
  }
  return parsed as Cursor;
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

/**
 * Creación interna, llamada directamente desde otros services (no hay
 * endpoint `POST /notifications` — nada externo crea notificaciones a
 * mano). Ver docs/12-notificaciones.md, sección 3, sobre por qué esto
 * vive dentro de los flujos existentes en vez de un worker/cron separado.
 *
 * `clientMutationId` es opcional pero, cuando viene (rechazos de
 * movimientos), dedup contra reintentos concurrentes del mismo intento de
 * sync — incidente real, ver docs/12, "Revisión": el motor de sync puede
 * disparar el mismo `clientMutationId` más de una vez casi al mismo
 * tiempo, y un rechazo (a diferencia de un movimiento exitoso) no deja
 * ningún otro rastro que lo prevenga.
 */
export async function createNotification(
  companyId: string,
  type: NotificationType,
  message: string,
  productId?: string,
  clientMutationId?: string,
): Promise<void> {
  try {
    await Notification.create({ companyId, type, message, productId, clientMutationId, readBy: [] });
  } catch (err) {
    if (isDuplicateKeyError(err)) return; // ya se creó por un intento concurrente — no es un error
    throw err;
  }
}

export function createNotificationService() {
  return {
    async list(companyId: string, userId: string, query: ListNotificationsQuery) {
      const limit = query.limit ?? DEFAULT_LIMIT;
      const seek = query.cursor ? decodeCursor(query.cursor) : null;
      const seekFilter = seek
        ? {
            $or: [
              { createdAt: { $lt: new Date(seek.createdAt) } },
              { createdAt: new Date(seek.createdAt), _id: { $lt: new Types.ObjectId(seek.id) } },
            ],
          }
        : {};

      const docs = await Notification.find({ companyId, ...seekFilter })
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1);
      const hasMore = docs.length > limit;
      const page = hasMore ? docs.slice(0, limit) : docs;
      const last = page[page.length - 1];
      const nextCursor =
        hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last._id.toString() }) : null;

      return { items: page.map((doc) => toView(doc, userId)), nextCursor };
    },

    async unreadCount(companyId: string, userId: string) {
      const count = await Notification.countDocuments({ companyId, readBy: { $ne: userId } });
      return { count };
    },

    /** `$addToSet` es naturalmente idempotente — marcar dos veces la misma
     * notificación como leída no es un error. */
    async markRead(companyId: string, userId: string, id: string) {
      await Notification.updateOne({ companyId, _id: id }, { $addToSet: { readBy: userId } });
    },
  };
}

export type NotificationService = ReturnType<typeof createNotificationService>;
