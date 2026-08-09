import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../shared/env.js";
import { createAuthService, AuthError, type AuthUserView } from "./auth.service.js";
import { REFRESH_COOKIE_NAME } from "./tokens.js";
import {
  LoginBodySchema,
  UpdateOwnProfileBodySchema,
  ChangePasswordBodySchema,
  type LoginBody,
  type UpdateOwnProfileBody,
  type ChangePasswordBody,
} from "./auth.schemas.js";
import { authenticate } from "../../middleware/authenticate.js";

const REFRESH_COOKIE_PATH = "/auth";

function setRefreshCookie(reply: FastifyReply, token: string, expiresAt: Date) {
  reply.setCookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    path: REFRESH_COOKIE_PATH,
    expires: expiresAt,
  });
}

function clearRefreshCookie(reply: FastifyReply) {
  reply.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}

/**
 * Mitigación CSRF para /auth/refresh y /auth/logout (los únicos endpoints
 * que dependen de la cookie de forma ambiente). Un <form> cross-site no
 * puede agregar headers custom, y un fetch cross-site que lo intente
 * dispara un preflight que nuestro CORS de origen único rechaza. Detalle
 * completo en docs/05-autenticacion.md, sección 3.
 */
function requireCsrfHeader(request: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void) {
  if (request.headers["x-requested-with"] !== "stock-c") {
    reply.code(403).send({ error: "forbidden", message: "Missing X-Requested-With header" });
    return;
  }
  done();
}

function authErrorToResponse(err: unknown): { status: number; body: { error: string; message: string } } {
  if (err instanceof AuthError) {
    if (err.code === "invalid_credentials") {
      return { status: 401, body: { error: "invalid_credentials", message: "Correo o contraseña incorrectos" } };
    }
    if (err.code === "account_disabled") {
      return { status: 403, body: { error: "account_disabled", message: "Cuenta deshabilitada" } };
    }
    if (err.code === "wrong_current_password") {
      return { status: 401, body: { error: "wrong_current_password", message: "La contraseña actual no coincide" } };
    }
    return { status: 401, body: { error: "invalid_refresh", message: "Sesión inválida o expirada" } };
  }
  throw err;
}

function toResponseUser(user: AuthUserView) {
  return user;
}

export async function authRoutes(app: FastifyInstance) {
  const authService = createAuthService(app);

  app.post<{ Body: LoginBody }>(
    "/auth/login",
    {
      schema: { body: LoginBodySchema },
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
          // El hook por defecto de @fastify/rate-limit es "onRequest", que
          // corre ANTES de parsear el body — con eso request.body siempre
          // sería undefined acá. "preHandler" corre después de parseo y
          // validación, cuando el email ya está disponible.
          hook: "preHandler",
          keyGenerator: (request) => {
            const body = request.body as Partial<LoginBody> | undefined;
            return `login:${body?.email ?? "unknown"}:${request.ip}`;
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { accessToken, refreshToken, refreshExpiresAt, user } = await authService.login(
          request.body.email,
          request.body.password,
        );
        setRefreshCookie(reply, refreshToken, refreshExpiresAt);
        return reply.send({ accessToken, user: toResponseUser(user) });
      } catch (err) {
        const { status, body } = authErrorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );

  app.post(
    "/auth/refresh",
    { preHandler: requireCsrfHeader },
    async (request, reply) => {
      const rawToken = request.cookies[REFRESH_COOKIE_NAME];
      if (!rawToken) {
        return reply.code(401).send({ error: "invalid_refresh", message: "No hay sesión activa" });
      }
      try {
        const { accessToken, refreshToken, refreshExpiresAt } = await authService.refresh(rawToken);
        setRefreshCookie(reply, refreshToken, refreshExpiresAt);
        return reply.send({ accessToken });
      } catch (err) {
        clearRefreshCookie(reply);
        const { status, body } = authErrorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );

  app.post(
    "/auth/logout",
    { preHandler: requireCsrfHeader },
    async (request, reply) => {
      const rawToken = request.cookies[REFRESH_COOKIE_NAME];
      if (rawToken) {
        await authService.logout(rawToken);
      }
      clearRefreshCookie(reply);
      return reply.code(204).send();
    },
  );

  app.get(
    "/auth/me",
    { preHandler: authenticate },
    async (request, reply) => {
      const user = await authService.me(request.user.sub);
      if (!user) {
        return reply.code(401).send({ error: "unauthorized", message: "Usuario no encontrado" });
      }
      return reply.send({ user: toResponseUser(user) });
    },
  );

  app.patch<{ Body: UpdateOwnProfileBody }>(
    "/auth/me",
    { preHandler: authenticate, schema: { body: UpdateOwnProfileBodySchema } },
    async (request, reply) => {
      const user = await authService.updateProfile(request.user.sub, request.body);
      if (!user) {
        return reply.code(401).send({ error: "unauthorized", message: "Usuario no encontrado" });
      }
      return reply.send({ user: toResponseUser(user) });
    },
  );

  app.post<{ Body: ChangePasswordBody }>(
    "/auth/change-password",
    { preHandler: authenticate, schema: { body: ChangePasswordBodySchema } },
    async (request, reply) => {
      try {
        await authService.changePassword(request.user.sub, request.body.currentPassword, request.body.newPassword);
        return reply.code(204).send();
      } catch (err) {
        const { status, body } = authErrorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );
}
