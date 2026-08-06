import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate.js";
import { NoActiveBranchError } from "../../db/helpers/resolveActiveBranch.js";
import { createReportService, ReportError } from "./report.service.js";
import { MovementsReportQuerySchema, type MovementsReportQuery } from "./report.schemas.js";

function errorToResponse(err: unknown): { status: number; body: { error: string; message: string } } {
  if (err instanceof NoActiveBranchError) {
    return {
      status: 500,
      body: {
        error: "no_active_branch",
        message: "La empresa no tiene exactamente una sucursal activa — no se puede generar el reporte",
      },
    };
  }
  if (err instanceof ReportError) {
    return { status: 400, body: { error: "invalid_date_range", message: "El rango de fechas no es válido" } };
  }
  throw err;
}

export async function reportRoutes(app: FastifyInstance) {
  const service = createReportService();

  app.get("/reports/inventory-valuation", { preHandler: authenticate }, async (request, reply) => {
    try {
      return await service.inventoryValuation(request.user.companyId);
    } catch (err) {
      const { status, body } = errorToResponse(err);
      return reply.code(status).send(body);
    }
  });

  app.get<{ Querystring: MovementsReportQuery }>(
    "/reports/movements",
    { preHandler: authenticate, schema: { querystring: MovementsReportQuerySchema } },
    async (request, reply) => {
      try {
        return await service.movementsReport(request.user.companyId, request.query);
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );

  app.get("/reports/catalog-summary", { preHandler: authenticate }, async (request, reply) => {
    try {
      return await service.catalogSummary(request.user.companyId);
    } catch (err) {
      const { status, body } = errorToResponse(err);
      return reply.code(status).send(body);
    }
  });

  app.get("/reports/low-stock", { preHandler: authenticate }, async (request, reply) => {
    try {
      return await service.lowStock(request.user.companyId);
    } catch (err) {
      const { status, body } = errorToResponse(err);
      return reply.code(status).send(body);
    }
  });
}
