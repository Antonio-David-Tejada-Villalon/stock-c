import type { FastifyInstance } from "fastify";
import { PERMISSIONS } from "@stock-c/shared-types";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { createInventoryService, InventoryError } from "./stockMovement.service.js";
import {
  CreateMovementBodySchema,
  ListMovementsQuerySchema,
  ListStockLevelsQuerySchema,
  type CreateMovementBody,
  type ListMovementsQuery,
  type ListStockLevelsQuery,
} from "./stockMovement.schemas.js";

function errorToResponse(err: unknown): { status: number; body: { error: string; message: string; detail?: unknown } } {
  if (err instanceof InventoryError) {
    if (err.code === "not_found") {
      return { status: 404, body: { error: "not_found", message: "Producto no encontrado" } };
    }
    if (err.code === "no_active_branch") {
      return {
        status: 500,
        body: {
          error: "no_active_branch",
          message: "La empresa no tiene exactamente una sucursal activa — no se puede determinar dónde aplicar el movimiento",
        },
      };
    }
    if (err.code === "invalid_quantity") {
      return { status: 400, body: { error: "invalid_quantity", message: "Cantidad inválida para este tipo de movimiento" } };
    }
    if (err.code === "reason_required") {
      return { status: 400, body: { error: "reason_required", message: "Un ajuste necesita un motivo" } };
    }
    if (err.code === "possible_duplicate") {
      const d = err.detail!;
      return {
        status: 409,
        body: {
          error: "possible_duplicate",
          message: `${d.byUserName} registró ${d.quantity} del mismo producto y tipo hace instantes — podría ser el mismo movimiento.`,
          detail: d,
        },
      };
    }
    return {
      status: 400,
      body: {
        error: "insufficient_stock",
        message: "La operación dejaría el stock en negativo",
      },
    };
  }
  throw err;
}

export async function inventoryRoutes(app: FastifyInstance) {
  const service = createInventoryService();

  app.post<{ Body: CreateMovementBody }>(
    "/stock-movements",
    {
      preHandler: [authenticate, authorize(PERMISSIONS.INVENTORY_MOVEMENT_CREATE)],
      schema: { body: CreateMovementBodySchema },
    },
    async (request, reply) => {
      try {
        const { replayed, ...result } = await service.createMovement(
          request.user.companyId,
          request.user.sub,
          request.body,
        );
        return reply.code(replayed ? 200 : 201).send(result);
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );

  app.get<{ Querystring: ListMovementsQuery }>(
    "/stock-movements",
    { preHandler: authenticate, schema: { querystring: ListMovementsQuerySchema } },
    async (request, reply) => {
      try {
        return await service.listMovements(request.user.companyId, request.query);
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );

  app.get<{ Querystring: ListStockLevelsQuery }>(
    "/stock-levels",
    { preHandler: authenticate, schema: { querystring: ListStockLevelsQuerySchema } },
    async (request, reply) => {
      const productIds = request.query.productIds
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 100);
      try {
        const items = await service.getStockLevels(request.user.companyId, productIds);
        return { items };
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );
}
