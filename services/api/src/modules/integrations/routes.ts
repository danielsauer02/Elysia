import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withResponseEnvelope } from "../../plugins/response.js";

const connectSourceSchema = z.object({
  provider: z.enum(["apple_health", "garmin", "whoop", "oura"]),
  authCode: z.string().min(4).optional()
});

export const registerIntegrationRoutes = async (
  app: FastifyInstance
): Promise<void> => {
  app.get("/integrations/sources", async (request, reply) => {
    withResponseEnvelope(request, reply, {
      sources: [
        { provider: "apple_health", status: "disconnected" },
        { provider: "garmin", status: "coming_soon" },
        { provider: "whoop", status: "coming_soon" },
        { provider: "oura", status: "coming_soon" }
      ]
    });
  });

  app.post("/integrations/connect", async (request, reply) => {
    const payload = connectSourceSchema.parse(request.body);
    withResponseEnvelope(request, reply, {
      provider: payload.provider,
      status: "pending_sync",
      message: "Adapter and data normalization pipeline are phase-ready."
    });
  });
};
