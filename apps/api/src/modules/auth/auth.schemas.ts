import { Type, type Static } from "@sinclair/typebox";

export const LoginBodySchema = Type.Object({
  email: Type.String({ format: "email" }),
  password: Type.String({ minLength: 1 }),
});
export type LoginBody = Static<typeof LoginBodySchema>;

export const AuthUserSchema = Type.Object({
  id: Type.String(),
  email: Type.String(),
  name: Type.String(),
  avatarUrl: Type.Optional(Type.String()),
  companyId: Type.String(),
  role: Type.Object({
    id: Type.String(),
    name: Type.String(),
    permissions: Type.Array(Type.String()),
  }),
  branchRestrictions: Type.Array(Type.String()),
});

export const LoginResponseSchema = Type.Object({
  accessToken: Type.String(),
  user: AuthUserSchema,
});

export const RefreshResponseSchema = Type.Object({
  accessToken: Type.String(),
});

export const MeResponseSchema = Type.Object({
  user: AuthUserSchema,
});

export const UpdateOwnProfileBodySchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  avatarUrl: Type.Optional(Type.Union([Type.Null(), Type.String({ maxLength: 2000 })])),
});
export type UpdateOwnProfileBody = Static<typeof UpdateOwnProfileBodySchema>;

export const ChangePasswordBodySchema = Type.Object({
  currentPassword: Type.String({ minLength: 1 }),
  newPassword: Type.String({ minLength: 8, maxLength: 200 }),
});
export type ChangePasswordBody = Static<typeof ChangePasswordBodySchema>;
