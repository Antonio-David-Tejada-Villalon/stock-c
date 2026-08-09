import type { FastifyInstance } from "fastify";
import { PERMISSIONS } from "@stock-c/shared-types";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { createBranchService, BranchError } from "./branch.service.js";
import {
  CreateBranchBodySchema,
  UpdateBranchBodySchema,
  type CreateBranchBody,
  type UpdateBranchBody,
} from "./branch.schemas.js";

function errorToResponse(err: unknown): { status: number; body: { error: string; message: string } } {
  if (err instanceof BranchError) {
    if (err.code === "not_found") {
      return { status: 404, body: { error: "not_found", message: "Sucursal no encontrada" } };
    }
    if (err.code === "duplicate_code") {
      return { status: 409, body: { error: "duplicate_code", message: "Ya existe una sucursal con ese código" } };
    }
    if (err.code === "cannot_delete_active") {
      return {
        status: 400,
        body: {
          error: "cannot_delete_active",
          message: "No podés eliminar la sucursal activa — activá otra primero",
        },
      };
    }
    return {
      status: 409,
      body: { error: "version_conflict", message: "La sucursal cambió desde que la cargaste — recargá y volvé a intentar" },
    };
  }
  throw err;
}

export async function branchRoutes(app: FastifyInstance) {
  const service = createBranchService();

  app.get("/branches", { preHandler: authenticate }, async (request) => ({
    items: await service.list(request.user.companyId),
  }));

  app.post<{ Body: CreateBranchBody }>(
    "/branches",
    {
      preHandler: [authenticate, authorize(PERMISSIONS.BRANCH_MANAGE)],
      schema: { body: CreateBranchBodySchema },
    },
    async (request, reply) => {
      try {
        const branch = await service.create(request.user.companyId, request.body);
        return reply.code(201).send(branch);
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateBranchBody }>(
    "/branches/:id",
    {
      preHandler: [authenticate, authorize(PERMISSIONS.BRANCH_MANAGE)],
      schema: { body: UpdateBranchBodySchema },
    },
    async (request, reply) => {
      try {
        return await service.update(request.user.companyId, request.params.id, request.body);
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/branches/:id/activate",
    { preHandler: [authenticate, authorize(PERMISSIONS.BRANCH_MANAGE)] },
    async (request, reply) => {
      try {
        await service.activate(request.user.companyId, request.params.id);
        return reply.code(204).send();
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/branches/:id",
    { preHandler: [authenticate, authorize(PERMISSIONS.BRANCH_MANAGE)] },
    async (request, reply) => {
      try {
        await service.delete(request.user.companyId, request.params.id);
        return reply.code(204).send();
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );
}
