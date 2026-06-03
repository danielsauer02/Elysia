import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type RecoveryMetricId = "score" | "rhr" | "hrv" | "rr" | "temp" | "spo2";

export interface RecoveryContextValue {
  /** ISO YYYY-MM-DD of the currently selected day (default today). */
  selectedDay: string;
  setSelectedDay: (day: string) => void;
  /** Inclusive [from, to] in ISO YYYY-MM-DD of the visible week. */
  weekRange: { from: string; to: string };
}

const RecoveryContext = createContext<RecoveryContextValue | null>(null);

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekRangeFor(day: string): { from: string; to: string } {
  const end = new Date(`${day}T00:00:00Z`);
  const start = new Date(end.getTime() - 6 * 86_400_000);
  return { from: start.toISOString().slice(0, 10), to: day };
}

export function RecoveryProvider({ children }: { children: ReactNode }) {
  const [selectedDay, setSelectedDay] = useState<string>(todayUtc());
  const weekRange = useMemo(() => weekRangeFor(selectedDay), [selectedDay]);

  const value = useMemo<RecoveryContextValue>(
    () => ({ selectedDay, setSelectedDay, weekRange }),
    [selectedDay, weekRange]
  );

  return (
    <RecoveryContext.Provider value={value}>{children}</RecoveryContext.Provider>
  );
}

export function useRecoveryContext(): RecoveryContextValue {
  const ctx = useContext(RecoveryContext);
  if (!ctx) {
    throw new Error("useRecoveryContext must be used within <RecoveryProvider>");
  }
  return ctx;
}
