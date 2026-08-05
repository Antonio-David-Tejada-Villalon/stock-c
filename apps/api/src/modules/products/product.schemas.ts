import { Type, type Static } from "@sinclair/typebox";

export const ProductViewSchema = Type.Object({
  id: Type.String(),
  sku: Type.String(),
  name: Type.String(),
  description: Type.Optional(Type.String()),
  barcode: Type.Optional(Type.String()),
  price: Type.String(),
  cost: Type.Optional(Type.String()),
  active: Type.Boolean(),
  version: Type.Number(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const CreateProductBodySchema = Type.Object({
  sku: Type.String({ minLength: 1, maxLength: 64 }),
  name: Type.String({ minLength: 1, maxLength: 200 }),
  description: Type.Optional(Type.String({ maxLength: 2000 })),
  barcode: Type.Optional(Type.String({ maxLength: 64 })),
  price: Type.String({ pattern: "^\\d+(\\.\\d{1,4})?$" }),
  cost: Type.Optional(Type.String({ pattern: "^\\d+(\\.\\d{1,4})?$" })),
});
export type CreateProductBody = Static<typeof CreateProductBodySchema>;

export const UpdateProductBodySchema = Type.Object({
  version: Type.Number(),
  sku: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  description: Type.Optional(Type.String({ maxLength: 2000 })),
  barcode: Type.Optional(Type.String({ maxLength: 64 })),
  price: Type.Optional(Type.String({ pattern: "^\\d+(\\.\\d{1,4})?$" })),
  cost: Type.Optional(Type.String({ pattern: "^\\d+(\\.\\d{1,4})?$" })),
  active: Type.Optional(Type.Boolean()),
});
export type UpdateProductBody = Static<typeof UpdateProductBodySchema>;

export const ListProductsQuerySchema = Type.Object({
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  q: Type.Optional(Type.String({ maxLength: 200 })),
  active: Type.Optional(Type.Boolean()),
});
export type ListProductsQuery = Static<typeof ListProductsQuerySchema>;

export const ListProductsResponseSchema = Type.Object({
  items: Type.Array(ProductViewSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
});
