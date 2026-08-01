import type { FastifyInstance } from "fastify";

export async function healthPlugin(app: FastifyInstance) {
  app.get("/health", async () => ({
    status: "ok",
    service: "stock-c-api",
    timestamp: new Date().toISOString(),
  }));
}
