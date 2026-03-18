/**
 * Unified Health Data Reader
 *
 * Abstracts platform differences between:
 *   iOS  → Apple HealthKit (via react-native-health)
 *   Android → Google Health Connect (via react-native-health-connect)
 *
 * Falls back gracefully when running in Expo Go (no native modules).
 * All native calls are wrapped in try/catch.
 *
 * IMPORTANT: Actual health data requires an EAS development build.
 * Run: npx eas build --profile development --platform ios
 *      npx eas build --profile development --platform android
 */

import { Platform } from "react-native";

// ─── Unified types ────────────────────────────────────────────────────────────

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

// ─── Availability check ───────────────────────────────────────────────────────

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

// ─── iOS — Apple HealthKit ────────────────────────────────────────────────────

async function requestHealthKitPermissions(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const AppleHealthKit = require("react-native-health").default;
      const { Permissions } = require("react-native-health");

      const options = {
        permissions: {
          read: [
            Permissions.Steps,
            Permissions.HeartRate,
            Permissions.HeartRateVariability,
            Permissions.SleepAnalysis,
            Permissions.ActiveEnergyBurned,
            Permissions.RestingHeartRate,
          ],
          write: [],
        },
      };

      AppleHealthKit.initHealthKit(options, (err: unknown) => {
        resolve(!err);
      });
    } catch {
      resolve(false);
    }
  });
}

async function readHealthKitToday(): Promise<HealthData> {
  return new Promise((resolve) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const AppleHealthKit = require("react-native-health").default;

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const now = new Date();

      const options = {
        startDate: startOfDay.toISOString(),
        endDate: now.toISOString(),
        limit: 1,
        ascending: false,
      };

      // Read steps
      AppleHealthKit.getStepCount(
        { date: now.toISOString() },
        (_err: unknown, stepsResult: { value?: number }) => {
          const steps = stepsResult?.value ?? null;

          AppleHealthKit.getHeartRateSamples(
            options,
            (_err2: unknown, hrResult: Array<{ value?: number }>) => {
              const heartRateBpm = hrResult?.[0]?.value ?? null;

              AppleHealthKit.getHeartRateVariabilitySamples(
                options,
                (_err3: unknown, hrvResult: Array<{ value?: number }>) => {
                  const hrvMs = hrvResult?.[0]?.value ?? null;

                  AppleHealthKit.getSleepSamples(
                    options,
                    (_err4: unknown, sleepResult: Array<{ startDate?: string; endDate?: string }>) => {
                      let sleepHours: number | null = null;
                      if (sleepResult?.length) {
                        const totalMs = sleepResult.reduce((acc, s) => {
                          if (!s.startDate || !s.endDate) return acc;
                          return acc + (new Date(s.endDate).getTime() - new Date(s.startDate).getTime());
                        }, 0);
                        sleepHours = Math.round((totalMs / 3600000) * 10) / 10;
                      }

                      AppleHealthKit.getActiveEnergyBurned(
                        options,
                        (_err5: unknown, calResult: Array<{ value?: number }>) => {
                          const activeCalories = calResult?.reduce(
                            (acc, r) => acc + (r.value ?? 0), 0
                          ) ?? null;

                          AppleHealthKit.getRestingHeartRate(
                            options,
                            (_err6: unknown, rhrResult: Array<{ value?: number }>) => {
                              const restingHeartRateBpm = rhrResult?.[0]?.value ?? null;

                              resolve({
                                steps,
                                heartRateBpm,
                                hrvMs,
                                sleepHours,
                                activeCalories: activeCalories ? Math.round(activeCalories) : null,
                                restingHeartRateBpm,
                                lastUpdated: now.toISOString(),
                              });
                            }
                          );
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    } catch {
      resolve(EMPTY_HEALTH_DATA);
    }
  });
}

// ─── Android — Google Health Connect ─────────────────────────────────────────

async function requestHealthConnectPermissions(): Promise<boolean> {
  try {
    const {
      initialize,
      requestPermission,
    } = require("react-native-health-connect");

    const available = await initialize();
    if (!available) return false;

    const granted = await requestPermission([
      { accessType: "read", recordType: "Steps" },
      { accessType: "read", recordType: "HeartRate" },
      { accessType: "read", recordType: "SleepSession" },
      { accessType: "read", recordType: "ActiveCaloriesBurned" },
      { accessType: "read", recordType: "RestingHeartRate" },
    ]);

    return granted.length > 0;
  } catch {
    return false;
  }
}

async function readHealthConnectToday(): Promise<HealthData> {
  try {
    const { readRecords } = require("react-native-health-connect");

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const now = new Date();
    const timeRangeFilter = {
      operator: "between" as const,
      startTime: startOfDay.toISOString(),
      endTime: now.toISOString(),
    };

    const [stepsData, hrData, sleepData, calData, rhrData] = await Promise.allSettled([
      readRecords("Steps", { timeRangeFilter }),
      readRecords("HeartRate", { timeRangeFilter }),
      readRecords("SleepSession", { timeRangeFilter }),
      readRecords("ActiveCaloriesBurned", { timeRangeFilter }),
      readRecords("RestingHeartRate", { timeRangeFilter }),
    ]);

    const steps =
      stepsData.status === "fulfilled"
        ? (stepsData.value.records as Array<{ count?: number }>).reduce(
            (s, r) => s + (r.count ?? 0),
            0
          )
        : null;

    const hrSamples =
      hrData.status === "fulfilled"
        ? (hrData.value.records as Array<{ samples?: Array<{ beatsPerMinute?: number }> }>)
        : [];
    const allHrSamples = hrSamples.flatMap((r) => r.samples ?? []);
    const heartRateBpm =
      allHrSamples.length > 0
        ? Math.round(
            allHrSamples.reduce((s, r) => s + (r.beatsPerMinute ?? 0), 0) /
              allHrSamples.length
          )
        : null;

    const sleepRecords =
      sleepData.status === "fulfilled"
        ? (sleepData.value.records as Array<{ startTime?: string; endTime?: string }>)
        : [];
    const totalSleepMs = sleepRecords.reduce((acc, r) => {
      if (!r.startTime || !r.endTime) return acc;
      return acc + (new Date(r.endTime).getTime() - new Date(r.startTime).getTime());
    }, 0);
    const sleepHours = sleepRecords.length > 0 ? Math.round((totalSleepMs / 3600000) * 10) / 10 : null;

    const activeCalories =
      calData.status === "fulfilled"
        ? Math.round(
            (calData.value.records as Array<{ energy?: { inKilocalories?: number } }>).reduce(
              (s, r) => s + (r.energy?.inKilocalories ?? 0),
              0
            )
          )
        : null;

    const rhrRecords =
      rhrData.status === "fulfilled"
        ? (rhrData.value.records as Array<{ beatsPerMinute?: number }>)
        : [];
    const restingHeartRateBpm =
      rhrRecords.length > 0 ? rhrRecords[rhrRecords.length - 1]?.beatsPerMinute ?? null : null;

    return {
      steps,
      heartRateBpm,
      hrvMs: null, // Health Connect doesn't expose HRV directly
      sleepHours,
      activeCalories,
      restingHeartRateBpm,
      lastUpdated: now.toISOString(),
    };
  } catch {
    return EMPTY_HEALTH_DATA;
  }
}

// ─── Unified public API ───────────────────────────────────────────────────────

/**
 * Request all necessary health permissions from the OS.
 * Must be called before readTodayHealthData().
 * @returns true if at least some permissions were granted.
 */
export async function requestHealthPermissions(): Promise<boolean> {
  if (!isHealthAvailable()) return false;
  if (Platform.OS === "ios") return requestHealthKitPermissions();
  if (Platform.OS === "android") return requestHealthConnectPermissions();
  return false;
}

/**
 * Read today's health metrics from the device's health platform.
 * Returns null fields for any metric that couldn't be read.
 */
export async function readTodayHealthData(): Promise<HealthData> {
  if (!isHealthAvailable()) return EMPTY_HEALTH_DATA;
  if (Platform.OS === "ios") return readHealthKitToday();
  if (Platform.OS === "android") return readHealthConnectToday();
  return EMPTY_HEALTH_DATA;
}
