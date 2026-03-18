import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerProfileRoutes } from "./modules/profile/routes.js";
import { registerHabitRoutes } from "./modules/habits/routes.js";
import { registerLibraryRoutes } from "./modules/library/routes.js";
import { registerDashboardRoutes } from "./modules/dashboard/routes.js";
import { registerCatalogRoutes } from "./modules/catalog/routes.js";
import { registerBillingRoutes } from "./modules/billing/routes.js";
import { registerEntitlementRoutes } from "./modules/entitlements/routes.js";
import { registerIntegrationRoutes } from "./modules/integrations/routes.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async () => ({
  ok: true,
  service: "elysia-api",
  status: "healthy"
}));

await registerAuthRoutes(app);
await registerProfileRoutes(app);
await registerHabitRoutes(app);
await registerLibraryRoutes(app);
await registerDashboardRoutes(app);
await registerCatalogRoutes(app);
await registerBillingRoutes(app);
await registerEntitlementRoutes(app);
await registerIntegrationRoutes(app);

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

app
  .listen({ port, host })
  .then(() => {
    app.log.info(`API running on ${host}:${port}`);
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
