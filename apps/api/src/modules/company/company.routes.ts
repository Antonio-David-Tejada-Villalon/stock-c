import type { FastifyInstance } from "fastify";
import { PERMISSIONS } from "@stock-c/shared-types";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { createCompanyService, CompanyError } from "./company.service.js";
import { UpdateCompanyBodySchema, type UpdateCompanyBody } from "./company.schemas.js";

function errorToResponse(err: unknown): { status: number; body: { error: string; message: string } } {
  if (err instanceof CompanyError) {
    if (err.code === "not_found") {
      return { status: 404, body: { error: "not_found", message: "Empresa no encontrada" } };
    }
    if (err.code === "invalid_contrast") {
      return {
        status: 400,
        body: {
          error: "invalid_contrast",
          message: `Ese color no tiene suficiente contraste para texto (mejor ratio: ${err.detail}:1, se necesita al menos 4.5:1)`,
        },
      };
    }
    return {
      status: 409,
      body: { error: "version_conflict", message: "La empresa cambió desde que la cargaste — recargá y volvé a intentar" },
    };
  }
  throw err;
}

export async function companyRoutes(app: FastifyInstance) {
  const service = createCompanyService();

  app.get("/company", { preHandler: authenticate }, async (request, reply) => {
    try {
      return await service.get(request.user.companyId);
    } catch (err) {
      const { status, body } = errorToResponse(err);
      return reply.code(status).send(body);
    }
  });

  app.patch<{ Body: UpdateCompanyBody }>(
    "/company",
    {
      preHandler: [authenticate, authorize(PERMISSIONS.COMPANY_UPDATE)],
      schema: { body: UpdateCompanyBodySchema },
    },
    async (request, reply) => {
      try {
        return await service.update(request.user.companyId, request.body);
      } catch (err) {
        const { status, body } = errorToResponse(err);
        return reply.code(status).send(body);
      }
    },
  );
}
