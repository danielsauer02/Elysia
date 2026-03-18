import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { UserHabit, ProtocolTemplate, HabitState } from "@elysia/domain";
import { mockHabits } from "@/mocks/data";

const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const todayISO = () => new Date().toISOString().split("T")[0]!;
const nowISO = () => new Date().toISOString();

interface HabitsContextValue {
  habits: UserHabit[];
  completedTodayIds: Set<string>;
  addHabitFromTemplate: (
    template: ProtocolTemplate,
    timeOfDay: "morning" | "midday" | "afternoon" | "evening",
    targetState?: "active" | "planned"
  ) => void;
  completeToday: (habitId: string) => void;
  updateHabitState: (habitId: string, state: HabitState) => void;
  isHabitAddedFromTemplate: (templateId: string) => boolean;
  addSupplementHabit: (title: string, category: string, productId: string) => void;
  isProductTracked: (productId: string) => boolean;
  addCustomHabit: (title: string, category: string, state: "active" | "planned") => void;
  getActiveHabits: () => UserHabit[];
  getTodayProgress: () => { completed: number; total: number };
}

const HabitsContext = createContext<HabitsContextValue | null>(null);

const reminderTimeForSlot: Record<string, string> = {
  morning: "07:30",
  midday: "12:00",
  afternoon: "15:00",
  evening: "19:30",
};

export function HabitsProvider({ children }: { children: ReactNode }) {
  const [habits, setHabits] = useState<UserHabit[]>(mockHabits);
  const [completedTodayIds, setCompletedTodayIds] = useState<Set<string>>(
    new Set()
  );

  const addHabitFromTemplate = useCallback(
    (
      template: ProtocolTemplate,
      timeOfDay: "morning" | "midday" | "afternoon" | "evening",
      targetState: "active" | "planned" = "active"
    ) => {
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

      const newHabit: UserHabit = {
        habitId: generateId(),
        userId: "current-user",
        templateId: template.templateId,
        title: template.title,
        category: template.category,
        expectedBenefit: template.expectedBenefit,
        state: targetState,
        schedule: template.defaultSchedule ?? {
          frequencyPerWeek: 5,
          targetTimesOfDay: [timeOfDay],
          startsOn: todayISO(),
        },
        reminderRule: {
          reminderTimeLocal:
            reminderTimeForSlot[timeOfDay] ?? "08:00",
          timezone,
          pushEnabled: true,
        },
        streakCount: 0,
        completionRate30d: 0,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };

      setHabits((prev) => [newHabit, ...prev]);
    },
    []
  );

  const completeToday = useCallback((habitId: string) => {
    setCompletedTodayIds((prev) => {
      const next = new Set(prev);
      const wasCompleted = next.has(habitId);
      if (wasCompleted) {
        next.delete(habitId);
      } else {
        next.add(habitId);
      }
      setHabits((hs) =>
        hs.map((h) => {
          if (h.habitId !== habitId) return h;
          return {
            ...h,
            streakCount: wasCompleted
              ? Math.max(0, h.streakCount - 1)
              : h.streakCount + 1,
            updatedAt: nowISO(),
          };
        })
      );
      return next;
    });
  }, []);

  const updateHabitState = useCallback(
    (habitId: string, state: HabitState) => {
      setHabits((prev) =>
        prev.map((h) =>
          h.habitId === habitId ? { ...h, state, updatedAt: nowISO() } : h
        )
      );
    },
    []
  );

  const isHabitAddedFromTemplate = useCallback(
    (templateId: string) =>
      habits.some((h) => h.templateId === templateId),
    [habits]
  );

  const addSupplementHabit = useCallback(
    (title: string, category: string, productId: string) => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const newHabit: UserHabit = {
        habitId: generateId(),
        userId: "current-user",
        templateId: undefined,
        title: `Take ${title}`,
        category,
        expectedBenefit: "Daily supplement tracking.",
        state: "active",
        schedule: {
          frequencyPerWeek: 7,
          targetTimesOfDay: ["morning"],
          startsOn: todayISO(),
        },
        reminderRule: {
          reminderTimeLocal: "08:00",
          timezone,
          pushEnabled: true,
        },
        streakCount: 0,
        completionRate30d: 0,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };
      setHabits((prev) => [newHabit, ...prev]);
    },
    []
  );

  const isProductTracked = useCallback(
    (productId: string) =>
      habits.some((h) => h.title.includes(productId) || h.habitId === productId),
    [habits]
  );

  const addCustomHabit = useCallback(
    (title: string, category: string, state: "active" | "planned") => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const newHabit: UserHabit = {
        habitId: generateId(),
        userId: "current-user",
        templateId: undefined,
        title,
        category,
        expectedBenefit: "Custom habit.",
        state,
        schedule: { frequencyPerWeek: 7, targetTimesOfDay: ["morning"], startsOn: todayISO() },
        reminderRule: { reminderTimeLocal: "08:00", timezone, pushEnabled: false },
        streakCount: 0,
        completionRate30d: 0,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };
      setHabits((prev) => [newHabit, ...prev]);
    },
    []
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
        addHabitFromTemplate,
        completeToday,
        updateHabitState,
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
