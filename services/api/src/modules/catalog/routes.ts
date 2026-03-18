import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withResponseEnvelope } from "../../plugins/response.js";

const catalogQuerySchema = z.object({
  category: z.string().optional(),
  offerType: z.enum(["affiliate", "internal", "partner"]).optional()
});

export const registerCatalogRoutes = async (
  app: FastifyInstance
): Promise<void> => {
  app.get("/catalog/items", async (request, reply) => {
    const query = catalogQuerySchema.parse(request.query);
    withResponseEnvelope(request, reply, {
      filters: query,
      items: []
    });
  });
};
