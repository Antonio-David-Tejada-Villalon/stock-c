import type { FastifyInstance } from "fastify";
import { PERMISSIONS } from "@stock-c/shared-types";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { createProductService, ProductError } from "./product.service.js";
import {
  CreateProductBodySchema,
  ListProductsQuerySchema,
  UpdateProductBodySchema,
  type CreateProductBody,
  type ListProductsQuery,
  type UpdateProductBody,
} from "./product.schemas.js";

function errorToResponse(err: unknown): { status: number; body: { error: string; message: string } } {
  if (err instanceof ProductError) {
    if (err.code === "not_found") {
      return { status: 404, body: { error: "not_found", message: "Producto no encontrado" } };
    }
    if (err.code === "duplicate_sku") {
      return {
        status: 409,
        body: { error: "duplicate_sku", message: "Ya existe un producto con ese SKU" },
      };
    }
    return {
      status: 409,
      body: {
        error: "version_conflict",
        message: "El producto cambió desde que lo cargaste — recargá y volvé a intentar",
      },
    };
  }
  throw err;
}

export async function productRoutes(app: FastifyInstance) {
  const service = createProductService();

  app.get<{ Querystring: ListProductsQuery }>(
    "/products",
    { preHandler: authenticate, schema: { querystring: ListProductsQuerySchema } },
    async (request) => service.list(request.user.companyId, request.query),
  );

  app.get<{ Params: { id: string } }>(
    "/products/:id",
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

  app.post<{ Body: CreateProductBody }>(
    "/products",
    {
      preHandler: [authenticate, authorize(PERMISSIONS.PRODUCT_CREATE)],
      schema: { body: CreateProductBodySchema },
    },
    async (request, reply) => {
      try {
        const product = await service.create(
          request.user.companyId,
          request.user.sub,
          request.body,
        );
        return reply.code(201).send(product);
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateProductBody }>(
    "/products/:id",
    {
      preHandler: [authenticate, authorize(PERMISSIONS.PRODUCT_UPDATE)],
      schema: { body: UpdateProductBodySchema },
    },
    async (request, reply) => {
      try {
        return await service.update(
          request.user.companyId,
          request.user.sub,
          request.params.id,
          request.body,
        );
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/products/:id",
    { preHandler: [authenticate, authorize(PERMISSIONS.PRODUCT_DELETE)] },
    async (request, reply) => {
      try {
        await service.deactivate(request.user.companyId, request.user.sub, request.params.id);
        return reply.code(204).send();
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );
}
