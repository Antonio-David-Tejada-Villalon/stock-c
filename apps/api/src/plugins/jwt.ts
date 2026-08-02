import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance } from "fastify";
import { env } from "../shared/env.js";

export interface AccessTokenPayload {
  sub: string;
  companyId: string;
  roleId: string;
  permissions: string[];
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

export const jwtPlugin = fp(async function jwtPlugin(app: FastifyInstance) {
  await app.register(fastifyJwt, {
    secret: env.jwtAccessSecret,
    sign: { expiresIn: "15m" },
  });
});
