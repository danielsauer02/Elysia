import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type SleepStageId = "deep" | "rem" | "light" | "awake";

export type SleepMetricId =
  | "score"
  | "timeAsleep"
  | "deep"
  | "rem"
  | "light"
  | "awake"
  | "hr"
  | "hrv"
  | "rr"
  | "spo2"
  | "efficiency"
  | "consistency"
  | "performance"
  | "stress"
  | "debt"
  | "timeToFallAsleep"
  | "hrDip";

export interface SleepContextValue {
  /** ISO YYYY-MM-DD of the currently selected day (default today). */
  selectedDay: string;
  setSelectedDay: (day: string) => void;
  /** Stage currently highlighted in the stages chart, or null. */
  selectedStage: SleepStageId | null;
  setSelectedStage: (stage: SleepStageId | null) => void;
  toggleStage: (stage: SleepStageId) => void;
  /** Inclusive [from, to] in ISO YYYY-MM-DD of the visible week. */
  weekRange: { from: string; to: string };
}

const SleepContext = createContext<SleepContextValue | null>(null);

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekRangeFor(day: string): { from: string; to: string } {
  const end = new Date(`${day}T00:00:00Z`);
  const start = new Date(end.getTime() - 6 * 86_400_000);
  return { from: start.toISOString().slice(0, 10), to: day };
}

export function SleepProvider({ children }: { children: ReactNode }) {
  const [selectedDay, setSelectedDay] = useState<string>(todayUtc());
  const [selectedStage, setSelectedStage] = useState<SleepStageId | null>(null);

  const toggleStage = useCallback((stage: SleepStageId) => {
    setSelectedStage((prev) => (prev === stage ? null : stage));
  }, []);

  const weekRange = useMemo(() => weekRangeFor(selectedDay), [selectedDay]);

  const value = useMemo<SleepContextValue>(
    () => ({
      selectedDay,
      setSelectedDay,
      selectedStage,
      setSelectedStage,
      toggleStage,
      weekRange,
    }),
    [selectedDay, selectedStage, toggleStage, weekRange]
  );

  return <SleepContext.Provider value={value}>{children}</SleepContext.Provider>;
}

export function useSleepContext(): SleepContextValue {
  const ctx = useContext(SleepContext);
  if (!ctx) {
    throw new Error("useSleepContext must be used within <SleepProvider>");
  }
  return ctx;
}
