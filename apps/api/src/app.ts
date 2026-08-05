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

  return app;
}
