import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { habitStateSchema, userHabitSchema } from "@elysia/domain";
import { withResponseEnvelope } from "../../plugins/response.js";

const habitCreateSchema = userHabitSchema.omit({
  habitId: true,
  createdAt: true,
  updatedAt: true
});

export const registerHabitRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/habits", async (request, reply) => {
    withResponseEnvelope(request, reply, {
      habits: []
    });
  });

  app.post("/habits", async (request, reply) => {
    const payload = habitCreateSchema.parse(request.body);
    withResponseEnvelope(request, reply, {
      created: true,
      habit: payload
    });
  });

  app.patch("/habits/:habitId/state", async (request, reply) => {
    const paramsSchema = z.object({ habitId: z.string().uuid() });
    const bodySchema = z.object({ state: habitStateSchema });
    const params = paramsSchema.parse(request.params);
    const body = bodySchema.parse(request.body);
    withResponseEnvelope(request, reply, {
      updated: true,
      habitId: params.habitId,
      state: body.state
    });
  });
};
