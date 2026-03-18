import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withResponseEnvelope } from "../../plugins/response.js";

const receiptSchema = z.object({
  platform: z.enum(["ios", "android"]),
  receipt: z.string().min(12)
});

export const registerBillingRoutes = async (
  app: FastifyInstance
): Promise<void> => {
  app.post("/billing/verify-receipt", async (request, reply) => {
    const payload = receiptSchema.parse(request.body);
    withResponseEnvelope(request, reply, {
      verified: true,
      platform: payload.platform,
      mappedTier: "pro"
    });
  });
};
