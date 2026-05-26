/**
 * useLongevityData
 *
 * Pulls the three Convex queries that back the Elysia Age / Longevity
 * surface (calibration state, aging trajectory range, contribution totals)
 * and adapts them to the prop shape consumed by `LongevityPerformanceView`
 * and `AgingCurveChart`.
 *
 * Reactive: switching `timeFilter` re-derives `from`/`to` and the queries
 * refire. Returns `undefined` for any field still loading.
 */
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Ionicons } from "@expo/vector-icons";
import type {
  LongevityContribution,
  TimeFilter,
} from "@/components/ui/LongevityPerformanceView";

export type CalibrationState =
  | { status: "calibrating"; daysCalibrated: number; daysRequired: number; metrics?: Record<string, number>; updatedAt?: string }
  | { status: "ready"; daysCalibrated: number; daysRequired: number; metrics?: Record<string, number>; updatedAt?: string }
  | { status: "stale"; daysCalibrated: number; daysRequired: number; metrics?: Record<string, number>; updatedAt?: string };

const DAY_MS = 86400 * 1000;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function windowFor(timeFilter: TimeFilter): { from: string; to: string } {
  const today = new Date();
  const to = isoDay(today);
  const offsetDays: Record<TimeFilter, number> = {
    daily: 0,
    weekly: 6,
    monthly: 29,
    "6months": 179,
    all: 730,
  };
  const from = isoDay(new Date(today.getTime() - offsetDays[timeFilter] * DAY_MS));
  return { from, to };
}

/** Static icon mapping from pillar id -> Ionicons glyph. */
const PILLAR_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  sleep: "moon-outline",
  recovery: "medkit-outline",
  cardio: "heart-outline",
  activity: "barbell-outline",
  bodyBasic: "body-outline",
  nutrition: "nutrition-outline",
  habits: "checkbox-outline",
  // Tier 2/3
  blood: "water-outline",
  bodyComp: "fitness-outline",
  metabolic: "flame-outline",
  skin: "scan-outline",
  hair: "person-outline",
  genetic: "git-network-outline",
};

const PILLAR_LABELS: Record<string, string> = {
  sleep: "Sleep",
  recovery: "Recovery",
  cardio: "Cardio",
  activity: "Activity",
  bodyBasic: "Body",
  nutrition: "Nutrition",
  habits: "Habits",
  blood: "Blood Panel",
  bodyComp: "Body Comp",
  metabolic: "Metabolic Rate",
  skin: "Skin Age",
  hair: "Hair",
  genetic: "Genetics",
};

export interface UseLongevityDataResult {
  isReady: boolean;
  calibration?: CalibrationState;
  /** Latest computed Elysia Age, undefined if still calibrating / no data. */
  elysiaAge?: number;
  chronoAge?: number;
  velocity28d?: number;
  /** Latest 0..100 composite. Source of truth for the Longevity Battery. */
  composite?: number;
  /** Per-pillar 0..100 scores from today's dailyHealthScores row. */
  pillarScores?: Partial<Record<string, number | null>>;
  /** UI wheel-layer aggregates (v1.2.0+). */
  layerScores?: Partial<Record<string, number | null>>;
  /** 7-day composite trajectory classification. */
  trajectoryStatus?: "improving" | "stable" | "declining";
  /** Cached sum of today's longevity contribution minutes. */
  healthspanCreditsToday?: number;
  contributions: LongevityContribution[];
  /** Sum of `deltaMinutes` over the chosen window. */
  totalDeltaMinutes: number;
  /** Trajectory points for AgingCurveChart, chrono vs elysia per day. */
  trajectoryHistory: { day: string; chronoAge: number; elysiaAge: number }[];
}

export function useLongevityData(timeFilter: TimeFilter): UseLongevityDataResult {
  const { from, to } = useMemo(() => windowFor(timeFilter), [timeFilter]);

  const calibrationRaw = useQuery(api.scoring.getCalibrationState, {});
  const trajectory = useQuery(api.scoring.getAgingTrajectoryRange, { from, to });
  const latestTrajectory = useQuery(api.scoring.getLatestAgingTrajectory, {});
  const latestHealthScore = useQuery(api.scoring.getLatestHealthScore, {});
  const totalsResult = useQuery(api.scoring.getLongevityContributionTotals, {
    from,
    to,
  });

  const isReady =
    calibrationRaw !== undefined &&
    trajectory !== undefined &&
    latestTrajectory !== undefined &&
    latestHealthScore !== undefined &&
    totalsResult !== undefined;

  const calibration = calibrationRaw
    ? (calibrationRaw as CalibrationState)
    : undefined;

  // Wrap derived arrays in useMemo so React.memo on consumers (e.g.
  // `LongevityPerformanceView`) actually catches and skips unrelated
  // re-renders coming from sibling Convex updates.
  const trajectoryHistory = useMemo(
    () =>
      (trajectory ?? []).map((r) => ({
        day: r.day,
        chronoAge: r.chronoAge,
        elysiaAge: r.elysiaAge,
      })),
    [trajectory]
  );

  const contributions: LongevityContribution[] = useMemo(
    () =>
      (totalsResult?.totals ?? []).map((t) => ({
        category: t.pillar,
        label: PILLAR_LABELS[t.pillar] ?? t.pillar,
        deltaMinutes: t.deltaMinutes,
        icon: PILLAR_ICONS[t.pillar] ?? "ellipse-outline",
      })),
    [totalsResult]
  );

  const elysiaAge = latestTrajectory?.elysiaAge;
  const chronoAge = latestTrajectory?.chronoAge;
  const velocity28d = latestTrajectory?.velocity28d ?? undefined;

  const ts = latestHealthScore?.trajectoryStatus;
  const trajectoryStatus =
    ts === "improving" || ts === "stable" || ts === "declining" ? ts : undefined;

  // Stabilise the returned object so it changes identity only when something
  // it actually carries changed. This is what allows memoised consumers to
  // skip re-render fan-out across the entire dashboard.
  return useMemo(
    () => ({
      isReady,
      calibration,
      elysiaAge: elysiaAge ?? undefined,
      chronoAge: chronoAge ?? undefined,
      velocity28d,
      composite: latestHealthScore?.composite ?? undefined,
      pillarScores: (latestHealthScore?.pillarScores ?? undefined) as
        | Partial<Record<string, number | null>>
        | undefined,
      layerScores: (latestHealthScore?.layerScores ?? undefined) as
        | Partial<Record<string, number | null>>
        | undefined,
      trajectoryStatus,
      healthspanCreditsToday: latestHealthScore?.healthspanCreditsToday ?? undefined,
      contributions,
      totalDeltaMinutes: totalsResult?.totalDeltaMinutes ?? 0,
      trajectoryHistory,
    }),
    [
      isReady,
      calibration,
      elysiaAge,
      chronoAge,
      velocity28d,
      latestHealthScore,
      trajectoryStatus,
      contributions,
      totalsResult,
      trajectoryHistory,
    ]
  );
}
