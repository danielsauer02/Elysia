import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { habitStateSchema } from "@elysia/domain";
import { withResponseEnvelope } from "../../plugins/response.js";
import { supabaseAdmin } from "../../lib/supabase.js";

const habitInsertSchema = z.object({
  templateId: z.string().optional(),
  title: z.string().min(2),
  category: z.string().min(2),
  expectedBenefit: z.string().default(""),
  state: habitStateSchema.default("active"),
  schedule: z.object({
    frequencyPerWeek: z.number().int().min(1).max(21),
    targetTimesOfDay: z.array(z.string()).min(1),
    startsOn: z.string(),
  }),
  reminderRule: z
    .object({
      reminderTimeLocal: z.string(),
      timezone: z.string(),
      pushEnabled: z.boolean(),
    })
    .optional(),
});

export const registerHabitRoutes = async (
  app: FastifyInstance
): Promise<void> => {
  // GET /habits — all habits for the authenticated user
  app.get(
    "/habits",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const { data, error } = await supabaseAdmin
        .from("habits")
        .select("*")
        .eq("user_id", request.userId)
        .order("created_at", { ascending: false });

      if (error) {
        return reply.code(500).send({ ok: false, error: error.message });
      }

      withResponseEnvelope(request, reply, { habits: data ?? [] });
    }
  );

  // POST /habits — create a new habit
  app.post(
    "/habits",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const payload = habitInsertSchema.parse(request.body);

      const { data, error } = await supabaseAdmin
        .from("habits")
        .insert({
          user_id: request.userId,
          template_id: payload.templateId ?? null,
          title: payload.title,
          category: payload.category,
          expected_benefit: payload.expectedBenefit,
          state: payload.state,
          schedule: payload.schedule,
          reminder_rule: payload.reminderRule ?? null,
        })
        .select()
        .single();

      if (error) {
        return reply.code(500).send({ ok: false, error: error.message });
      }

      return reply.code(201).send({
        ok: true,
        data: { habit: data },
        requestId: request.id,
      });
    }
  );

  // PATCH /habits/:habitId/state — change habit state
  app.patch(
    "/habits/:habitId/state",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const paramsSchema = z.object({ habitId: z.string().uuid() });
      const bodySchema = z.object({ state: habitStateSchema });
      const { habitId } = paramsSchema.parse(request.params);
      const { state } = bodySchema.parse(request.body);

      const { data, error } = await supabaseAdmin
        .from("habits")
        .update({ state, updated_at: new Date().toISOString() })
        .eq("id", habitId)
        .eq("user_id", request.userId)
        .select()
        .single();

      if (error) {
        return reply.code(500).send({ ok: false, error: error.message });
      }

      withResponseEnvelope(request, reply, { habit: data });
    }
  );

  // DELETE /habits/:habitId — permanently remove a habit
  app.delete(
    "/habits/:habitId",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const paramsSchema = z.object({ habitId: z.string().uuid() });
      const { habitId } = paramsSchema.parse(request.params);

      const { error } = await supabaseAdmin
        .from("habits")
        .delete()
        .eq("id", habitId)
        .eq("user_id", request.userId);

      if (error) {
        return reply.code(500).send({ ok: false, error: error.message });
      }

      withResponseEnvelope(request, reply, { deleted: true, habitId });
    }
  );

  // GET /habits/completions/today — today's completed habit IDs
  app.get(
    "/habits/completions/today",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const today = new Date().toISOString().split("T")[0]!;

      const { data, error } = await supabaseAdmin
        .from("habit_completions")
        .select("habit_id")
        .eq("user_id", request.userId)
        .eq("completed_date", today);

      if (error) {
        return reply.code(500).send({ ok: false, error: error.message });
      }

      withResponseEnvelope(request, reply, {
        completedIds: (data ?? []).map((r) => r.habit_id),
      });
    }
  );

  // POST /habits/:habitId/complete — toggle today's completion
  app.post(
    "/habits/:habitId/complete",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const paramsSchema = z.object({ habitId: z.string().uuid() });
      const { habitId } = paramsSchema.parse(request.params);
      const today = new Date().toISOString().split("T")[0]!;

      // Check if already completed
      const { data: existing } = await supabaseAdmin
        .from("habit_completions")
        .select("id")
        .eq("habit_id", habitId)
        .eq("user_id", request.userId)
        .eq("completed_date", today)
        .maybeSingle();

      if (existing) {
        // Toggle off
        await supabaseAdmin
          .from("habit_completions")
          .delete()
          .eq("id", existing.id);
        withResponseEnvelope(request, reply, { completed: false });
      } else {
        // Toggle on
        await supabaseAdmin.from("habit_completions").insert({
          habit_id: habitId,
          user_id: request.userId,
          completed_date: today,
        });
        withResponseEnvelope(request, reply, { completed: true });
      }
    }
  );
};
