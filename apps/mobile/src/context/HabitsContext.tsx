import React, {
  createContext,
  useContext,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UserHabit, ProtocolTemplate, HabitState } from "@elysia/domain";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayISO = () => new Date().toISOString().split("T")[0]!;
const nowISO = () => new Date().toISOString();

const reminderTimeForSlot: Record<string, string> = {
  morning: "07:30",
  midday: "12:00",
  afternoon: "15:00",
  evening: "19:30",
};

function mapRowToHabit(row: Record<string, unknown>): UserHabit {
  return {
    habitId: row.id as string,
    userId: row.user_id as string,
    templateId: (row.template_id as string | null) ?? undefined,
    title: row.title as string,
    category: row.category as string,
    expectedBenefit: (row.expected_benefit as string) ?? "",
    state: row.state as HabitState,
    schedule: row.schedule as UserHabit["schedule"],
    reminderRule: (row.reminder_rule as UserHabit["reminderRule"]) ?? {
      reminderTimeLocal: "08:00",
      timezone: "UTC",
      pushEnabled: false,
    },
    streakCount: (row.streak_count as number) ?? 0,
    completionRate30d: (row.completion_rate_30d as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ─── Context types ────────────────────────────────────────────────────────────

interface HabitsContextValue {
  habits: UserHabit[];
  completedTodayIds: Set<string>;
  isLoading: boolean;
  addHabitFromTemplate: (
    template: ProtocolTemplate,
    timeOfDay: "morning" | "midday" | "afternoon" | "evening",
    targetState?: "active" | "planned"
  ) => void;
  completeToday: (habitId: string) => void;
  updateHabitState: (habitId: string, state: HabitState) => void;
  removeHabit: (habitId: string) => void;
  isHabitAddedFromTemplate: (templateId: string) => boolean;
  addSupplementHabit: (title: string, category: string, productId: string) => void;
  isProductTracked: (productId: string) => boolean;
  addCustomHabit: (title: string, category: string, state: "active" | "planned") => void;
  getActiveHabits: () => UserHabit[];
  getTodayProgress: () => { completed: number; total: number };
}

const HabitsContext = createContext<HabitsContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function HabitsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = todayISO();

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: habits = [], isLoading: habitsLoading } = useQuery({
    queryKey: ["habits", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habits")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapRowToHabit);
    },
    enabled: !!user,
  });

  const { data: completedIds = [], isLoading: completionsLoading } = useQuery({
    queryKey: ["habit_completions", user?.id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_completions")
        .select("habit_id")
        .eq("completed_date", today);
      if (error) throw error;
      return (data ?? []).map((c) => c.habit_id as string);
    },
    enabled: !!user,
  });

  const completedTodayIds = useMemo(() => new Set(completedIds), [completedIds]);

  // ── Mutations ────────────────────────────────────────────────────────────

  const insertHabitMutation = useMutation({
    mutationFn: async (
      habit: Omit<UserHabit, "habitId" | "streakCount" | "completionRate30d" | "createdAt" | "updatedAt">
    ) => {
      const { data, error } = await supabase
        .from("habits")
        .insert({
          user_id: user!.id,
          template_id: habit.templateId ?? null,
          title: habit.title,
          category: habit.category,
          expected_benefit: habit.expectedBenefit,
          state: habit.state,
          schedule: habit.schedule,
          reminder_rule: habit.reminderRule,
          streak_count: 0,
          completion_rate_30d: 0,
        })
        .select()
        .single();
      if (error) throw error;
      return mapRowToHabit(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits", user?.id] });
    },
  });

  const completeTodayMutation = useMutation({
    mutationFn: async (habitId: string) => {
      const isCompleted = completedTodayIds.has(habitId);
      if (isCompleted) {
        const { error } = await supabase
          .from("habit_completions")
          .delete()
          .eq("habit_id", habitId)
          .eq("completed_date", today);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("habit_completions").insert({
          habit_id: habitId,
          user_id: user!.id,
          completed_date: today,
        });
        if (error) throw error;
      }
    },
    onMutate: async (habitId) => {
      await qc.cancelQueries({ queryKey: ["habit_completions", user?.id, today] });
      const prev = qc.getQueryData<string[]>(["habit_completions", user?.id, today]);
      const isCompleted = (prev ?? []).includes(habitId);
      qc.setQueryData<string[]>(
        ["habit_completions", user?.id, today],
        isCompleted
          ? (prev ?? []).filter((id) => id !== habitId)
          : [...(prev ?? []), habitId]
      );
      return { prev };
    },
    onError: (_err, _habitId, context) => {
      if (context?.prev !== undefined) {
        qc.setQueryData(["habit_completions", user?.id, today], context.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["habit_completions", user?.id, today] });
    },
  });

  const updateStateMutation = useMutation({
    mutationFn: async ({ habitId, state }: { habitId: string; state: HabitState }) => {
      const { error } = await supabase
        .from("habits")
        .update({ state, updated_at: nowISO() })
        .eq("id", habitId)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onMutate: async ({ habitId, state }) => {
      await qc.cancelQueries({ queryKey: ["habits", user?.id] });
      const prev = qc.getQueryData<UserHabit[]>(["habits", user?.id]);
      qc.setQueryData<UserHabit[]>(
        ["habits", user?.id],
        (old = []) => old.map((h) => (h.habitId === habitId ? { ...h, state } : h))
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) qc.setQueryData(["habits", user?.id], context.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["habits", user?.id] }),
  });

  const removeHabitMutation = useMutation({
    mutationFn: async (habitId: string) => {
      const { error } = await supabase
        .from("habits")
        .delete()
        .eq("id", habitId)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onMutate: async (habitId) => {
      await qc.cancelQueries({ queryKey: ["habits", user?.id] });
      const prev = qc.getQueryData<UserHabit[]>(["habits", user?.id]);
      qc.setQueryData<UserHabit[]>(
        ["habits", user?.id],
        (old = []) => old.filter((h) => h.habitId !== habitId)
      );
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) qc.setQueryData(["habits", user?.id], context.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["habits", user?.id] }),
  });

  // ── Public actions ────────────────────────────────────────────────────────

  const addHabitFromTemplate = useCallback(
    (
      template: ProtocolTemplate,
      timeOfDay: "morning" | "midday" | "afternoon" | "evening",
      targetState: "active" | "planned" = "active"
    ) => {
      if (!user) return;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      insertHabitMutation.mutate({
        userId: user.id,
        templateId: template.templateId,
        title: template.title,
        category: template.category,
        expectedBenefit: template.expectedBenefit,
        state: targetState,
        schedule: template.defaultSchedule ?? {
          frequencyPerWeek: 5,
          targetTimesOfDay: [timeOfDay],
          startsOn: today,
        },
        reminderRule: {
          reminderTimeLocal: reminderTimeForSlot[timeOfDay] ?? "08:00",
          timezone,
          pushEnabled: true,
        },
      });
    },
    [user, insertHabitMutation, today]
  );

  const completeToday = useCallback(
    (habitId: string) => {
      if (!user) return;
      completeTodayMutation.mutate(habitId);
    },
    [user, completeTodayMutation]
  );

  const updateHabitState = useCallback(
    (habitId: string, state: HabitState) => {
      if (!user) return;
      updateStateMutation.mutate({ habitId, state });
    },
    [user, updateStateMutation]
  );

  const removeHabit = useCallback(
    (habitId: string) => {
      if (!user) return;
      removeHabitMutation.mutate(habitId);
    },
    [user, removeHabitMutation]
  );

  const addSupplementHabit = useCallback(
    (title: string, category: string, _productId: string) => {
      if (!user) return;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      insertHabitMutation.mutate({
        userId: user.id,
        templateId: undefined,
        title: `Take ${title}`,
        category,
        expectedBenefit: "Daily supplement tracking.",
        state: "active",
        schedule: {
          frequencyPerWeek: 7,
          targetTimesOfDay: ["morning"],
          startsOn: today,
        },
        reminderRule: {
          reminderTimeLocal: "08:00",
          timezone,
          pushEnabled: true,
        },
      });
    },
    [user, insertHabitMutation, today]
  );

  const addCustomHabit = useCallback(
    (title: string, category: string, state: "active" | "planned") => {
      if (!user) return;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      insertHabitMutation.mutate({
        userId: user.id,
        templateId: undefined,
        title,
        category,
        expectedBenefit: "Custom habit.",
        state,
        schedule: {
          frequencyPerWeek: 7,
          targetTimesOfDay: ["morning"],
          startsOn: today,
        },
        reminderRule: {
          reminderTimeLocal: "08:00",
          timezone,
          pushEnabled: false,
        },
      });
    },
    [user, insertHabitMutation, today]
  );

  const isHabitAddedFromTemplate = useCallback(
    (templateId: string) => habits.some((h) => h.templateId === templateId),
    [habits]
  );

  const isProductTracked = useCallback(
    (productId: string) =>
      habits.some((h) => h.title.includes(productId) || h.habitId === productId),
    [habits]
  );

  const getActiveHabits = useCallback(
    () => habits.filter((h) => h.state === "active"),
    [habits]
  );

  const getTodayProgress = useCallback(() => {
    const active = habits.filter((h) => h.state === "active");
    return { completed: completedTodayIds.size, total: active.length };
  }, [habits, completedTodayIds]);

  return (
    <HabitsContext.Provider
      value={{
        habits,
        completedTodayIds,
        isLoading: habitsLoading || completionsLoading,
        addHabitFromTemplate,
        completeToday,
        updateHabitState,
        removeHabit,
        isHabitAddedFromTemplate,
        addSupplementHabit,
        isProductTracked,
        addCustomHabit,
        getActiveHabits,
        getTodayProgress,
      }}
    >
      {children}
    </HabitsContext.Provider>
  );
}

export function useHabits(): HabitsContextValue {
  const ctx = useContext(HabitsContext);
  if (!ctx) throw new Error("useHabits must be used inside HabitsProvider");
  return ctx;
}
