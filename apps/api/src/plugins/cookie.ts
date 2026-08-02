import fp from "fastify-plugin";
import fastifyCookie from "@fastify/cookie";
import type { FastifyInstance } from "fastify";

export const cookiePlugin = fp(async function cookiePlugin(app: FastifyInstance) {
  await app.register(fastifyCookie);
});
