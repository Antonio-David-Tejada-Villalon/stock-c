import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate.js";
import { createNotificationService } from "./notification.service.js";
import { ListNotificationsQuerySchema, type ListNotificationsQuery } from "./notification.schemas.js";

export async function notificationRoutes(app: FastifyInstance) {
  const service = createNotificationService();

  app.get<{ Querystring: ListNotificationsQuery }>(
    "/notifications",
    { preHandler: authenticate, schema: { querystring: ListNotificationsQuerySchema } },
    async (request) => service.list(request.user.companyId, request.user.sub, request.query),
  );

  app.get(
    "/notifications/unread-count",
    { preHandler: authenticate },
    async (request) => service.unreadCount(request.user.companyId, request.user.sub),
  );

  app.post<{ Params: { id: string } }>(
    "/notifications/:id/read",
    { preHandler: authenticate },
    async (request, reply) => {
      await service.markRead(request.user.companyId, request.user.sub, request.params.id);
      return reply.code(204).send();
    },
  );
}
