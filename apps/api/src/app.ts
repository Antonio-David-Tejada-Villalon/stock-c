import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./shared/env.js";
import { healthPlugin } from "./plugins/health.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: env.corsOrigin.split(","),
  });

  await app.register(healthPlugin);

  return app;
}
