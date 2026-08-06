import { Product } from "../../db/models/product.model.js";
import { Category } from "../../db/models/category.model.js";
import { Brand } from "../../db/models/brand.model.js";
import { StockLevel } from "../../db/models/stockLevel.model.js";
import { StockMovement } from "../../db/models/stockMovement.model.js";
import { User } from "../../db/models/user.model.js";
import { resolveActiveBranch } from "../../db/helpers/resolveActiveBranch.js";
import { addDecimal, compareDecimal, multiplyDecimal, subDecimal, ZERO_DECIMAL } from "../../lib/decimal.js";
import type { MovementsReportQuery } from "./report.schemas.js";

export class ReportError extends Error {
  constructor(public code: "invalid_date_range") {
    super(code);
  }
}

const MOVEMENTS_HARD_CAP = 5000;
const NONE_GROUP_ID = "none";

interface Group {
  id: string;
  name: string;
  totalQuantity: string;
  totalValue: string;
}

function accumulateGroup(groups: Map<string, Group>, id: string, name: string, quantity: string, value: string) {
  const existing = groups.get(id);
  if (existing) {
    existing.totalQuantity = addDecimal(existing.totalQuantity, quantity);
    existing.totalValue = addDecimal(existing.totalValue, value);
  } else {
    groups.set(id, { id, name, totalQuantity: quantity, totalValue: value });
  }
}

function sortByValueDesc(groups: Map<string, Group>): Group[] {
  return [...groups.values()].sort((a, b) => compareDecimal(b.totalValue, a.totalValue));
}

export function createReportService() {
  return {
    async inventoryValuation(companyId: string) {
      const branch = await resolveActiveBranch(companyId);
      const [products, levels, categories, brands] = await Promise.all([
        Product.find({ companyId, active: true }),
        StockLevel.find({ companyId, branchId: branch._id }),
        Category.find({ companyId }),
        Brand.find({ companyId }),
      ]);

      const quantityByProduct = new Map(levels.map((l) => [l.productId.toString(), l.quantity.toString()]));
      const categoryNameById = new Map(categories.map((c) => [c._id.toString(), c.name]));
      const brandNameById = new Map(brands.map((b) => [b._id.toString(), b.name]));

      const items: {
        productId: string;
        sku: string;
        name: string;
        categoryId?: string;
        brandId?: string;
        quantity: string;
        cost: string;
        value: string;
      }[] = [];
      const byCategory = new Map<string, Group>();
      const byBrand = new Map<string, Group>();
      let grandTotal = ZERO_DECIMAL;
      let excludedCount = 0;

      for (const product of products) {
        if (!product.cost) {
          excludedCount += 1;
          continue;
        }
        const productId = product._id.toString();
        const quantity = quantityByProduct.get(productId) ?? "0";
        const cost = product.cost.toString();
        const value = multiplyDecimal(quantity, cost);

        items.push({
          productId,
          sku: product.sku,
          name: product.name,
          categoryId: product.categoryId?.toString(),
          brandId: product.brandId?.toString(),
          quantity,
          cost,
          value,
        });

        const categoryId = product.categoryId?.toString() ?? NONE_GROUP_ID;
        accumulateGroup(byCategory, categoryId, categoryNameById.get(categoryId) ?? "Sin categoría", quantity, value);
        const brandId = product.brandId?.toString() ?? NONE_GROUP_ID;
        accumulateGroup(byBrand, brandId, brandNameById.get(brandId) ?? "Sin marca", quantity, value);

        grandTotal = addDecimal(grandTotal, value);
      }

      items.sort((a, b) => compareDecimal(b.value, a.value));

      return {
        items,
        byCategory: sortByValueDesc(byCategory),
        byBrand: sortByValueDesc(byBrand),
        grandTotal,
        excludedCount,
      };
    },

    async movementsReport(companyId: string, query: MovementsReportQuery) {
      const branch = await resolveActiveBranch(companyId);

      const dateFrom = new Date(query.dateFrom);
      const dateTo = new Date(query.dateTo);
      dateTo.setHours(23, 59, 59, 999);
      if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime()) || dateFrom > dateTo) {
        throw new ReportError("invalid_date_range");
      }

      const filter: Record<string, unknown> = {
        companyId,
        branchId: branch._id,
        createdAt: { $gte: dateFrom, $lte: dateTo },
      };
      if (query.type) filter.type = query.type;

      if (query.categoryId) {
        const productsInCategory = await Product.find({ companyId, categoryId: query.categoryId }, { _id: 1 });
        filter.productId = { $in: productsInCategory.map((p) => p._id) };
      }

      const docs = await StockMovement.find(filter)
        .sort({ createdAt: -1 })
        .limit(MOVEMENTS_HARD_CAP + 1);
      const truncated = docs.length > MOVEMENTS_HARD_CAP;
      const page = truncated ? docs.slice(0, MOVEMENTS_HARD_CAP) : docs;

      const productIds = [...new Set(page.map((d) => d.productId.toString()))];
      const userIds = [...new Set(page.map((d) => d.createdBy.toString()))];
      const [products, users] = await Promise.all([
        Product.find({ companyId, _id: { $in: productIds } }),
        User.find({ companyId, _id: { $in: userIds } }, { name: 1 }),
      ]);
      const productById = new Map(products.map((p) => [p._id.toString(), p]));
      const userNameById = new Map(users.map((u) => [u._id.toString(), u.name]));

      const totalsByType = { entrada: ZERO_DECIMAL, salida: ZERO_DECIMAL, ajuste: ZERO_DECIMAL };
      const items = page.map((doc) => {
        const product = productById.get(doc.productId.toString());
        const quantity = doc.quantity.toString();
        totalsByType[doc.type] = addDecimal(totalsByType[doc.type], quantity);
        return {
          id: doc._id.toString(),
          productId: doc.productId.toString(),
          sku: product?.sku ?? "—",
          productName: product?.name ?? "Producto eliminado",
          categoryId: product?.categoryId?.toString(),
          type: doc.type,
          quantity,
          reason: doc.reason,
          reference: doc.reference,
          createdByName: userNameById.get(doc.createdBy.toString()) ?? "Usuario",
          createdAt: doc.createdAt.toISOString(),
        };
      });

      return { items, totalsByType, truncated };
    },

    async catalogSummary(companyId: string) {
      const branch = await resolveActiveBranch(companyId);
      const [products, levels, categories, brands] = await Promise.all([
        Product.find({ companyId }),
        StockLevel.find({ companyId, branchId: branch._id }),
        Category.find({ companyId }),
        Brand.find({ companyId }),
      ]);

      const quantityByProduct = new Map(levels.map((l) => [l.productId.toString(), l.quantity.toString()]));
      const categoryNameById = new Map(categories.map((c) => [c._id.toString(), c.name]));
      const brandNameById = new Map(brands.map((b) => [b._id.toString(), b.name]));

      const byCategory = new Map<string, Group>();
      const byBrand = new Map<string, Group>();
      let totalActiveProducts = 0;
      let totalInactiveProducts = 0;

      const categoryCounts = new Map<string, number>();
      const brandCounts = new Map<string, number>();

      for (const product of products) {
        if (product.active) totalActiveProducts += 1;
        else totalInactiveProducts += 1;
        if (!product.active) continue;

        const quantity = quantityByProduct.get(product._id.toString()) ?? "0";
        const categoryId = product.categoryId?.toString() ?? NONE_GROUP_ID;
        accumulateGroup(byCategory, categoryId, categoryNameById.get(categoryId) ?? "Sin categoría", quantity, "0");
        categoryCounts.set(categoryId, (categoryCounts.get(categoryId) ?? 0) + 1);

        const brandId = product.brandId?.toString() ?? NONE_GROUP_ID;
        accumulateGroup(byBrand, brandId, brandNameById.get(brandId) ?? "Sin marca", quantity, "0");
        brandCounts.set(brandId, (brandCounts.get(brandId) ?? 0) + 1);
      }

      const byCategoryResult = [...byCategory.values()]
        .map((g) => ({ id: g.id, name: g.name, activeCount: categoryCounts.get(g.id) ?? 0, totalStock: g.totalQuantity }))
        .sort((a, b) => b.activeCount - a.activeCount);
      const byBrandResult = [...byBrand.values()]
        .map((g) => ({ id: g.id, name: g.name, activeCount: brandCounts.get(g.id) ?? 0, totalStock: g.totalQuantity }))
        .sort((a, b) => b.activeCount - a.activeCount);

      return { byCategory: byCategoryResult, byBrand: byBrandResult, totalActiveProducts, totalInactiveProducts };
    },

    async lowStock(companyId: string) {
      const branch = await resolveActiveBranch(companyId);
      const products = await Product.find({
        companyId,
        active: true,
        minStock: { $exists: true, $ne: null },
      });
      const productIds = products.map((p) => p._id.toString());
      const levels = await StockLevel.find({ companyId, branchId: branch._id, productId: { $in: productIds } });
      const quantityByProduct = new Map(levels.map((l) => [l.productId.toString(), l.quantity.toString()]));

      const items = products
        .map((product) => {
          const quantity = quantityByProduct.get(product._id.toString()) ?? "0";
          const minStock = product.minStock!.toString();
          return {
            productId: product._id.toString(),
            sku: product.sku,
            name: product.name,
            categoryId: product.categoryId?.toString(),
            quantity,
            minStock,
            deficit: compareDecimal(quantity, minStock) < 0 ? subDecimal(minStock, quantity) : ZERO_DECIMAL,
          };
        })
        .filter((item) => compareDecimal(item.quantity, item.minStock) <= 0)
        .sort((a, b) => compareDecimal(b.deficit, a.deficit));

      return { items };
    },
  };
}

export type ReportService = ReturnType<typeof createReportService>;
