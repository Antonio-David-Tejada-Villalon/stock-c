import "dotenv/config";
import { buildApp } from "./app.js";
import { env } from "./shared/env.js";

const app = await buildApp();

app
  .listen({ port: env.port, host: "0.0.0.0" })
  .then(() => app.log.info(`STOCK-C API listening on port ${env.port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
