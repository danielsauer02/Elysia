/**
 * Per-provider normalizers translating vendor responses into the canonical
 * `wearableSamples` / `wearableWorkouts` shape used by convex/wearables.ts.
 *
 * Each normalizer is a pure function (no I/O) that takes the raw API response
 * and emits arrays of CanonicalSample / CanonicalWorkout. Vendor-specific
 * actions in convex/integrations.ts call these functions before invoking
 * `internal.wearables.ingestSamplesForUserInternal`.
 */

export type CanonicalSampleInput = {
  source: string;
  sampleId: string;
  metricType: string;
  startTime: string;
  endTime: string;
  value: number;
  unit: string;
  stage?: string;
  sourceDevice?: string;
  sourceApp?: string;
};

export type CanonicalWorkoutInput = {
  source: string;
  sourceWorkoutId: string;
  activityType: string;
  startTime: string;
  endTime: string;
  durationSec: number;
  activeKcal?: number;
  distanceM?: number;
  hrAvgBpm?: number;
  hrMaxBpm?: number;
  sourceDevice?: string;
};

// ─── Whoop ──────────────────────────────────────────────────────────────────

type WhoopRecovery = {
  cycle_id: number;
  sleep_id: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  score_state?: string;
  score?: {
    user_calibrating?: boolean;
    recovery_score?: number;
    resting_heart_rate?: number;
    hrv_rmssd_milli?: number;
    spo2_percentage?: number;
    skin_temp_celsius?: number;
  };
};

type WhoopSleep = {
  id: string;
  cycle_id: number;
  user_id: number;
  start: string;
  end: string;
  score_state?: string;
  score?: {
    stage_summary?: {
      total_in_bed_time_milli?: number;
      total_awake_time_milli?: number;
      total_light_sleep_time_milli?: number;
      total_slow_wave_sleep_time_milli?: number;
      total_rem_sleep_time_milli?: number;
    };
    respiratory_rate?: number;
    sleep_performance_percentage?: number;
    sleep_consistency_percentage?: number;
    sleep_efficiency_percentage?: number;
  };
};

/**
 * Whoop physiological cycle. Cycles are sleep-onset-to-sleep-onset, not
 * calendar days; the `score.kilojoule` field is the *total* daily energy
 * expenditure (basal + active + workouts).
 */
type WhoopCycle = {
  id: number;
  user_id: number;
  start: string;
  end?: string;
  score_state?: string;
  score?: {
    strain?: number;
    kilojoule?: number;
    average_heart_rate?: number;
    max_heart_rate?: number;
  };
};

type WhoopWorkout = {
  id: string;
  start: string;
  end: string;
  sport_id?: number | string;
  score?: { strain?: number; average_heart_rate?: number; max_heart_rate?: number; kilojoule?: number; distance_meter?: number };
};

export function normalizeWhoopRecoveries(items: WhoopRecovery[]): CanonicalSampleInput[] {
  const out: CanonicalSampleInput[] = [];
  for (const r of items) {
    const ts = r.updated_at || r.created_at;
    if (!ts || !r.score) continue;
    if (typeof r.score.hrv_rmssd_milli === "number") {
      out.push({
        source: "whoop",
        sampleId: `whoop_recovery_${r.cycle_id}_hrv`,
        metricType: "hrv_sdnn",
        startTime: ts,
        endTime: ts,
        value: r.score.hrv_rmssd_milli,
        unit: "ms",
      });
    }
    if (typeof r.score.resting_heart_rate === "number") {
      out.push({
        source: "whoop",
        sampleId: `whoop_recovery_${r.cycle_id}_rhr`,
        metricType: "resting_heart_rate",
        startTime: ts,
        endTime: ts,
        value: r.score.resting_heart_rate,
        unit: "bpm",
      });
    }
    if (typeof r.score.spo2_percentage === "number") {
      out.push({
        source: "whoop",
        sampleId: `whoop_recovery_${r.cycle_id}_spo2`,
        metricType: "oxygen_saturation",
        startTime: ts,
        endTime: ts,
        value: r.score.spo2_percentage,
        unit: "percent",
      });
    }
    if (typeof r.score.skin_temp_celsius === "number") {
      out.push({
        source: "whoop",
        sampleId: `whoop_recovery_${r.cycle_id}_skintemp`,
        metricType: "skin_temperature",
        startTime: ts,
        endTime: ts,
        value: r.score.skin_temp_celsius,
        unit: "celsius",
      });
    }
  }
  return out;
}

export function normalizeWhoopSleeps(items: WhoopSleep[]): CanonicalSampleInput[] {
  const out: CanonicalSampleInput[] = [];
  for (const s of items) {
    const summary = s.score?.stage_summary;
    if (!summary) continue;
    const stagesMillis: Array<["light" | "deep" | "rem" | "awake", number]> = [
      ["light", summary.total_light_sleep_time_milli ?? 0],
      ["deep", summary.total_slow_wave_sleep_time_milli ?? 0],
      ["rem", summary.total_rem_sleep_time_milli ?? 0],
      ["awake", summary.total_awake_time_milli ?? 0],
    ];
    for (const [stage, ms] of stagesMillis) {
      if (ms <= 0) continue;
      out.push({
        source: "whoop",
        sampleId: `whoop_sleep_${s.id}_${stage}`,
        metricType: "sleep_stage",
        startTime: s.start,
        endTime: s.end,
        value: Math.round(ms / 60000),
        unit: "min",
        stage,
      });
    }
    if (typeof s.score?.respiratory_rate === "number") {
      out.push({
        source: "whoop",
        sampleId: `whoop_sleep_${s.id}_resp`,
        metricType: "respiratory_rate",
        startTime: s.start,
        endTime: s.end,
        value: s.score.respiratory_rate,
        unit: "bpm",
      });
    }
    if (typeof s.score?.sleep_performance_percentage === "number") {
      out.push({
        source: "whoop",
        sampleId: `whoop_sleep_${s.id}_perf`,
        metricType: "sleep_performance",
        startTime: s.start,
        endTime: s.end,
        value: s.score.sleep_performance_percentage,
        unit: "percent",
      });
    }
    if (typeof s.score?.sleep_efficiency_percentage === "number") {
      out.push({
        source: "whoop",
        sampleId: `whoop_sleep_${s.id}_eff`,
        metricType: "sleep_efficiency",
        startTime: s.start,
        endTime: s.end,
        value: s.score.sleep_efficiency_percentage,
        unit: "percent",
      });
    }
    if (typeof s.score?.sleep_consistency_percentage === "number") {
      out.push({
        source: "whoop",
        sampleId: `whoop_sleep_${s.id}_cons`,
        metricType: "sleep_consistency",
        startTime: s.start,
        endTime: s.end,
        value: s.score.sleep_consistency_percentage,
        unit: "percent",
      });
    }
  }
  return out;
}

function numOrUndef(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/**
 * One Whoop cycle ≈ one calendar day's worth of physiology. Emits two
 * canonical samples: total_calories (kJ → kcal) and strain. Open cycles
 * (no `end` yet) use the current time as the end so today's tile starts
 * populating as soon as the day's first cycle data is available.
 */
export function normalizeWhoopCycles(items: WhoopCycle[]): CanonicalSampleInput[] {
  const out: CanonicalSampleInput[] = [];
  const nowIso = new Date().toISOString();
  for (const c of items) {
    if (c.score_state && c.score_state !== "SCORED") continue;
    if (!c.score) continue;
    const startTime = c.start;
    const endTime = c.end ?? nowIso;

    const kj = numOrUndef(c.score.kilojoule);
    if (kj !== undefined && kj > 0) {
      out.push({
        source: "whoop",
        sampleId: `whoop_cycle_${c.id}_kcal`,
        metricType: "total_calories",
        startTime,
        endTime,
        value: Math.round(kj / 4.184),
        unit: "kcal",
      });
    }

    const strain = numOrUndef(c.score.strain);
    if (strain !== undefined) {
      out.push({
        source: "whoop",
        sampleId: `whoop_cycle_${c.id}_strain`,
        metricType: "strain",
        startTime,
        endTime,
        value: strain,
        unit: "score",
      });
    }
  }
  return out;
}

export function normalizeWhoopWorkouts(items: WhoopWorkout[]): CanonicalWorkoutInput[] {
  return items.map((w) => {
    const startMs = Date.parse(w.start);
    const endMs = Date.parse(w.end);
    const sec = Number.isFinite(startMs) && Number.isFinite(endMs) ? Math.round((endMs - startMs) / 1000) : 0;
    const kj = numOrUndef(w.score?.kilojoule);
    return {
      source: "whoop",
      sourceWorkoutId: `whoop_${w.id}`,
      activityType: String(w.sport_id ?? "other"),
      startTime: w.start,
      endTime: w.end,
      durationSec: sec,
      activeKcal: kj !== undefined ? Math.round(kj / 4.184) : undefined,
      distanceM: numOrUndef(w.score?.distance_meter),
      hrAvgBpm: numOrUndef(w.score?.average_heart_rate),
      hrMaxBpm: numOrUndef(w.score?.max_heart_rate),
    };
  });
}

// ─── Oura ────────────────────────────────────────────────────────────────────

type OuraDailyReadiness = {
  id: string;
  day: string;
  score?: number;
  timestamp?: string;
  contributors?: Record<string, number>;
};

type OuraDailySleep = {
  id: string;
  day: string;
  bedtime_start?: string;
  bedtime_end?: string;
  total_sleep_duration?: number;
  deep_sleep_duration?: number;
  light_sleep_duration?: number;
  rem_sleep_duration?: number;
  awake_duration?: number;
  average_hrv?: number;
  average_heart_rate?: number;
  lowest_heart_rate?: number;
  respiratory_rate?: number;
};

type OuraDailyActivity = {
  id: string;
  day: string;
  steps?: number;
  active_calories?: number;
  total_calories?: number;
  equivalent_walking_distance?: number;
  timestamp?: string;
};

export function normalizeOuraSleeps(items: OuraDailySleep[]): CanonicalSampleInput[] {
  const out: CanonicalSampleInput[] = [];
  for (const s of items) {
    const start = s.bedtime_start;
    const end = s.bedtime_end;
    if (!start || !end) continue;
    const stages: Array<["light" | "deep" | "rem" | "awake", number | undefined]> = [
      ["light", s.light_sleep_duration],
      ["deep", s.deep_sleep_duration],
      ["rem", s.rem_sleep_duration],
      ["awake", s.awake_duration],
    ];
    for (const [stage, sec] of stages) {
      if (!sec || sec <= 0) continue;
      out.push({
        source: "oura",
        sampleId: `oura_sleep_${s.id}_${stage}`,
        metricType: "sleep_stage",
        startTime: start,
        endTime: end,
        value: Math.round(sec / 60),
        unit: "min",
        stage,
      });
    }
    if (typeof s.average_hrv === "number") {
      out.push({
        source: "oura",
        sampleId: `oura_sleep_${s.id}_hrv`,
        metricType: "hrv_sdnn",
        startTime: end,
        endTime: end,
        value: s.average_hrv,
        unit: "ms",
      });
    }
    if (typeof s.lowest_heart_rate === "number") {
      out.push({
        source: "oura",
        sampleId: `oura_sleep_${s.id}_rhr`,
        metricType: "resting_heart_rate",
        startTime: end,
        endTime: end,
        value: s.lowest_heart_rate,
        unit: "bpm",
      });
    }
    if (typeof s.respiratory_rate === "number") {
      out.push({
        source: "oura",
        sampleId: `oura_sleep_${s.id}_resp`,
        metricType: "respiratory_rate",
        startTime: end,
        endTime: end,
        value: s.respiratory_rate,
        unit: "bpm",
      });
    }
  }
  return out;
}

export function normalizeOuraActivity(items: OuraDailyActivity[]): CanonicalSampleInput[] {
  const out: CanonicalSampleInput[] = [];
  for (const a of items) {
    const dayStart = `${a.day}T00:00:00.000Z`;
    const dayEnd = `${a.day}T23:59:59.999Z`;
    if (typeof a.steps === "number" && a.steps > 0) {
      out.push({
        source: "oura",
        sampleId: `oura_activity_${a.id}_steps`,
        metricType: "steps",
        startTime: dayStart,
        endTime: dayEnd,
        value: a.steps,
        unit: "count",
      });
    }
    if (typeof a.active_calories === "number" && a.active_calories > 0) {
      out.push({
        source: "oura",
        sampleId: `oura_activity_${a.id}_active`,
        metricType: "active_calories",
        startTime: dayStart,
        endTime: dayEnd,
        value: a.active_calories,
        unit: "kcal",
      });
    }
    if (typeof a.equivalent_walking_distance === "number" && a.equivalent_walking_distance > 0) {
      out.push({
        source: "oura",
        sampleId: `oura_activity_${a.id}_dist`,
        metricType: "distance_m",
        startTime: dayStart,
        endTime: dayEnd,
        value: a.equivalent_walking_distance,
        unit: "m",
      });
    }
  }
  return out;
}

export function normalizeOuraReadiness(items: OuraDailyReadiness[]): CanonicalSampleInput[] {
  // Oura readiness already flows into HRV/RHR via sleep normalizer; we omit
  // a separate sample. Returning [] keeps the dispatcher uniform.
  return [];
}

// ─── Fitbit ──────────────────────────────────────────────────────────────────

type FitbitHrIntradayDataset = { time: string; value: number };
type FitbitActivitiesHeart = {
  "activities-heart": Array<{ dateTime: string; value: { restingHeartRate?: number } }>;
  "activities-heart-intraday"?: { dataset: FitbitHrIntradayDataset[]; datasetInterval?: number };
};

type FitbitDailyActivity = {
  summary?: {
    steps?: number;
    caloriesOut?: number;
    distances?: Array<{ activity: string; distance: number }>;
  };
  goals?: unknown;
};

export function normalizeFitbitHeart(
  date: string,
  payload: FitbitActivitiesHeart
): CanonicalSampleInput[] {
  const out: CanonicalSampleInput[] = [];
  const intraday = payload["activities-heart-intraday"]?.dataset ?? [];
  for (const sample of intraday) {
    const startTime = `${date}T${sample.time}.000Z`;
    out.push({
      source: "fitbit",
      sampleId: `fitbit_hr_${date}_${sample.time}`,
      metricType: "heart_rate",
      startTime,
      endTime: startTime,
      value: sample.value,
      unit: "bpm",
    });
  }
  const daily = payload["activities-heart"]?.[0];
  if (daily?.value?.restingHeartRate != null) {
    const startTime = `${date}T00:00:00.000Z`;
    out.push({
      source: "fitbit",
      sampleId: `fitbit_rhr_${date}`,
      metricType: "resting_heart_rate",
      startTime,
      endTime: startTime,
      value: daily.value.restingHeartRate,
      unit: "bpm",
    });
  }
  return out;
}

export function normalizeFitbitActivity(
  date: string,
  payload: FitbitDailyActivity
): CanonicalSampleInput[] {
  const out: CanonicalSampleInput[] = [];
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;
  if (payload.summary?.steps && payload.summary.steps > 0) {
    out.push({
      source: "fitbit",
      sampleId: `fitbit_steps_${date}`,
      metricType: "steps",
      startTime: dayStart,
      endTime: dayEnd,
      value: payload.summary.steps,
      unit: "count",
    });
  }
  if (payload.summary?.caloriesOut && payload.summary.caloriesOut > 0) {
    out.push({
      source: "fitbit",
      sampleId: `fitbit_active_${date}`,
      metricType: "active_calories",
      startTime: dayStart,
      endTime: dayEnd,
      value: payload.summary.caloriesOut,
      unit: "kcal",
    });
  }
  const totalDist = payload.summary?.distances?.find((d) => d.activity === "total");
  if (totalDist && totalDist.distance > 0) {
    out.push({
      source: "fitbit",
      sampleId: `fitbit_dist_${date}`,
      metricType: "distance_m",
      startTime: dayStart,
      endTime: dayEnd,
      value: Math.round(totalDist.distance * 1000),
      unit: "m",
    });
  }
  return out;
}
