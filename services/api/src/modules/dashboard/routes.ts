import type { FastifyInstance } from "fastify";
import { withResponseEnvelope } from "../../plugins/response.js";
import { supabaseAdmin } from "../../lib/supabase.js";

export const registerDashboardRoutes = async (
  app: FastifyInstance
): Promise<void> => {
  // GET /dashboard — aggregated summary for authenticated user
  app.get(
    "/dashboard",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const today = new Date().toISOString().split("T")[0]!;
      const userId = request.userId;

      // Fetch habits + today's completions in parallel
      const [habitsResult, completionsResult, profileResult] = await Promise.all([
        supabaseAdmin
          .from("habits")
          .select("id, state, title, category")
          .eq("user_id", userId),
        supabaseAdmin
          .from("habit_completions")
          .select("habit_id")
          .eq("user_id", userId)
          .eq("completed_date", today),
        supabaseAdmin
          .from("profiles")
          .select("name, weight_kg, date_of_birth")
          .eq("id", userId)
          .single(),
      ]);

      const habits = habitsResult.data ?? [];
      const completedIds = new Set(
        (completionsResult.data ?? []).map((c) => c.habit_id)
      );
      const profile = profileResult.data;

      const activeHabits = habits.filter((h) => h.state === "active");
      const completedCount = activeHabits.filter((h) =>
        completedIds.has(h.id)
      ).length;

      withResponseEnvelope(request, reply, {
        profile,
        habitSummary: {
          total: activeHabits.length,
          completedToday: completedCount,
          completionRate:
            activeHabits.length > 0
              ? Math.round((completedCount / activeHabits.length) * 100)
              : 0,
        },
        tiles: [
          {
            tileId: "habit_consistency",
            title: "Habit Consistency",
            status: "active",
            insight: `${completedCount}/${activeHabits.length} completed today`,
          },
          {
            tileId: "wearable_recovery",
            title: "Recovery & Sleep",
            status: "placeholder_connect",
          },
          {
            tileId: "diagnostics_slot",
            title: "Diagnostics",
            status: "placeholder_coming_soon",
          },
        ],
      });
    }
  );

  // Legacy tiles endpoint
  app.get("/dashboard/tiles", { preHandler: app.authenticate }, async (request, reply) => {
    withResponseEnvelope(request, reply, {
      tiles: [
        { tileId: "habit_consistency", title: "Habit Consistency", status: "active" },
        { tileId: "wearable_recovery", title: "Recovery & Sleep", status: "placeholder_connect" },
        { tileId: "diagnostics_slot", title: "Diagnostics", status: "placeholder_coming_soon" },
      ],
    });
  });
};
