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
  parentId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
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
