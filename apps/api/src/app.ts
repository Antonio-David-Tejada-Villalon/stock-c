import Fastify from "fastify";
import cors from "@fastify/cors";
import type { Redis } from "ioredis";
import { env } from "./shared/env.js";
import { healthPlugin } from "./plugins/health.js";
import { mongoPlugin } from "./plugins/mongo.js";
import { redisPlugin } from "./plugins/redis.js";
import { jwtPlugin } from "./plugins/jwt.js";
import { cookiePlugin } from "./plugins/cookie.js";
import { rateLimitPlugin } from "./plugins/rateLimit.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { productRoutes } from "./modules/products/product.routes.js";
import { categoryRoutes } from "./modules/categories/category.routes.js";
import { brandRoutes } from "./modules/catalogs/brand.module.js";
import { unitRoutes } from "./modules/catalogs/unit.module.js";
import { inventoryRoutes } from "./modules/inventory/stockMovement.routes.js";
import { reportRoutes } from "./modules/reports/report.routes.js";
import { notificationRoutes } from "./modules/notifications/notification.routes.js";
import { companyRoutes } from "./modules/company/company.routes.js";
import { branchRoutes } from "./modules/branches/branch.routes.js";
import { userRoutes } from "./modules/users/user.routes.js";

export interface BuildAppOptions {
  /** Inyección para tests — evita depender de un Redis real. */
  redisClient?: Redis;
  /** `false` en tests: ver nota en plugins/rateLimit.ts. */
  rateLimitRedis?: Redis | false;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: {
      redact: ["req.headers.authorization", "req.headers.cookie", "req.body.password"],
    },
  });

  await app.register(cors, {
    origin: env.corsOrigin.split(","),
    credentials: true,
  });

  await app.register(mongoPlugin);
  await app.register(redisPlugin, { client: options.redisClient });
  await app.register(jwtPlugin);
  await app.register(cookiePlugin);
  await app.register(rateLimitPlugin, { redis: options.rateLimitRedis });

  await app.register(healthPlugin);
  await app.register(authRoutes);
  await app.register(dashboardRoutes);
  await app.register(productRoutes);
  await app.register(categoryRoutes);
  await app.register(brandRoutes);
  await app.register(unitRoutes);
  await app.register(inventoryRoutes);
  await app.register(reportRoutes);
  await app.register(notificationRoutes);
  await app.register(companyRoutes);
  await app.register(branchRoutes);
  await app.register(userRoutes);

  return app;
}
