/**
 * Background sync registration for wearable data.
 *
 * iOS  - HealthKit Observer Queries + background delivery (immediate / minute)
 *        for HR, HRV, Steps, ActiveCalories, Sleep, Workouts.
 * Android - WorkManager via expo-background-fetch (15 min minimum interval).
 *
 * This module is import-safe in Expo Go: every native call is wrapped in
 * try/catch and silently no-ops when the native module isn't present.
 */

import { Platform } from "react-native";
import type { ConvexReactClient } from "convex/react";
import { runSync } from "@/lib/wearableSync";

const BG_TASK_NAME = "elysia-wearable-sync";

let registered = false;

/** Called once after permissions are granted. Idempotent. */
export async function registerWearableBackground(client: ConvexReactClient): Promise<void> {
  if (registered) return;
  registered = true;
  if (Platform.OS === "ios") {
    await registerIOS(client);
  } else if (Platform.OS === "android") {
    await registerAndroid(client);
  }
}

// ─── iOS ─────────────────────────────────────────────────────────────────────

async function registerIOS(client: ConvexReactClient): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-health");
    const kit = mod.default as any;
    const perms = mod.Permissions as Record<string, string>;

    const types = [
      perms.HeartRate,
      perms.HeartRateVariability,
      perms.RestingHeartRate,
      perms.Steps,
      perms.ActiveEnergyBurned,
      perms.SleepAnalysis,
      perms.OxygenSaturation,
      perms.RespiratoryRate,
      perms.Workout,
    ].filter(Boolean);

    for (const t of types) {
      try {
        kit.enableBackgroundDelivery?.(t, "Immediate", () => {});
      } catch {
        // ignore unsupported type
      }
    }

    if (typeof kit.setObserver === "function") {
      // Some forks expose setObserver(type, cb); when an observer fires,
      // run an incremental sync.
      for (const t of types) {
        try {
          kit.setObserver({ type: t });
          // Listener attaches via NativeEventEmitter inside the lib; we use
          // its emitted "healthKit:..." events as triggers.
        } catch {
          // ignore
        }
      }
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const RN = require("react-native");
      const NativeEventEmitter = RN.NativeEventEmitter;
      const emitter = new NativeEventEmitter(RN.NativeModules?.AppleHealthKit);
      emitter.addListener("healthKit:HeartRate:new", () => {
        void runSync(client);
      });
      emitter.addListener("healthKit:Steps:new", () => {
        void runSync(client);
      });
      emitter.addListener("healthKit:Workout:new", () => {
        void runSync(client);
      });
      emitter.addListener("healthKit:SleepAnalysis:new", () => {
        void runSync(client);
      });
    } catch {
      // ignore - emitter unavailable in Expo Go
    }
  } catch {
    // native module not present
  }
}

// ─── Android ─────────────────────────────────────────────────────────────────

async function registerAndroid(client: ConvexReactClient): Promise<void> {
  try {
    // expo-background-fetch is available in Expo SDK; if unavailable, no-op.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BackgroundFetch = require("expo-background-fetch");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TaskManager = require("expo-task-manager");

    if (typeof TaskManager.defineTask === "function") {
      TaskManager.defineTask(BG_TASK_NAME, async () => {
        try {
          await runSync(client);
          return BackgroundFetch.BackgroundFetchResult?.NewData ?? 1;
        } catch {
          return BackgroundFetch.BackgroundFetchResult?.Failed ?? 2;
        }
      });
    }
    if (typeof BackgroundFetch.registerTaskAsync === "function") {
      await BackgroundFetch.registerTaskAsync(BG_TASK_NAME, {
        minimumInterval: 15 * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch {
    // expo-background-fetch / expo-task-manager not installed yet
  }
}
