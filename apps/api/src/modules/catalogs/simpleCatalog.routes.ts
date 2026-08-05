import type { FastifyInstance } from "fastify";
import type { TSchema } from "@sinclair/typebox";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { CatalogError, type SimpleCatalogService } from "./simpleCatalog.service.js";

interface CatalogQuery {
  active?: boolean;
}

interface RegisterOpts<TCreate, TUpdate> {
  /** ej. "/brands" */
  path: string;
  /** ej. "marca" — usado en los mensajes de error */
  resourceLabel: string;
  service: SimpleCatalogService<TCreate, TUpdate, unknown>;
  permissions: { create: string; update: string; delete: string };
  createBodySchema: TSchema;
  updateBodySchema: TSchema;
  listQuerySchema: TSchema;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Registra el CRUD estándar (list/get/create/update/deactivate) de un
 * catálogo simple — misma forma de rutas que products.routes.ts (Fase 7),
 * factorizada porque Brand y Unit la necesitan idéntica. */
export function registerSimpleCatalogRoutes<TCreate, TUpdate>(
  app: FastifyInstance,
  opts: RegisterOpts<TCreate, TUpdate>,
) {
  function errorToResponse(err: unknown): { status: number; body: { error: string; message: string } } {
    if (err instanceof CatalogError) {
      if (err.code === "not_found") {
        return {
          status: 404,
          body: { error: "not_found", message: `${capitalize(opts.resourceLabel)} no encontrada` },
        };
      }
      if (err.code === "duplicate_name") {
        return {
          status: 409,
          body: { error: "duplicate_name", message: `Ya existe una ${opts.resourceLabel} con ese nombre` },
        };
      }
      return {
        status: 409,
        body: {
          error: "version_conflict",
          message: `La ${opts.resourceLabel} cambió desde que la cargaste — recargá y volvé a intentar`,
        },
      };
    }
    throw err;
  }

  app.get<{ Querystring: CatalogQuery }>(
    opts.path,
    { preHandler: authenticate, schema: { querystring: opts.listQuerySchema } },
    async (request) => ({ items: await opts.service.list(request.user.companyId, request.query.active) }),
  );

  app.get<{ Params: { id: string } }>(
    `${opts.path}/:id`,
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        return await opts.service.get(request.user.companyId, request.params.id);
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );

  app.post<{ Body: TCreate }>(
    opts.path,
    {
      preHandler: [authenticate, authorize(opts.permissions.create)],
      schema: { body: opts.createBodySchema },
    },
    async (request, reply) => {
      try {
        const doc = await opts.service.create(request.user.companyId, request.body as TCreate);
        return reply.code(201).send(doc);
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );

  app.patch<{ Params: { id: string }; Body: TUpdate & { version: number } }>(
    `${opts.path}/:id`,
    {
      preHandler: [authenticate, authorize(opts.permissions.update)],
      schema: { body: opts.updateBodySchema },
    },
    async (request, reply) => {
      try {
        return await opts.service.update(
          request.user.companyId,
          request.params.id,
          request.body as TUpdate & { version: number },
        );
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    `${opts.path}/:id`,
    { preHandler: [authenticate, authorize(opts.permissions.delete)] },
    async (request, reply) => {
      try {
        await opts.service.deactivate(request.user.companyId, request.params.id);
        return reply.code(204).send();
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );
}
