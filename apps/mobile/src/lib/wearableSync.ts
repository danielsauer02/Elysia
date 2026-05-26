/**
 * Mobile-side sync engine that pulls Apple HealthKit / Health Connect samples
 * and pushes them to Convex via batched, idempotent ingest mutations.
 *
 * Design goals:
 *   - Incremental pulls keyed off Convex `wearableSyncState.lastSyncedEnd`
 *   - Full backfill on first connect (default 30 days)
 *   - Offline queueing: when ingest fails, samples land in AsyncStorage and
 *     get retried on next sync
 *   - Exponential backoff with cap for transient failures
 *   - Bounded concurrency: one sync at a time per app instance
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { ConvexReactClient } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  HEALTH_METRICS,
  isHealthAvailable,
  readSamples,
  readWorkouts,
  type CanonicalMetric,
  type CanonicalSample,
  type CanonicalWorkout,
} from "@/lib/healthkit";

const QUEUE_KEY = "@elysia/wearableQueue/v1";
const SAMPLE_BATCH = 500;
const WORKOUT_BATCH = 100;
const MAX_BACKFILL_DAYS = 30;
const SOURCE = (() => {
  // Always tagged from device: HealthKit on iOS, Health Connect on Android.
  // Keep as a function in case we later support multiple device sources.
  return null;
})();

type QueueState = {
  samples: CanonicalSample[];
  workouts: CanonicalWorkout[];
};

let inflight: Promise<SyncResult> | null = null;
let backoffMs = 0;
let backoffUntilTs = 0;

export type SyncResult = {
  ok: boolean;
  insertedSamples: number;
  insertedWorkouts: number;
  skipped: number;
  metrics: Array<{ metric: CanonicalMetric; samples: number }>;
  error?: string;
  durationMs: number;
};

type SyncStateRow = {
  source: string;
  metricType: string;
  lastSyncedEnd: string;
};

function detectSource(): "apple_health" | "health_connect" | null {
  // Lazy require to avoid pulling react-native at module load in unit tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Platform } = require("react-native") as typeof import("react-native");
  if (Platform.OS === "ios") return "apple_health";
  if (Platform.OS === "android") return "health_connect";
  return null;
}

async function loadQueue(): Promise<QueueState> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return { samples: [], workouts: [] };
    const parsed = JSON.parse(raw) as QueueState;
    return {
      samples: Array.isArray(parsed.samples) ? parsed.samples : [],
      workouts: Array.isArray(parsed.workouts) ? parsed.workouts : [],
    };
  } catch {
    return { samples: [], workouts: [] };
  }
}

async function saveQueue(q: QueueState): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

async function appendQueue(samples: CanonicalSample[], workouts: CanonicalWorkout[]): Promise<void> {
  const q = await loadQueue();
  q.samples.push(...samples);
  q.workouts.push(...workouts);
  await saveQueue(q);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function bumpBackoff(): void {
  backoffMs = backoffMs === 0 ? 1_000 : Math.min(backoffMs * 2, 5 * 60_000);
  backoffUntilTs = Date.now() + backoffMs;
}

function clearBackoff(): void {
  backoffMs = 0;
  backoffUntilTs = 0;
}

function isBackedOff(): boolean {
  return Date.now() < backoffUntilTs;
}

async function fetchSyncState(client: ConvexReactClient): Promise<Map<string, string>> {
  const rows = (await client.query(api.wearables.getSyncState, {})) as SyncStateRow[];
  const map = new Map<string, string>();
  for (const r of rows) map.set(`${r.source}:${r.metricType}`, r.lastSyncedEnd);
  return map;
}

function nowISO(): string {
  return new Date().toISOString();
}

function defaultStartFor(metric: CanonicalMetric, lastSyncedEnd: string | undefined): string {
  if (lastSyncedEnd) return lastSyncedEnd;
  const days = MAX_BACKFILL_DAYS;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

async function postSamplesInChunks(
  client: ConvexReactClient,
  samples: CanonicalSample[]
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;
  for (const slice of chunk(samples, SAMPLE_BATCH)) {
    const res = await client.mutation(api.wearables.ingestSamplesBatch, {
      samples: slice,
    });
    inserted += res.inserted;
    skipped += res.skipped;
  }
  return { inserted, skipped };
}

async function postWorkoutsInChunks(
  client: ConvexReactClient,
  workouts: CanonicalWorkout[]
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;
  for (const slice of chunk(workouts, WORKOUT_BATCH)) {
    const res = await client.mutation(api.wearables.ingestWorkoutsBatch, {
      workouts: slice,
    });
    inserted += res.inserted;
    skipped += res.skipped;
  }
  return { inserted, skipped };
}

async function flushQueue(client: ConvexReactClient): Promise<{ inserted: number; skipped: number }> {
  const queued = await loadQueue();
  if (queued.samples.length === 0 && queued.workouts.length === 0) {
    return { inserted: 0, skipped: 0 };
  }
  let inserted = 0;
  let skipped = 0;
  try {
    if (queued.samples.length > 0) {
      const res = await postSamplesInChunks(client, queued.samples);
      inserted += res.inserted;
      skipped += res.skipped;
    }
    if (queued.workouts.length > 0) {
      const res = await postWorkoutsInChunks(client, queued.workouts);
      inserted += res.inserted;
      skipped += res.skipped;
    }
    await saveQueue({ samples: [], workouts: [] });
    return { inserted, skipped };
  } catch (e) {
    return { inserted, skipped };
  }
}

export type SyncOptions = {
  /** When set, ignore sync state and pull this many days back. */
  backfillDays?: number;
};

export async function runSync(
  client: ConvexReactClient,
  opts: SyncOptions = {}
): Promise<SyncResult> {
  if (inflight) return inflight;
  if (isBackedOff()) {
    return {
      ok: false,
      insertedSamples: 0,
      insertedWorkouts: 0,
      skipped: 0,
      metrics: [],
      error: `Backoff in effect for ${Math.max(0, backoffUntilTs - Date.now())}ms`,
      durationMs: 0,
    };
  }
  inflight = (async (): Promise<SyncResult> => {
    const startedAt = Date.now();
    try {
      const source = detectSource();
      if (!source || !isHealthAvailable()) {
        return {
          ok: false,
          insertedSamples: 0,
          insertedWorkouts: 0,
          skipped: 0,
          metrics: [],
          error: "Health platform not available",
          durationMs: Date.now() - startedAt,
        };
      }

      let totalInserted = 0;
      let totalSkipped = 0;
      const perMetric: Array<{ metric: CanonicalMetric; samples: number }> = [];

      // 1) Flush any queued items from prior failed runs first.
      const flushRes = await flushQueue(client);
      totalInserted += flushRes.inserted;
      totalSkipped += flushRes.skipped;

      // 2) Fetch current sync state for incremental window per metric.
      const syncState = await fetchSyncState(client);
      const endISO = nowISO();

      for (const metric of HEALTH_METRICS) {
        const stateKey = `${source}:${metric}`;
        const lastEnd = opts.backfillDays
          ? new Date(Date.now() - opts.backfillDays * 86_400_000).toISOString()
          : syncState.get(stateKey);
        const startISO = defaultStartFor(metric, lastEnd);

        let samples: CanonicalSample[] = [];
        try {
          samples = await readSamples(metric, startISO, endISO);
        } catch (e) {
          continue;
        }
        if (samples.length === 0) continue;

        try {
          const res = await postSamplesInChunks(client, samples);
          totalInserted += res.inserted;
          totalSkipped += res.skipped;
          perMetric.push({ metric, samples: res.inserted });
          await client.mutation(api.wearables.upsertSyncState, {
            source,
            metricType: metric,
            lastSyncedEnd: endISO,
            isFullSync: !!opts.backfillDays,
          });
        } catch (e) {
          await appendQueue(samples, []);
        }
      }

      // 3) Workouts (separate stream).
      try {
        const wkStateKey = `${source}:workouts`;
        const lastEnd = opts.backfillDays
          ? new Date(Date.now() - opts.backfillDays * 86_400_000).toISOString()
          : syncState.get(wkStateKey);
        const startISO = defaultStartFor("steps", lastEnd);
        const workouts = await readWorkouts(startISO, endISO);
        if (workouts.length > 0) {
          const res = await postWorkoutsInChunks(client, workouts);
          totalInserted += res.inserted;
          totalSkipped += res.skipped;
          await client.mutation(api.wearables.upsertSyncState, {
            source,
            metricType: "workouts",
            lastSyncedEnd: endISO,
            isFullSync: !!opts.backfillDays,
          });
        }
      } catch (e) {
        // best-effort
      }

      clearBackoff();
      return {
        ok: true,
        insertedSamples: totalInserted,
        insertedWorkouts: 0,
        skipped: totalSkipped,
        metrics: perMetric,
        durationMs: Date.now() - startedAt,
      };
    } catch (e) {
      bumpBackoff();
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        insertedSamples: 0,
        insertedWorkouts: 0,
        skipped: 0,
        metrics: [],
        error: msg,
        durationMs: Date.now() - startedAt,
      };
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function runFullBackfill(
  client: ConvexReactClient,
  daysBack = MAX_BACKFILL_DAYS
): Promise<SyncResult> {
  return runSync(client, { backfillDays: daysBack });
}

export async function clearLocalQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
