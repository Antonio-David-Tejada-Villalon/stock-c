import { Type, type Static } from "@sinclair/typebox";

const MovementTypeSchema = Type.Union([
  Type.Literal("entrada"),
  Type.Literal("salida"),
  Type.Literal("ajuste"),
]);

const GroupSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  totalQuantity: Type.String(),
  totalValue: Type.String(),
});

export const InventoryValuationResponseSchema = Type.Object({
  items: Type.Array(
    Type.Object({
      productId: Type.String(),
      sku: Type.String(),
      name: Type.String(),
      categoryId: Type.Optional(Type.String()),
      brandId: Type.Optional(Type.String()),
      quantity: Type.String(),
      cost: Type.String(),
      value: Type.String(),
    }),
  ),
  byCategory: Type.Array(GroupSchema),
  byBrand: Type.Array(GroupSchema),
  grandTotal: Type.String(),
  excludedCount: Type.Number(),
});

export const MovementsReportQuerySchema = Type.Object({
  dateFrom: Type.String(),
  dateTo: Type.String(),
  type: Type.Optional(MovementTypeSchema),
  categoryId: Type.Optional(Type.String()),
});
export type MovementsReportQuery = Static<typeof MovementsReportQuerySchema>;

export const MovementsReportResponseSchema = Type.Object({
  items: Type.Array(
    Type.Object({
      id: Type.String(),
      productId: Type.String(),
      sku: Type.String(),
      productName: Type.String(),
      categoryId: Type.Optional(Type.String()),
      type: MovementTypeSchema,
      quantity: Type.String(),
      reason: Type.Optional(Type.String()),
      reference: Type.Optional(Type.String()),
      createdByName: Type.String(),
      createdAt: Type.String(),
    }),
  ),
  totalsByType: Type.Object({
    entrada: Type.String(),
    salida: Type.String(),
    ajuste: Type.String(),
  }),
  truncated: Type.Boolean(),
});

const CatalogSummaryGroupSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  activeCount: Type.Number(),
  totalStock: Type.String(),
});

export const CatalogSummaryResponseSchema = Type.Object({
  byCategory: Type.Array(CatalogSummaryGroupSchema),
  byBrand: Type.Array(CatalogSummaryGroupSchema),
  totalActiveProducts: Type.Number(),
  totalInactiveProducts: Type.Number(),
});

export const LowStockResponseSchema = Type.Object({
  items: Type.Array(
    Type.Object({
      productId: Type.String(),
      sku: Type.String(),
      name: Type.String(),
      categoryId: Type.Optional(Type.String()),
      quantity: Type.String(),
      minStock: Type.String(),
      deficit: Type.String(),
    }),
  ),
});
