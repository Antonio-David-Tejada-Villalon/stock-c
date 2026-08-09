import { Type, type Static } from "@sinclair/typebox";

export const BranchViewSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  code: Type.String(),
  address: Type.Optional(Type.String()),
  active: Type.Boolean(),
  version: Type.Number(),
});

// Sin `active` en el body de creación: una sucursal nueva siempre nace
// inactiva — activarla es una acción explícita y separada (POST
// /branches/:id/activate) porque tiene el efecto colateral de
// desactivar la que estaba activa. Ver docs/13, sección "Justificación
// técnica".
export const CreateBranchBodySchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 200 }),
  code: Type.String({ minLength: 1, maxLength: 20 }),
  address: Type.Optional(Type.String({ maxLength: 500 })),
});
export type CreateBranchBody = Static<typeof CreateBranchBodySchema>;

export const UpdateBranchBodySchema = Type.Object({
  version: Type.Number(),
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  code: Type.Optional(Type.String({ minLength: 1, maxLength: 20 })),
  address: Type.Optional(Type.Union([Type.Null(), Type.String({ maxLength: 500 })])),
});
export type UpdateBranchBody = Static<typeof UpdateBranchBodySchema>;
