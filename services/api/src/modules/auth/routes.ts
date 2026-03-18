import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withResponseEnvelope } from "../../plugins/response.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const registerAuthRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post("/auth/login", async (request, reply) => {
    const payload = loginSchema.parse(request.body);
    withResponseEnvelope(request, reply, {
      accessToken: `access_${payload.email}`,
      refreshToken: `refresh_${payload.email}`,
      expiresInSeconds: 3600
    });
  });
};
