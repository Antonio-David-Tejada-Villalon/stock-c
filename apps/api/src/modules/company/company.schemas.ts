import { Type, type Static } from "@sinclair/typebox";

export const CompanySettingsViewSchema = Type.Object({
  timezone: Type.String(),
  currency: Type.String(),
  accentColor: Type.Optional(Type.String()),
  logoUrl: Type.Optional(Type.String()),
  faviconUrl: Type.Optional(Type.String()),
});

export const CompanyViewSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  slug: Type.String(),
  taxId: Type.Optional(Type.String()),
  settings: CompanySettingsViewSchema,
  version: Type.Number(),
});

// Null primero (no al revés): AJV con coerceTypes convertiría un `null`
// entrante a `""` si `String` fuera la primera rama de la unión — mismo
// gotcha ya documentado para `parentId` de Categorías (Fase 8, adenda).
export const UpdateCompanyBodySchema = Type.Object({
  version: Type.Number(),
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  taxId: Type.Optional(Type.Union([Type.Null(), Type.String({ maxLength: 50 })])),
  settings: Type.Optional(
    Type.Object({
      timezone: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
      currency: Type.Optional(Type.String({ minLength: 3, maxLength: 3 })),
      accentColor: Type.Optional(Type.Union([Type.Null(), Type.String({ pattern: "^#[0-9a-fA-F]{6}$" })])),
      logoUrl: Type.Optional(Type.Union([Type.Null(), Type.String({ maxLength: 2000 })])),
      faviconUrl: Type.Optional(Type.Union([Type.Null(), Type.String({ maxLength: 2000 })])),
    }),
  ),
});
export type UpdateCompanyBody = Static<typeof UpdateCompanyBodySchema>;
