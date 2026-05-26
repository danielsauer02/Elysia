/**
 * Unified Health Data Reader
 *
 * Abstracts iOS Apple HealthKit (via react-native-health) and Android
 * Google Health Connect (via react-native-health-connect) behind a single
 * canonical sample shape that maps 1:1 to convex/wearables.ts ingestion.
 *
 * Falls back gracefully in Expo Go (no native modules) so dev builds and
 * the JS bundler do not break.
 */

import { Linking, Platform } from "react-native";

// ─── Permission result types ─────────────────────────────────────────────────

export type HealthPermissionReason =
  | "not_supported"
  | "not_installed"
  | "update_required"
  | "no_permissions_granted"
  | "error";

export type HealthPermissionResult =
  | { ok: true; granted: string[]; partial: boolean; totalRequested: number }
  | { ok: false; reason: HealthPermissionReason; detail?: string };

/** Play Store package id of the Google Health Connect provider app. */
export const HEALTH_CONNECT_PACKAGE = "com.google.android.apps.healthdata";

// ─── Canonical types (match convex/wearables.ts validators) ──────────────────

export type CanonicalMetric =
  | "heart_rate"
  | "resting_heart_rate"
  | "hrv_sdnn"
  | "steps"
  | "active_calories"
  | "basal_calories"
  | "distance_m"
  | "oxygen_saturation"
  | "respiratory_rate"
  | "sleep_stage"
  | "vo2_max";

export type CanonicalSample = {
  source: "apple_health" | "health_connect";
  sampleId: string;
  metricType: CanonicalMetric;
  startTime: string;
  endTime: string;
  value: number;
  unit: string;
  stage?: "light" | "deep" | "rem" | "awake";
  sourceDevice?: string;
  sourceApp?: string;
};

export type CanonicalWorkout = {
  source: "apple_health" | "health_connect";
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

/** Legacy quick read (kept for backwards compat with current dashboard until UI swap). */
export interface HealthData {
  steps: number | null;
  heartRateBpm: number | null;
  hrvMs: number | null;
  sleepHours: number | null;
  activeCalories: number | null;
  restingHeartRateBpm: number | null;
  lastUpdated: string | null;
}

const EMPTY_HEALTH_DATA: HealthData = {
  steps: null,
  heartRateBpm: null,
  hrvMs: null,
  sleepHours: null,
  activeCalories: null,
  restingHeartRateBpm: null,
  lastUpdated: null,
};

export const HEALTH_METRICS: CanonicalMetric[] = [
  "heart_rate",
  "resting_heart_rate",
  "hrv_sdnn",
  "steps",
  "active_calories",
  "basal_calories",
  "distance_m",
  "oxygen_saturation",
  "respiratory_rate",
  "sleep_stage",
  "vo2_max",
];

// ─── Availability ───────────────────────────────────────────────────────────

export function isHealthAvailable(): boolean {
  try {
    if (Platform.OS === "ios") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const AppleHealthKit = require("react-native-health").default;
      return AppleHealthKit != null;
    }
    if (Platform.OS === "android") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const hc = require("react-native-health-connect");
      return hc != null;
    }
    return false;
  } catch {
    return false;
  }
}

// ─── iOS - Apple HealthKit ──────────────────────────────────────────────────

function getAppleHealth(): { kit: any; perms: any } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-health");
    return { kit: mod.default, perms: mod.Permissions };
  } catch {
    return null;
  }
}

export async function requestHealthPermissionsIOS(): Promise<HealthPermissionResult> {
  return new Promise((resolve) => {
    try {
      const ah = getAppleHealth();
      if (!ah) {
        resolve({ ok: false, reason: "not_supported", detail: "Apple HealthKit module unavailable" });
        return;
      }
      const { kit, perms } = ah;
      const reads = [
        perms.Steps,
        perms.HeartRate,
        perms.RestingHeartRate,
        perms.HeartRateVariability,
        perms.SleepAnalysis,
        perms.ActiveEnergyBurned,
        perms.BasalEnergyBurned,
        perms.DistanceWalkingRunning,
        perms.OxygenSaturation,
        perms.RespiratoryRate,
        perms.Vo2Max,
        perms.Workout,
      ].filter(Boolean);
      const options = { permissions: { read: reads, write: [] } };
      kit.initHealthKit(options, (err: unknown) => {
        if (err) {
          // HealthKit does not tell us which permissions the user denied,
          // only that init failed. Treat any error as "no permissions"; the
          // user can grant in iOS Settings → Privacy → Health → Elysia.
          resolve({ ok: false, reason: "no_permissions_granted", detail: String(err) });
          return;
        }
        resolve({
          ok: true,
          granted: ["all"],
          partial: false,
          totalRequested: reads.length,
        });
      });
    } catch (e) {
      resolve({ ok: false, reason: "error", detail: e instanceof Error ? e.message : String(e) });
    }
  });
}

type HKQuantityFn = (
  options: { startDate: string; endDate: string; ascending?: boolean; limit?: number },
  cb: (err: unknown, results: Array<HKQuantityResult>) => void
) => void;

type HKQuantityResult = {
  value?: number;
  startDate?: string;
  endDate?: string;
  metadata?: { HKMetadataKeyExternalUUID?: string } & Record<string, unknown>;
  sourceId?: string;
  sourceName?: string;
};

const HK_FN_BY_METRIC: Record<CanonicalMetric, string | null> = {
  heart_rate: "getHeartRateSamples",
  resting_heart_rate: "getRestingHeartRateSamples",
  hrv_sdnn: "getHeartRateVariabilitySamples",
  steps: "getDailyStepCountSamples",
  active_calories: "getActiveEnergyBurned",
  basal_calories: "getBasalEnergyBurned",
  distance_m: "getDailyDistanceWalkingRunningSamples",
  oxygen_saturation: "getOxygenSaturationSamples",
  respiratory_rate: "getRespiratoryRateSamples",
  vo2_max: "getVo2MaxSamples",
  // Sleep is handled separately via getSleepSamples (category type).
  sleep_stage: null,
};

const HK_UNIT_BY_METRIC: Record<CanonicalMetric, string> = {
  heart_rate: "bpm",
  resting_heart_rate: "bpm",
  hrv_sdnn: "ms",
  steps: "count",
  active_calories: "kcal",
  basal_calories: "kcal",
  distance_m: "m",
  oxygen_saturation: "percent",
  respiratory_rate: "bpm",
  vo2_max: "ml/kg/min",
  sleep_stage: "min",
};

export async function readSamplesIOS(
  metric: CanonicalMetric,
  start: string,
  end: string
): Promise<CanonicalSample[]> {
  if (metric === "sleep_stage") return readSleepIOS(start, end);
  const ah = getAppleHealth();
  if (!ah) return [];
  const fnName = HK_FN_BY_METRIC[metric];
  if (!fnName) return [];
  const fn = (ah.kit as Record<string, unknown>)[fnName] as HKQuantityFn | undefined;
  if (typeof fn !== "function") return [];

  return new Promise<CanonicalSample[]>((resolve) => {
    fn(
      { startDate: start, endDate: end, ascending: true, limit: 100000 },
      (_err, results) => {
        if (!Array.isArray(results)) return resolve([]);
        const unit = HK_UNIT_BY_METRIC[metric];
        const samples: CanonicalSample[] = [];
        for (const r of results) {
          const startTime = r.startDate ?? start;
          const endTime = r.endDate ?? startTime;
          const value = typeof r.value === "number" ? r.value : 0;
          if (metric === "distance_m") {
            // HealthKit returns meters by default for distance walking/running.
          }
          const sampleId =
            r.metadata?.HKMetadataKeyExternalUUID ||
            stableId(["apple_health", metric, startTime, endTime, String(value)]);
          samples.push({
            source: "apple_health",
            sampleId,
            metricType: metric,
            startTime,
            endTime,
            value,
            unit,
            sourceDevice: r.sourceName,
            sourceApp: r.sourceId,
          });
        }
        resolve(samples);
      }
    );
  });
}

type HKSleepResult = {
  startDate: string;
  endDate: string;
  value?: string;
  sourceName?: string;
  sourceId?: string;
};

function mapAppleSleepValue(v: string | undefined): "light" | "deep" | "rem" | "awake" | null {
  switch ((v ?? "").toUpperCase()) {
    case "ASLEEP":
    case "INBED":
    case "ASLEEPCORE":
    case "CORE":
      return "light";
    case "ASLEEPDEEP":
    case "DEEP":
      return "deep";
    case "ASLEEPREM":
    case "REM":
      return "rem";
    case "AWAKE":
      return "awake";
    default:
      return null;
  }
}

async function readSleepIOS(start: string, end: string): Promise<CanonicalSample[]> {
  const ah = getAppleHealth();
  if (!ah) return [];
  const kit = ah.kit as { getSleepSamples?: (opts: any, cb: (err: unknown, r: HKSleepResult[]) => void) => void };
  if (typeof kit.getSleepSamples !== "function") return [];

  return new Promise((resolve) => {
    kit.getSleepSamples!(
      { startDate: start, endDate: end, limit: 10000 },
      (_err, results) => {
        if (!Array.isArray(results)) return resolve([]);
        const samples: CanonicalSample[] = [];
        for (const r of results) {
          const stage = mapAppleSleepValue(r.value);
          if (!stage) continue;
          const startTime = r.startDate;
          const endTime = r.endDate;
          const minutes = Math.max(
            0,
            (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000
          );
          samples.push({
            source: "apple_health",
            sampleId: stableId(["apple_health", "sleep_stage", startTime, endTime, stage]),
            metricType: "sleep_stage",
            startTime,
            endTime,
            value: minutes,
            unit: "min",
            stage,
            sourceDevice: r.sourceName,
            sourceApp: r.sourceId,
          });
        }
        resolve(samples);
      }
    );
  });
}

type HKWorkoutResult = {
  startDate: string;
  endDate: string;
  duration?: number;
  activityName?: string;
  totalEnergyBurned?: number;
  totalDistance?: number;
  metadata?: { HKMetadataKeyExternalUUID?: string };
  sourceName?: string;
  sourceId?: string;
};

export async function readWorkoutsIOS(
  start: string,
  end: string
): Promise<CanonicalWorkout[]> {
  const ah = getAppleHealth();
  if (!ah) return [];
  const kit = ah.kit as { getSamples?: (opts: any, cb: (err: unknown, r: HKWorkoutResult[]) => void) => void };
  if (typeof kit.getSamples !== "function") return [];
  return new Promise((resolve) => {
    kit.getSamples!(
      {
        startDate: start,
        endDate: end,
        type: "Workout",
        limit: 1000,
      },
      (_err, results) => {
        if (!Array.isArray(results)) return resolve([]);
        const out: CanonicalWorkout[] = results.map((w) => ({
          source: "apple_health",
          sourceWorkoutId:
            w.metadata?.HKMetadataKeyExternalUUID ||
            stableId(["apple_health", "workout", w.startDate, w.endDate]),
          activityType: normalizeActivityName(w.activityName),
          startTime: w.startDate,
          endTime: w.endDate,
          durationSec: Math.round(
            w.duration ??
              (new Date(w.endDate).getTime() - new Date(w.startDate).getTime()) / 1000
          ),
          activeKcal: w.totalEnergyBurned,
          distanceM: w.totalDistance,
          sourceDevice: w.sourceName,
        }));
        resolve(out);
      }
    );
  });
}

// ─── Android - Health Connect ───────────────────────────────────────────────

function getHealthConnect(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-health-connect");
  } catch {
    return null;
  }
}

const HC_RECORD_TYPES_TO_REQUEST: Array<{ accessType: "read"; recordType: string }> = [
  { accessType: "read", recordType: "Steps" },
  { accessType: "read", recordType: "HeartRate" },
  { accessType: "read", recordType: "RestingHeartRate" },
  { accessType: "read", recordType: "HeartRateVariabilityRmssd" },
  { accessType: "read", recordType: "SleepSession" },
  { accessType: "read", recordType: "ActiveCaloriesBurned" },
  { accessType: "read", recordType: "BasalMetabolicRate" },
  { accessType: "read", recordType: "Distance" },
  { accessType: "read", recordType: "OxygenSaturation" },
  { accessType: "read", recordType: "RespiratoryRate" },
  { accessType: "read", recordType: "Vo2Max" },
  { accessType: "read", recordType: "ExerciseSession" },
];

export async function requestHealthPermissionsAndroid(): Promise<HealthPermissionResult> {
  const hc = getHealthConnect();
  if (!hc) {
    return { ok: false, reason: "not_supported", detail: "Module unavailable" };
  }
  try {
    // Probe SDK availability FIRST so we can tell the user whether to install
    // or update the Health Connect provider app. Without this, `initialize()`
    // returns false for a missing provider and we cannot distinguish that
    // from a runtime error.
    if (typeof hc.getSdkStatus === "function") {
      const status: number = await hc.getSdkStatus();
      const SDK_AVAILABLE = hc.SdkAvailabilityStatus?.SDK_AVAILABLE ?? 3;
      const SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED =
        hc.SdkAvailabilityStatus?.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED ?? 2;
      if (status === SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
        return { ok: false, reason: "update_required" };
      }
      if (status !== SDK_AVAILABLE) {
        return { ok: false, reason: "not_installed" };
      }
    }

    const initialized = await hc.initialize();
    if (!initialized) {
      return { ok: false, reason: "not_installed" };
    }

    const granted: unknown = await hc.requestPermission(HC_RECORD_TYPES_TO_REQUEST);
    const grantedTypes: string[] = Array.isArray(granted)
      ? granted
          .map((g) => {
            if (typeof g === "string") return g;
            if (g && typeof g === "object" && "recordType" in g) {
              return String((g as { recordType: unknown }).recordType ?? "");
            }
            return "";
          })
          .filter(Boolean)
      : [];

    if (grantedTypes.length === 0) {
      return { ok: false, reason: "no_permissions_granted" };
    }
    return {
      ok: true,
      granted: grantedTypes,
      partial: grantedTypes.length < HC_RECORD_TYPES_TO_REQUEST.length,
      totalRequested: HC_RECORD_TYPES_TO_REQUEST.length,
    };
  } catch (e) {
    return {
      ok: false,
      reason: "error",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Opens the Health Connect provider's per-app permissions screen so the user
 * can manually grant whatever was denied (or revoked).
 */
export async function openHealthConnectSettings(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  const hc = getHealthConnect();
  if (!hc) return false;
  // The library exposes `openHealthConnectSettings` (provider settings) and,
  // depending on version, `openHealthConnectDataManagement`. Prefer the
  // settings screen; fall back to the data management UI; finally fall back
  // to launching the package via implicit Intent so we at least surface the
  // Health Connect app instead of leaving the user stranded.
  try {
    if (typeof hc.openHealthConnectSettings === "function") {
      await hc.openHealthConnectSettings();
      return true;
    }
    if (typeof hc.openHealthConnectDataManagement === "function") {
      await hc.openHealthConnectDataManagement();
      return true;
    }
  } catch {
    /* fall through to package launch */
  }
  try {
    const ok = await Linking.openURL(`package:${HEALTH_CONNECT_PACKAGE}`);
    return Boolean(ok);
  } catch {
    return false;
  }
}

/**
 * Opens the Play Store listing for the Health Connect provider so users on
 * devices without it (or running an outdated version) can install/update.
 * Falls back to the https Play Store URL when the Play Store app is missing.
 */
export async function openHealthConnectPlayStore(): Promise<boolean> {
  const market = `market://details?id=${HEALTH_CONNECT_PACKAGE}`;
  const https = `https://play.google.com/store/apps/details?id=${HEALTH_CONNECT_PACKAGE}`;
  try {
    const canOpenMarket = await Linking.canOpenURL(market);
    await Linking.openURL(canOpenMarket ? market : https);
    return true;
  } catch {
    try {
      await Linking.openURL(https);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Opens iOS Settings → Health (where the user can re-toggle per-source
 * permissions if they denied the in-app prompt).
 */
export async function openIOSHealthSettings(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    await Linking.openURL("x-apple-health://");
    return true;
  } catch {
    try {
      await Linking.openSettings();
      return true;
    } catch {
      return false;
    }
  }
}

const HC_RECORD_BY_METRIC: Record<CanonicalMetric, string | null> = {
  heart_rate: "HeartRate",
  resting_heart_rate: "RestingHeartRate",
  hrv_sdnn: "HeartRateVariabilityRmssd",
  steps: "Steps",
  active_calories: "ActiveCaloriesBurned",
  basal_calories: "BasalMetabolicRate",
  distance_m: "Distance",
  oxygen_saturation: "OxygenSaturation",
  respiratory_rate: "RespiratoryRate",
  vo2_max: "Vo2Max",
  sleep_stage: "SleepSession",
};

export async function readSamplesAndroid(
  metric: CanonicalMetric,
  start: string,
  end: string
): Promise<CanonicalSample[]> {
  const hc = getHealthConnect();
  if (!hc) return [];
  const recordType = HC_RECORD_BY_METRIC[metric];
  if (!recordType) return [];

  try {
    const res = await hc.readRecords(recordType, {
      timeRangeFilter: { operator: "between", startTime: start, endTime: end },
    });
    const records = (res?.records ?? []) as Array<Record<string, unknown>>;
    return records.flatMap((r) => mapHCRecord(metric, recordType, r));
  } catch {
    return [];
  }
}

export async function readWorkoutsAndroid(
  start: string,
  end: string
): Promise<CanonicalWorkout[]> {
  const hc = getHealthConnect();
  if (!hc) return [];
  try {
    const res = await hc.readRecords("ExerciseSession", {
      timeRangeFilter: { operator: "between", startTime: start, endTime: end },
    });
    const records = (res?.records ?? []) as Array<{
      metadata?: { id?: string; dataOrigin?: string };
      startTime: string;
      endTime: string;
      exerciseType?: number | string;
      title?: string;
    }>;
    return records.map((r) => {
      const startTime = r.startTime;
      const endTime = r.endTime;
      const sec = Math.max(
        0,
        Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000)
      );
      return {
        source: "health_connect" as const,
        sourceWorkoutId:
          r.metadata?.id ||
          stableId(["health_connect", "workout", startTime, endTime]),
        activityType: normalizeActivityName(r.title || String(r.exerciseType ?? "other")),
        startTime,
        endTime,
        durationSec: sec,
        sourceDevice: r.metadata?.dataOrigin,
      };
    });
  } catch {
    return [];
  }
}

function mapHCRecord(
  metric: CanonicalMetric,
  recordType: string,
  r: Record<string, unknown>
): CanonicalSample[] {
  const meta = (r.metadata as { id?: string; dataOrigin?: string } | undefined) ?? {};
  const sourceApp = meta.dataOrigin;
  const id =
    meta.id ||
    stableId(["health_connect", metric, JSON.stringify(r).slice(0, 256)]);
  const unit = HC_UNIT_BY_METRIC[metric];

  if (recordType === "HeartRate") {
    const samples = (r.samples as Array<{ time: string; beatsPerMinute: number }>) ?? [];
    return samples.map((s) => ({
      source: "health_connect",
      sampleId: stableId([id, s.time]),
      metricType: metric,
      startTime: s.time,
      endTime: s.time,
      value: s.beatsPerMinute,
      unit,
      sourceApp,
    }));
  }

  if (recordType === "SleepSession") {
    const stages = (r.stages as Array<{ startTime: string; endTime: string; stage: number }>) ?? [];
    return stages.map((st) => {
      const stage = mapHCSleepStage(st.stage);
      const minutes =
        (new Date(st.endTime).getTime() - new Date(st.startTime).getTime()) / 60000;
      return {
        source: "health_connect" as const,
        sampleId: stableId([id, st.startTime, st.endTime, String(st.stage)]),
        metricType: "sleep_stage" as const,
        startTime: st.startTime,
        endTime: st.endTime,
        value: Math.max(0, minutes),
        unit: "min",
        stage: stage ?? undefined,
        sourceApp,
      };
    });
  }

  if (recordType === "Steps") {
    const startTime = (r.startTime as string) ?? new Date().toISOString();
    const endTime = (r.endTime as string) ?? startTime;
    return [
      {
        source: "health_connect",
        sampleId: id,
        metricType: metric,
        startTime,
        endTime,
        value: Number(r.count ?? 0),
        unit,
        sourceApp,
      },
    ];
  }

  if (recordType === "Distance") {
    const startTime = (r.startTime as string) ?? new Date().toISOString();
    const endTime = (r.endTime as string) ?? startTime;
    const dist = r.distance as { inMeters?: number } | undefined;
    return [
      {
        source: "health_connect",
        sampleId: id,
        metricType: "distance_m",
        startTime,
        endTime,
        value: Number(dist?.inMeters ?? 0),
        unit,
        sourceApp,
      },
    ];
  }

  if (recordType === "ActiveCaloriesBurned") {
    const startTime = (r.startTime as string) ?? new Date().toISOString();
    const endTime = (r.endTime as string) ?? startTime;
    const energy = r.energy as { inKilocalories?: number } | undefined;
    return [
      {
        source: "health_connect",
        sampleId: id,
        metricType: "active_calories",
        startTime,
        endTime,
        value: Number(energy?.inKilocalories ?? 0),
        unit,
        sourceApp,
      },
    ];
  }

  if (recordType === "BasalMetabolicRate") {
    const time = (r.time as string) ?? new Date().toISOString();
    const rate = r.basalMetabolicRate as { inKilocaloriesPerDay?: number } | undefined;
    return [
      {
        source: "health_connect",
        sampleId: id,
        metricType: "basal_calories",
        startTime: time,
        endTime: time,
        value: Number(rate?.inKilocaloriesPerDay ?? 0),
        unit: "kcal/day",
        sourceApp,
      },
    ];
  }

  if (recordType === "RestingHeartRate") {
    const time = (r.time as string) ?? new Date().toISOString();
    return [
      {
        source: "health_connect",
        sampleId: id,
        metricType: "resting_heart_rate",
        startTime: time,
        endTime: time,
        value: Number(r.beatsPerMinute ?? 0),
        unit,
        sourceApp,
      },
    ];
  }

  if (recordType === "HeartRateVariabilityRmssd") {
    const time = (r.time as string) ?? new Date().toISOString();
    return [
      {
        source: "health_connect",
        sampleId: id,
        metricType: "hrv_sdnn",
        startTime: time,
        endTime: time,
        value: Number(r.heartRateVariabilityMillis ?? 0),
        unit: "ms",
        sourceApp,
      },
    ];
  }

  if (recordType === "OxygenSaturation") {
    const time = (r.time as string) ?? new Date().toISOString();
    const pct = r.percentage as { value?: number } | undefined;
    return [
      {
        source: "health_connect",
        sampleId: id,
        metricType: "oxygen_saturation",
        startTime: time,
        endTime: time,
        value: Number(pct?.value ?? 0),
        unit,
        sourceApp,
      },
    ];
  }

  if (recordType === "RespiratoryRate") {
    const time = (r.time as string) ?? new Date().toISOString();
    return [
      {
        source: "health_connect",
        sampleId: id,
        metricType: "respiratory_rate",
        startTime: time,
        endTime: time,
        value: Number(r.rate ?? 0),
        unit,
        sourceApp,
      },
    ];
  }

  if (recordType === "Vo2Max") {
    const time = (r.time as string) ?? new Date().toISOString();
    return [
      {
        source: "health_connect",
        sampleId: id,
        metricType: "vo2_max",
        startTime: time,
        endTime: time,
        value: Number(r.vo2MillilitersPerMinuteKilogram ?? 0),
        unit,
        sourceApp,
      },
    ];
  }

  return [];
}

const HC_UNIT_BY_METRIC: Record<CanonicalMetric, string> = {
  heart_rate: "bpm",
  resting_heart_rate: "bpm",
  hrv_sdnn: "ms",
  steps: "count",
  active_calories: "kcal",
  basal_calories: "kcal/day",
  distance_m: "m",
  oxygen_saturation: "percent",
  respiratory_rate: "bpm",
  vo2_max: "ml/kg/min",
  sleep_stage: "min",
};

function mapHCSleepStage(code: number | string): "light" | "deep" | "rem" | "awake" | null {
  // Health Connect SleepSession stage codes:
  // 1=Awake, 2=Sleeping, 3=OutOfBed, 4=Light, 5=Deep, 6=REM, 7=Awake (in bed)
  const n = typeof code === "number" ? code : Number(code);
  switch (n) {
    case 1:
    case 7:
      return "awake";
    case 4:
      return "light";
    case 5:
      return "deep";
    case 6:
      return "rem";
    case 2:
      return "light";
    default:
      return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function requestHealthPermissions(): Promise<HealthPermissionResult> {
  if (!isHealthAvailable()) {
    return { ok: false, reason: "not_supported" };
  }
  if (Platform.OS === "ios") return requestHealthPermissionsIOS();
  if (Platform.OS === "android") return requestHealthPermissionsAndroid();
  return { ok: false, reason: "not_supported" };
}

export async function readSamples(
  metric: CanonicalMetric,
  start: string,
  end: string
): Promise<CanonicalSample[]> {
  if (!isHealthAvailable()) return [];
  if (Platform.OS === "ios") return readSamplesIOS(metric, start, end);
  if (Platform.OS === "android") return readSamplesAndroid(metric, start, end);
  return [];
}

export async function readWorkouts(
  start: string,
  end: string
): Promise<CanonicalWorkout[]> {
  if (!isHealthAvailable()) return [];
  if (Platform.OS === "ios") return readWorkoutsIOS(start, end);
  if (Platform.OS === "android") return readWorkoutsAndroid(start, end);
  return [];
}

/**
 * Legacy convenience for the existing dashboard quick view. New code should
 * prefer `readSamples` + Convex queries.
 */
export async function readTodayHealthData(): Promise<HealthData> {
  if (!isHealthAvailable()) return EMPTY_HEALTH_DATA;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  const startISO = start.toISOString();
  const endISO = end.toISOString();
  try {
    const [steps, hr, hrv, sleep, active, rhr] = await Promise.all([
      readSamples("steps", startISO, endISO),
      readSamples("heart_rate", startISO, endISO),
      readSamples("hrv_sdnn", startISO, endISO),
      readSamples("sleep_stage", startISO, endISO),
      readSamples("active_calories", startISO, endISO),
      readSamples("resting_heart_rate", startISO, endISO),
    ]);
    const sumSteps = steps.reduce((s, r) => s + r.value, 0);
    const lastHr = hr.at(-1)?.value ?? null;
    const avgHrv =
      hrv.length > 0 ? hrv.reduce((s, r) => s + r.value, 0) / hrv.length : null;
    const totalSleepMin = sleep
      .filter((s) => s.stage !== "awake")
      .reduce((s, r) => s + r.value, 0);
    const sleepHours = totalSleepMin > 0 ? Math.round((totalSleepMin / 60) * 10) / 10 : null;
    const activeKcal =
      active.length > 0 ? Math.round(active.reduce((s, r) => s + r.value, 0)) : null;
    const lastRhr = rhr.at(-1)?.value ?? null;
    return {
      steps: sumSteps > 0 ? sumSteps : null,
      heartRateBpm: typeof lastHr === "number" ? Math.round(lastHr) : null,
      hrvMs: avgHrv !== null ? Math.round(avgHrv) : null,
      sleepHours,
      activeCalories: activeKcal,
      restingHeartRateBpm: lastRhr !== null ? Math.round(lastRhr) : null,
      lastUpdated: end.toISOString(),
    };
  } catch {
    return EMPTY_HEALTH_DATA;
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

export function stableId(parts: Array<string>): string {
  // Tiny FNV-like hash, deterministic and dependency-free.
  let h = 0x811c9dc5;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) {
      h ^= p.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
  }
  return `id_${h.toString(16)}_${parts[0] ?? ""}_${(parts.at(-1) ?? "").slice(-12)}`;
}

function normalizeActivityName(raw: string | undefined | null): string {
  if (!raw) return "other";
  const lower = String(raw).toLowerCase();
  if (lower.includes("run")) return "running";
  if (lower.includes("walk")) return "walking";
  if (lower.includes("bike") || lower.includes("cycl")) return "cycling";
  if (lower.includes("swim")) return "swimming";
  if (lower.includes("strength") || lower.includes("lift")) return "strength";
  if (lower.includes("yoga")) return "yoga";
  if (lower.includes("hike")) return "hiking";
  if (lower.includes("hiit")) return "hiit";
  return lower.replace(/\s+/g, "_");
}
