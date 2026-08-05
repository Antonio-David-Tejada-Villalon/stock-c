import { Type, type Static } from "@sinclair/typebox";

const MovementTypeSchema = Type.Union([
  Type.Literal("entrada"),
  Type.Literal("salida"),
  Type.Literal("ajuste"),
]);

export const StockMovementViewSchema = Type.Object({
  id: Type.String(),
  productId: Type.String(),
  type: MovementTypeSchema,
  quantity: Type.String(),
  sequence: Type.Number(),
  reason: Type.Optional(Type.String()),
  reference: Type.Optional(Type.String()),
  createdBy: Type.String(),
  createdAt: Type.String(),
});

export const StockLevelViewSchema = Type.Object({
  productId: Type.String(),
  quantity: Type.String(),
});

// Acepta signo negativo en el pattern porque `ajuste` puede restar — la
// regla de "positivo obligatorio en entrada/salida" se valida en el
// service, no acá (ver docs/09-control-inventario.md, sección 2).
export const CreateMovementBodySchema = Type.Object({
  productId: Type.String(),
  type: MovementTypeSchema,
  quantity: Type.String({ pattern: "^-?\\d+(\\.\\d{1,4})?$" }),
  reason: Type.Optional(Type.String({ maxLength: 500 })),
  reference: Type.Optional(Type.String({ maxLength: 100 })),
  clientMutationId: Type.String({ minLength: 1, maxLength: 100 }),
});
export type CreateMovementBody = Static<typeof CreateMovementBodySchema>;

export const ListMovementsQuerySchema = Type.Object({
  productId: Type.Optional(Type.String()),
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});
export type ListMovementsQuery = Static<typeof ListMovementsQuerySchema>;

export const ListMovementsResponseSchema = Type.Object({
  items: Type.Array(StockMovementViewSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
});

export const ListStockLevelsQuerySchema = Type.Object({
  productIds: Type.String({ minLength: 1 }),
});
export type ListStockLevelsQuery = Static<typeof ListStockLevelsQuerySchema>;

export const ListStockLevelsResponseSchema = Type.Object({
  items: Type.Array(StockLevelViewSchema),
});
