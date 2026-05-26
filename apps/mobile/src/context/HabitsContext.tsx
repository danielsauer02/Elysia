import React, {
  createContext,
  useContext,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { ProtocolTemplate, HabitState } from "@elysia/domain";
import { useAuth } from "@/context/AuthContext";

const todayISO = () => new Date().toISOString().split("T")[0]!;

const reminderTimeForSlot: Record<string, string> = {
  morning: "07:30",
  midday: "12:00",
  afternoon: "15:00",
  evening: "19:30",
};

interface HabitDoc {
  _id: Id<"habits">;
  _creationTime: number;
  userId: string;
  templateId?: string;
  title: string;
  category: string;
  expectedBenefit: string;
  state: string;
  schedule: {
    frequencyPerWeek: number;
    targetTimesOfDay: string[];
    startsOn: string;
    endsOn?: string;
  };
  reminderRule?: {
    reminderTimeLocal: string;
    timezone: string;
    pushEnabled: boolean;
  };
  streakCount: number;
  completionRate30d: number;
  updatedAt?: string;
}

interface MappedHabit {
  habitId: string;
  _id: Id<"habits">;
  userId: string;
  templateId?: string;
  title: string;
  category: string;
  expectedBenefit: string;
  state: HabitState;
  schedule: {
    frequencyPerWeek: number;
    targetTimesOfDay: string[];
    startsOn: string;
    endsOn?: string;
  };
  reminderRule: {
    reminderTimeLocal: string;
    timezone: string;
    pushEnabled: boolean;
  };
  streakCount: number;
  completionRate30d: number;
  createdAt: string;
  updatedAt: string;
}

function mapHabit(h: HabitDoc): MappedHabit {
  return {
    habitId: h._id,
    _id: h._id,
    userId: h.userId,
    templateId: h.templateId,
    title: h.title,
    category: h.category,
    expectedBenefit: h.expectedBenefit,
    state: h.state as HabitState,
    schedule: h.schedule,
    reminderRule: h.reminderRule ?? {
      reminderTimeLocal: "08:00",
      timezone: "UTC",
      pushEnabled: false,
    },
    streakCount: h.streakCount,
    completionRate30d: h.completionRate30d,
    createdAt: new Date(h._creationTime).toISOString(),
    updatedAt: h.updatedAt ?? new Date(h._creationTime).toISOString(),
  };
}

interface HabitsContextValue {
  habits: MappedHabit[];
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
  getActiveHabits: () => MappedHabit[];
  getTodayProgress: () => { completed: number; total: number };
}

const HabitsContext = createContext<HabitsContextValue | null>(null);

export function HabitsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const today = todayISO();

  const rawHabits = useQuery(api.habits.listHabits, user ? {} : "skip");
  const rawCompletions = useQuery(
    api.habits.getTodayCompletions,
    user ? { date: today } : "skip"
  );

  const insertHabitMut = useMutation(api.habits.insertHabit);
  const toggleCompletionMut = useMutation(api.habits.toggleCompletion);
  const updateStateMut = useMutation(api.habits.updateHabitState);
  const removeHabitMut = useMutation(api.habits.removeHabit);

  const habits = useMemo(
    () => (rawHabits ?? []).map(mapHabit),
    [rawHabits]
  );

  const completedTodayIds = useMemo((): Set<string> => {
    const ids = rawCompletions ?? [];
    return new Set(ids.map((id) => String(id)));
  }, [rawCompletions]);

  const isLoading = rawHabits === undefined || rawCompletions === undefined;

  const addHabitFromTemplate = useCallback(
    (
      template: ProtocolTemplate,
      timeOfDay: "morning" | "midday" | "afternoon" | "evening",
      targetState: "active" | "planned" = "active"
    ) => {
      if (!user) return;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      insertHabitMut({
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
    [user, insertHabitMut, today]
  );

  const completeToday = useCallback(
    (habitId: string) => {
      if (!user) return;
      toggleCompletionMut({
        habitId: habitId as Id<"habits">,
        date: today,
      });
    },
    [user, toggleCompletionMut, today]
  );

  const updateHabitState = useCallback(
    (habitId: string, state: HabitState) => {
      if (!user) return;
      updateStateMut({
        habitId: habitId as Id<"habits">,
        state,
      });
    },
    [user, updateStateMut]
  );

  const removeHabit = useCallback(
    (habitId: string) => {
      if (!user) return;
      removeHabitMut({ habitId: habitId as Id<"habits"> });
    },
    [user, removeHabitMut]
  );

  const addSupplementHabit = useCallback(
    (title: string, category: string, _productId: string) => {
      if (!user) return;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      insertHabitMut({
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
    [user, insertHabitMut, today]
  );

  const addCustomHabit = useCallback(
    (title: string, category: string, state: "active" | "planned") => {
      if (!user) return;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      insertHabitMut({
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
    [user, insertHabitMut, today]
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
        isLoading,
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
