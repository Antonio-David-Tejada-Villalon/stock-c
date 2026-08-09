import { Type, type Static } from "@sinclair/typebox";
import { SYSTEM_ROLES } from "../../db/models/role.model.js";

// Solo los 4 roles de sistema ya existentes — esta fase no construye un
// editor de roles/permisos custom (ver docs/13, "Justificación técnica").
const RoleNameSchema = Type.Union(Object.values(SYSTEM_ROLES).map((name) => Type.Literal(name)));

export const TeamUserViewSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  email: Type.String(),
  roleName: Type.String(),
  active: Type.Boolean(),
  version: Type.Number(),
});

export const CreateTeamUserBodySchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 200 }),
  email: Type.String({ format: "email" }),
  password: Type.String({ minLength: 8, maxLength: 200 }),
  roleName: RoleNameSchema,
});
export type CreateTeamUserBody = Static<typeof CreateTeamUserBodySchema>;

export const UpdateTeamUserBodySchema = Type.Object({
  version: Type.Number(),
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  email: Type.Optional(Type.String({ format: "email" })),
  roleName: Type.Optional(RoleNameSchema),
  active: Type.Optional(Type.Boolean()),
  password: Type.Optional(Type.String({ minLength: 8, maxLength: 200 })),
});
export type UpdateTeamUserBody = Static<typeof UpdateTeamUserBodySchema>;
