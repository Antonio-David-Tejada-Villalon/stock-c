import type { FastifyInstance } from "fastify";
import { Type, type Static } from "@sinclair/typebox";
import { PERMISSIONS } from "@stock-c/shared-types";
import { Brand, type BrandDocument } from "../../db/models/brand.model.js";
import { createSimpleCatalogService } from "./simpleCatalog.service.js";
import { registerSimpleCatalogRoutes } from "./simpleCatalog.routes.js";

function toView(doc: BrandDocument) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    active: doc.active,
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

const CreateBrandBodySchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 200 }),
});
export type CreateBrandBody = Static<typeof CreateBrandBodySchema>;

const UpdateBrandBodySchema = Type.Object({
  version: Type.Number(),
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  active: Type.Optional(Type.Boolean()),
});
export type UpdateBrandBody = Static<typeof UpdateBrandBodySchema>;

const ListBrandsQuerySchema = Type.Object({
  active: Type.Optional(Type.Boolean()),
});

export async function brandRoutes(app: FastifyInstance) {
  const service = createSimpleCatalogService<BrandDocument, ReturnType<typeof toView>, CreateBrandBody, UpdateBrandBody>(
    Brand,
    toView,
  );

  registerSimpleCatalogRoutes(app, {
    path: "/brands",
    resourceLabel: "marca",
    service,
    permissions: {
      create: PERMISSIONS.BRAND_CREATE,
      update: PERMISSIONS.BRAND_UPDATE,
      delete: PERMISSIONS.BRAND_DELETE,
    },
    createBodySchema: CreateBrandBodySchema,
    updateBodySchema: UpdateBrandBodySchema,
    listQuerySchema: ListBrandsQuerySchema,
  });
}
