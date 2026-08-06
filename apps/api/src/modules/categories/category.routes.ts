import type { FastifyInstance } from "fastify";
import { PERMISSIONS } from "@stock-c/shared-types";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { createCategoryService, CategoryError } from "./category.service.js";
import {
  CreateCategoryBodySchema,
  ListCategoriesQuerySchema,
  MoveCategoryBodySchema,
  UpdateCategoryBodySchema,
  type CreateCategoryBody,
  type ListCategoriesQuery,
  type MoveCategoryBody,
  type UpdateCategoryBody,
} from "./category.schemas.js";

function errorToResponse(err: unknown): { status: number; body: { error: string; message: string } } {
  if (err instanceof CategoryError) {
    if (err.code === "not_found") {
      return { status: 404, body: { error: "not_found", message: "Categoría no encontrada" } };
    }
    if (err.code === "invalid_parent") {
      return { status: 400, body: { error: "invalid_parent", message: "La categoría padre no existe" } };
    }
    if (err.code === "cycle") {
      return {
        status: 400,
        body: { error: "cycle", message: "Una categoría no puede ser su propio ancestro" },
      };
    }
    if (err.code === "duplicate_code") {
      return { status: 409, body: { error: "duplicate_code", message: "Ya existe una categoría con ese código" } };
    }
    if (err.code === "already_at_edge") {
      return {
        status: 400,
        body: { error: "already_at_edge", message: "Esta categoría ya está en un extremo del orden" },
      };
    }
    return {
      status: 409,
      body: {
        error: "version_conflict",
        message: "La categoría cambió desde que la cargaste — recargá y volvé a intentar",
      },
    };
  }
  throw err;
}

export async function categoryRoutes(app: FastifyInstance) {
  const service = createCategoryService();

  app.get<{ Querystring: ListCategoriesQuery }>(
    "/categories",
    { preHandler: authenticate, schema: { querystring: ListCategoriesQuerySchema } },
    async (request) => ({ items: await service.list(request.user.companyId, request.query.active) }),
  );

  app.get<{ Params: { id: string } }>(
    "/categories/:id",
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        return await service.get(request.user.companyId, request.params.id);
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );

  app.post<{ Body: CreateCategoryBody }>(
    "/categories",
    {
      preHandler: [authenticate, authorize(PERMISSIONS.CATEGORY_CREATE)],
      schema: { body: CreateCategoryBodySchema },
    },
    async (request, reply) => {
      try {
        const category = await service.create(request.user.companyId, request.body);
        return reply.code(201).send(category);
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateCategoryBody }>(
    "/categories/:id",
    {
      preHandler: [authenticate, authorize(PERMISSIONS.CATEGORY_UPDATE)],
      schema: { body: UpdateCategoryBodySchema },
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

  app.delete<{ Params: { id: string } }>(
    "/categories/:id",
    { preHandler: [authenticate, authorize(PERMISSIONS.CATEGORY_DELETE)] },
    async (request, reply) => {
      try {
        await service.deactivate(request.user.companyId, request.params.id);
        return reply.code(204).send();
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );

  app.post<{ Params: { id: string }; Body: MoveCategoryBody }>(
    "/categories/:id/move",
    {
      preHandler: [authenticate, authorize(PERMISSIONS.CATEGORY_UPDATE)],
      schema: { body: MoveCategoryBodySchema },
    },
    async (request, reply) => {
      try {
        await service.move(request.user.companyId, request.params.id, request.body.direction);
        return reply.code(204).send();
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );
}
