import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withResponseEnvelope } from "../../plugins/response.js";
import { supabaseAdmin } from "../../lib/supabase.js";

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  date_of_birth: z.string().optional(),
  height_cm: z.number().positive().optional(),
  weight_kg: z.number().positive().optional(),
  goals: z.array(z.string()).optional(),
  wearables: z.array(z.string()).optional(),
});

export const registerProfileRoutes = async (
  app: FastifyInstance
): Promise<void> => {
  // GET /profile/me — returns the authenticated user's profile
  app.get(
    "/profile/me",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", request.userId)
        .single();

      if (error) {
        return reply.code(500).send({ ok: false, error: error.message });
      }

      withResponseEnvelope(request, reply, { profile: data });
    }
  );

  // PATCH /profile/me — update profile fields
  app.patch(
    "/profile/me",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const payload = updateProfileSchema.parse(request.body);

      const { data, error } = await supabaseAdmin
        .from("profiles")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", request.userId)
        .select()
        .single();

      if (error) {
        return reply.code(500).send({ ok: false, error: error.message });
      }

      withResponseEnvelope(request, reply, { profile: data });
    }
  );

  // Legacy onboarding route — kept for compatibility
  app.post(
    "/profile/onboarding",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const schema = z.object({
        name: z.string().min(2),
        dateOfBirth: z.string(),
        heightCm: z.number().positive(),
        weightKg: z.number().positive(),
        goals: z.array(z.string()),
        wearables: z.array(z.string()),
      });

      const payload = schema.parse(request.body);

      const { data, error } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: request.userId,
          name: payload.name,
          date_of_birth: payload.dateOfBirth,
          height_cm: payload.heightCm,
          weight_kg: payload.weightKg,
          goals: payload.goals,
          wearables: payload.wearables,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return reply.code(500).send({ ok: false, error: error.message });
      }

      withResponseEnvelope(request, reply, {
        profileStatus: "initialized",
        profile: data,
      });
    }
  );
};
