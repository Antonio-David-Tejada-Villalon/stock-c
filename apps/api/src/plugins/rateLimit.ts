import fp from "fastify-plugin";
import fastifyRateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";

export interface RateLimitPluginOptions {
  /**
   * `false` fuerza el LocalStore en memoria del propio plugin en vez de
   * Redis — usado en tests: el store de Redis de @fastify/rate-limit
   * depende de un script Lua vía `redis.defineCommand`, que ioredis-mock
   * no reproduce fielmente. LocalStore es determinista y no depende de
   * scripting, así que es lo correcto para un test de un solo proceso.
   */
  redis?: Redis | false;
}

export const rateLimitPlugin = fp<RateLimitPluginOptions>(async function rateLimitPlugin(
  app: FastifyInstance,
  opts,
) {
  const redis = opts.redis === false ? undefined : (opts.redis ?? app.redis);
  await app.register(fastifyRateLimit, {
    global: false,
    redis,
  });
});
