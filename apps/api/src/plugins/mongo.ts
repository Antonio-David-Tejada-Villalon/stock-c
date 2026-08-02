import fp from "fastify-plugin";
import mongoose from "mongoose";
import type { FastifyInstance } from "fastify";
import { env } from "../shared/env.js";

export const mongoPlugin = fp(async function mongoPlugin(app: FastifyInstance) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongodbUri);
  app.log.info("Connected to MongoDB");

  app.addHook("onClose", async () => {
    await mongoose.disconnect();
  });
});
