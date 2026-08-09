import type { FastifyInstance } from "fastify";
import { PERMISSIONS } from "@stock-c/shared-types";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { createUserService, UserError } from "./user.service.js";
import {
  CreateTeamUserBodySchema,
  UpdateTeamUserBodySchema,
  type CreateTeamUserBody,
  type UpdateTeamUserBody,
} from "./user.schemas.js";

function errorToResponse(err: unknown): { status: number; body: { error: string; message: string } } {
  if (err instanceof UserError) {
    if (err.code === "not_found") return { status: 404, body: { error: "not_found", message: "Usuario no encontrado" } };
    if (err.code === "duplicate_email") {
      return { status: 409, body: { error: "duplicate_email", message: "Ya existe un usuario con ese email" } };
    }
    if (err.code === "invalid_role") {
      return { status: 400, body: { error: "invalid_role", message: "Rol inválido" } };
    }
    if (err.code === "cannot_deactivate_self") {
      return {
        status: 400,
        body: { error: "cannot_deactivate_self", message: "No podés desactivar tu propio usuario — usá cerrar sesión" },
      };
    }
    if (err.code === "cannot_delete_self") {
      return {
        status: 400,
        body: { error: "cannot_delete_self", message: "No podés eliminar tu propio usuario — usá cerrar sesión" },
      };
    }
    if (err.code === "last_admin") {
      return {
        status: 400,
        body: {
          error: "last_admin",
          message: "Es el único usuario Admin activo — la empresa quedaría sin administrador",
        },
      };
    }
    return {
      status: 409,
      body: { error: "version_conflict", message: "El usuario cambió desde que lo cargaste — recargá y volvé a intentar" },
    };
  }
  throw err;
}

export async function userRoutes(app: FastifyInstance) {
  const service = createUserService();

  app.get(
    "/users",
    { preHandler: [authenticate, authorize(PERMISSIONS.USER_MANAGE)] },
    async (request) => ({ items: await service.list(request.user.companyId) }),
  );

  app.post<{ Body: CreateTeamUserBody }>(
    "/users",
    {
      preHandler: [authenticate, authorize(PERMISSIONS.USER_MANAGE)],
      schema: { body: CreateTeamUserBodySchema },
    },
    async (request, reply) => {
      try {
        const user = await service.create(request.user.companyId, request.body);
        return reply.code(201).send(user);
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateTeamUserBody }>(
    "/users/:id",
    {
      preHandler: [authenticate, authorize(PERMISSIONS.USER_MANAGE)],
      schema: { body: UpdateTeamUserBodySchema },
    },
    async (request, reply) => {
      try {
        return await service.update(request.user.companyId, request.user.sub, request.params.id, request.body);
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/users/:id",
    { preHandler: [authenticate, authorize(PERMISSIONS.USER_MANAGE)] },
    async (request, reply) => {
      try {
        await service.delete(request.user.companyId, request.user.sub, request.params.id);
        return reply.code(204).send();
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );
}
