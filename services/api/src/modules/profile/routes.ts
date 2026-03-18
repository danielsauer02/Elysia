import type { FastifyInstance } from "fastify";
import { onboardingPayloadSchema } from "@elysia/domain";
import { withResponseEnvelope } from "../../plugins/response.js";

export const registerProfileRoutes = async (
  app: FastifyInstance
): Promise<void> => {
  app.post("/profile/onboarding", async (request, reply) => {
    const payload = onboardingPayloadSchema.parse(request.body);
    withResponseEnvelope(request, reply, {
      profileStatus: "initialized",
      nextStep: "connect_wearable_or_start_habit",
      onboarding: payload
    });
  });

  app.get("/profile/me", async (request, reply) => {
    withResponseEnvelope(request, reply, {
      profile: null,
      message: "User profile should be resolved from authenticated context."
    });
  });
};
