import fp from "fastify-plugin";
import { Redis } from "ioredis";
import type { FastifyInstance } from "fastify";
import { env } from "../shared/env.js";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

export interface RedisPluginOptions {
  /** Inyección para tests (ej. ioredis-mock) — en producción se ignora. */
  client?: Redis;
}

export const redisPlugin = fp<RedisPluginOptions>(async function redisPlugin(app: FastifyInstance, opts) {
  const redis = opts.client ?? new Redis(env.redisUrl, { maxRetriesPerRequest: 3 });

  redis.on("error", (err: Error) => app.log.error({ err }, "Redis connection error"));

  app.decorate("redis", redis);

  app.addHook("onClose", async () => {
    await redis.quit().catch(() => undefined);
  });
});
