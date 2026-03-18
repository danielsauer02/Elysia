import type { FastifyInstance } from "fastify";
import { withResponseEnvelope } from "../../plugins/response.js";

export const registerDashboardRoutes = async (
  app: FastifyInstance
): Promise<void> => {
  app.get("/dashboard/tiles", async (request, reply) => {
    withResponseEnvelope(request, reply, {
      tiles: [
        {
          tileId: "habit_consistency",
          title: "Habit Consistency",
          status: "active"
        },
        {
          tileId: "wearable_recovery",
          title: "Recovery & Sleep",
          status: "placeholder_connect"
        },
        {
          tileId: "diagnostics_slot",
          title: "Diagnostics",
          status: "placeholder_coming_soon"
        }
      ]
    });
  });
};
