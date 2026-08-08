import { Type, type Static } from "@sinclair/typebox";

const NotificationTypeSchema = Type.Union([Type.Literal("low_stock"), Type.Literal("movement_rejected")]);

export const NotificationViewSchema = Type.Object({
  id: Type.String(),
  type: NotificationTypeSchema,
  message: Type.String(),
  productId: Type.Optional(Type.String()),
  read: Type.Boolean(),
  createdAt: Type.String(),
});

export const ListNotificationsQuerySchema = Type.Object({
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});
export type ListNotificationsQuery = Static<typeof ListNotificationsQuerySchema>;

export const ListNotificationsResponseSchema = Type.Object({
  items: Type.Array(NotificationViewSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
});

export const UnreadCountResponseSchema = Type.Object({
  count: Type.Number(),
});
