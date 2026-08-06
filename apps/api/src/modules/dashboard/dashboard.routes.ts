import type { FastifyInstance } from "fastify";
import { Branch } from "../../db/models/branch.model.js";
import { User } from "../../db/models/user.model.js";
import { Product } from "../../db/models/product.model.js";
import { StockMovement, type StockMovementDocument } from "../../db/models/stockMovement.model.js";
import { authenticate } from "../../middleware/authenticate.js";
import { NoActiveBranchError } from "../../db/helpers/resolveActiveBranch.js";
import { createReportService } from "../reports/report.service.js";

export async function dashboardRoutes(app: FastifyInstance) {
  const reportService = createReportService();

  app.get(
    "/dashboard/summary",
    { preHandler: authenticate },
    async (request) => {
      const { companyId } = request.user;

      const [branchCount, activeUserCount, productCount, branches] = await Promise.all([
        Branch.countDocuments({ companyId, active: true }),
        User.countDocuments({ companyId, active: true }),
        Product.countDocuments({ companyId, active: true }),
        Branch.find({ companyId, active: true }).limit(2),
      ]);

      // A diferencia de /stock-movements (Fase 9), el panel no puede fallar
      // solo porque la sucursal activa sea ambigua — es un resumen general,
      // no una operación de inventario. Si no hay exactamente una, se
      // muestra 0 movimientos en vez de romper el panel entero.
      const branch = branches.length === 1 ? branches[0] : null;

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      let movementsTodayCount = 0;
      let recentDocs: StockMovementDocument[] = [];
      if (branch) {
        [movementsTodayCount, recentDocs] = await Promise.all([
          StockMovement.countDocuments({
            companyId,
            branchId: branch._id,
            createdAt: { $gte: startOfToday },
          }),
          StockMovement.find({ companyId, branchId: branch._id }).sort({ createdAt: -1 }).limit(5),
        ]);
      }

      const productIds = [...new Set(recentDocs.map((d) => d.productId.toString()))];
      const products = await Product.find({ companyId, _id: { $in: productIds } }, { name: 1 });
      const productNameById = new Map(products.map((p) => [p._id.toString(), p.name]));

      const recentMovements = recentDocs.map((d) => ({
        id: d._id.toString(),
        productId: d.productId.toString(),
        productName: productNameById.get(d.productId.toString()) ?? "Producto",
        type: d.type,
        quantity: d.quantity.toString(),
        createdAt: d.createdAt.toISOString(),
      }));

      // Reutiliza el servicio de reportes (Fase 11) en vez de reimplementar
      // el cálculo — mismo criterio de "sin sucursal activa, degradar a 0"
      // que el resto de este endpoint, no romper el panel.
      let lowStockCount = 0;
      try {
        lowStockCount = (await reportService.lowStock(companyId)).items.length;
      } catch (err) {
        if (!(err instanceof NoActiveBranchError)) throw err;
      }

      return { branchCount, activeUserCount, productCount, movementsTodayCount, lowStockCount, recentMovements };
    },
  );
}
