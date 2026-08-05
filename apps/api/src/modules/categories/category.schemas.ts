import { Type, type Static } from "@sinclair/typebox";

export const CategoryViewSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  parentId: Type.Optional(Type.String()),
  active: Type.Boolean(),
  version: Type.Number(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const CreateCategoryBodySchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 200 }),
  parentId: Type.Optional(Type.String()),
});
export type CreateCategoryBody = Static<typeof CreateCategoryBodySchema>;

export const UpdateCategoryBodySchema = Type.Object({
  version: Type.Number(),
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  // null = quitarle el padre (pasa a ser categoría raíz); ausente = no tocar.
  // Null primero en el Union: con coerceTypes de AJV, si "string" fuera la
  // primera rama, un null entrante se coacciona a "" antes de intentar la
  // rama "null" — Mongoose después revienta al castear "" como ObjectId.
  parentId: Type.Optional(Type.Union([Type.Null(), Type.String()])),
  active: Type.Optional(Type.Boolean()),
});
export type UpdateCategoryBody = Static<typeof UpdateCategoryBodySchema>;

export const ListCategoriesQuerySchema = Type.Object({
  active: Type.Optional(Type.Boolean()),
});
export type ListCategoriesQuery = Static<typeof ListCategoriesQuerySchema>;

export const ListCategoriesResponseSchema = Type.Object({
  items: Type.Array(CategoryViewSchema),
});
