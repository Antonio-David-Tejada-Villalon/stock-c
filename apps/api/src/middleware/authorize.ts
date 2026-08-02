import type { FastifyReply, FastifyRequest } from "fastify";

export function authorize(permission: string) {
  return async function authorizeHandler(request: FastifyRequest, reply: FastifyReply) {
    const permissions = request.user?.permissions ?? [];
    if (!permissions.includes(permission)) {
      return reply.code(403).send({ error: "forbidden", message: `Missing permission: ${permission}` });
    }
  };
}
