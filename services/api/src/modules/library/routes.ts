import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withResponseEnvelope } from "../../plugins/response.js";

const querySchema = z.object({
  category: z.string().optional(),
  tier: z.enum(["free", "pro", "elite"]).optional()
});

export const registerLibraryRoutes = async (
  app: FastifyInstance
): Promise<void> => {
  app.get("/library/templates", async (request, reply) => {
    const query = querySchema.parse(request.query);
    withResponseEnvelope(request, reply, {
      filters: query,
      templates: []
    });
  });
};
