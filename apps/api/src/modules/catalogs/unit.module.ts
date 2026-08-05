import type { FastifyInstance } from "fastify";
import { Type, type Static } from "@sinclair/typebox";
import { PERMISSIONS } from "@stock-c/shared-types";
import { Unit, type UnitDocument } from "../../db/models/unit.model.js";
import { createSimpleCatalogService } from "./simpleCatalog.service.js";
import { registerSimpleCatalogRoutes } from "./simpleCatalog.routes.js";

function toView(doc: UnitDocument) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    abbreviation: doc.abbreviation,
    active: doc.active,
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

const CreateUnitBodySchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 200 }),
  abbreviation: Type.Optional(Type.String({ maxLength: 20 })),
});
export type CreateUnitBody = Static<typeof CreateUnitBodySchema>;

const UpdateUnitBodySchema = Type.Object({
  version: Type.Number(),
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  abbreviation: Type.Optional(Type.String({ maxLength: 20 })),
  active: Type.Optional(Type.Boolean()),
});
export type UpdateUnitBody = Static<typeof UpdateUnitBodySchema>;

const ListUnitsQuerySchema = Type.Object({
  active: Type.Optional(Type.Boolean()),
});

export async function unitRoutes(app: FastifyInstance) {
  const service = createSimpleCatalogService<UnitDocument, ReturnType<typeof toView>, CreateUnitBody, UpdateUnitBody>(
    Unit,
    toView,
  );

  registerSimpleCatalogRoutes(app, {
    path: "/units",
    resourceLabel: "unidad",
    service,
    permissions: {
      create: PERMISSIONS.UNIT_CREATE,
      update: PERMISSIONS.UNIT_UPDATE,
      delete: PERMISSIONS.UNIT_DELETE,
    },
    createBodySchema: CreateUnitBodySchema,
    updateBodySchema: UpdateUnitBodySchema,
    listQuerySchema: ListUnitsQuerySchema,
  });
}
