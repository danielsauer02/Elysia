import type { FastifyInstance } from "fastify";
import { withResponseEnvelope } from "../../plugins/response.js";

export const registerEntitlementRoutes = async (
  app: FastifyInstance
): Promise<void> => {
  app.get("/entitlements/me", async (request, reply) => {
    withResponseEnvelope(request, reply, {
      tier: "free",
      features: [
        "dashboard.core",
        "library.core",
        "habits.core",
        "products.core",
        "diagnostics.placeholders",
        "nutrition.placeholder"
      ]
    });
  });
};
