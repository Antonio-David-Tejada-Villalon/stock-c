import type { FastifyInstance } from "fastify";
import { Branch } from "../../db/models/branch.model.js";
import { User } from "../../db/models/user.model.js";
import { authenticate } from "../../middleware/authenticate.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get(
    "/dashboard/summary",
    { preHandler: authenticate },
    async (request) => {
      const { companyId } = request.user;

      const [branchCount, activeUserCount] = await Promise.all([
        Branch.countDocuments({ companyId, active: true }),
        User.countDocuments({ companyId, active: true }),
      ]);

      return { branchCount, activeUserCount };
    },
  );
}
