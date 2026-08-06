import { Type, type Static } from "@sinclair/typebox";

const HEX_COLOR_PATTERN = "^#[0-9a-fA-F]{6}$";

export const CategoryViewSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  parentId: Type.Optional(Type.String()),
  code: Type.Optional(Type.String()),
  icon: Type.Optional(Type.String()),
  color: Type.Optional(Type.String()),
  imageUrl: Type.Optional(Type.String()),
  order: Type.Number(),
  active: Type.Boolean(),
  version: Type.Number(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const CreateCategoryBodySchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 200 }),
  parentId: Type.Optional(Type.String()),
  code: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
  icon: Type.Optional(Type.String({ maxLength: 100 })),
  color: Type.Optional(Type.String({ pattern: HEX_COLOR_PATTERN })),
  imageUrl: Type.Optional(Type.String({ maxLength: 2000 })),
});
export type CreateCategoryBody = Static<typeof CreateCategoryBodySchema>;

// null = quitar el valor (código/ícono/color/imagen/padre); ausente = no
// tocar. Null primero en cada Union: con coerceTypes de AJV, si "string"
// fuera la primera rama, un null entrante se coacciona a "" antes de
// intentar la rama "null" — ver el comentario equivalente ya existente
// para parentId.
export const UpdateCategoryBodySchema = Type.Object({
  version: Type.Number(),
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  parentId: Type.Optional(Type.Union([Type.Null(), Type.String()])),
  code: Type.Optional(Type.Union([Type.Null(), Type.String({ minLength: 1, maxLength: 64 })])),
  icon: Type.Optional(Type.Union([Type.Null(), Type.String({ maxLength: 100 })])),
  color: Type.Optional(Type.Union([Type.Null(), Type.String({ pattern: HEX_COLOR_PATTERN })])),
  imageUrl: Type.Optional(Type.Union([Type.Null(), Type.String({ maxLength: 2000 })])),
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

export const MoveCategoryBodySchema = Type.Object({
  direction: Type.Union([Type.Literal("up"), Type.Literal("down")]),
});
export type MoveCategoryBody = Static<typeof MoveCategoryBodySchema>;
