import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { useConvex } from "convex/react";
import { useAuth } from "@/context/AuthContext";
import { track, captureException } from "@/lib/analytics";
import {
  isHealthAvailable,
  requestHealthPermissions,
  type HealthPermissionResult,
} from "@/lib/healthkit";
import { runSync, runFullBackfill, type SyncResult } from "@/lib/wearableSync";
import { registerWearableBackground } from "@/lib/wearableBackground";

const FOREGROUND_INTERVAL_MS = 60_000;

type WearableContextValue = {
  isHealthSupported: boolean;
  hasPermission: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastResult: SyncResult | null;
  errorCount: number;
  source: "apple_health" | "health_connect" | null;
  requestPermissions: () => Promise<HealthPermissionResult>;
  syncNow: () => Promise<SyncResult>;
  fullBackfill: (daysBack?: number) => Promise<SyncResult>;
};

const WearableContext = createContext<WearableContextValue | null>(null);

export function WearableProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const { user } = useAuth();

  const [hasPermission, setHasPermission] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [errorCount, setErrorCount] = useState(0);

  const source: "apple_health" | "health_connect" | null =
    Platform.OS === "ios" ? "apple_health" : Platform.OS === "android" ? "health_connect" : null;
  const isHealthSupported = useMemo(() => isHealthAvailable(), []);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncNow = useCallback(async () => {
    if (!user || !isHealthSupported || !hasPermission) {
      const noop: SyncResult = {
        ok: false,
        insertedSamples: 0,
        insertedWorkouts: 0,
        skipped: 0,
        metrics: [],
        durationMs: 0,
        error: !user
          ? "Not signed in"
          : !isHealthSupported
          ? "Health platform unavailable"
          : "Permissions not granted",
      };
      setLastResult(noop);
      return noop;
    }
    setIsSyncing(true);
    try {
      const res = await runSync(convex);
      setLastResult(res);
      if (res.ok) {
        setLastSyncAt(new Date().toISOString());
        setErrorCount(0);
      } else {
        setErrorCount((c) => c + 1);
      }
      return res;
    } finally {
      setIsSyncing(false);
    }
  }, [user, isHealthSupported, hasPermission, convex]);

  const fullBackfill = useCallback(
    async (daysBack?: number) => {
      if (!user || !isHealthSupported) {
        const noop: SyncResult = {
          ok: false,
          insertedSamples: 0,
          insertedWorkouts: 0,
          skipped: 0,
          metrics: [],
          durationMs: 0,
        };
        return noop;
      }
      setIsSyncing(true);
      try {
        const res = await runFullBackfill(convex, daysBack);
        setLastResult(res);
        if (res.ok) {
          setLastSyncAt(new Date().toISOString());
          setErrorCount(0);
        }
        return res;
      } finally {
        setIsSyncing(false);
      }
    },
    [user, isHealthSupported, convex]
  );

  const requestPermissions = useCallback(async (): Promise<HealthPermissionResult> => {
    try {
      const result = await requestHealthPermissions();
      setHasPermission(result.ok);
      track("wearable_permission_requested", {
        granted: result.ok,
        platform: Platform.OS,
        reason: result.ok ? "ok" : result.reason,
        partial: result.ok ? result.partial : false,
      });
      if (result.ok) {
        await registerWearableBackground(convex);
        void fullBackfill();
      }
      return result;
    } catch (e) {
      captureException(e, { surface: "wearable.requestPermissions" });
      return {
        ok: false,
        reason: "error",
        detail: e instanceof Error ? e.message : String(e),
      };
    }
  }, [convex, fullBackfill]);

  // Foreground sync loop while signed in + permitted
  useEffect(() => {
    if (!user || !hasPermission) return;
    void syncNow();
    intervalRef.current = setInterval(() => {
      void syncNow();
    }, FOREGROUND_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [user, hasPermission, syncNow]);

  // Sync on app foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active" && user && hasPermission) {
        void syncNow();
      }
    });
    return () => sub.remove();
  }, [user, hasPermission, syncNow]);

  // Auto-register background once permission flips on (e.g. restored)
  useEffect(() => {
    if (hasPermission) {
      void registerWearableBackground(convex);
    }
  }, [hasPermission, convex]);

  const value: WearableContextValue = useMemo(
    () => ({
      isHealthSupported,
      hasPermission,
      isSyncing,
      lastSyncAt,
      lastResult,
      errorCount,
      source,
      requestPermissions,
      syncNow,
      fullBackfill,
    }),
    [
      isHealthSupported,
      hasPermission,
      isSyncing,
      lastSyncAt,
      lastResult,
      errorCount,
      source,
      requestPermissions,
      syncNow,
      fullBackfill,
    ]
  );

  return <WearableContext.Provider value={value}>{children}</WearableContext.Provider>;
}

export function useWearable(): WearableContextValue {
  const ctx = useContext(WearableContext);
  if (!ctx) throw new Error("useWearable must be used within WearableProvider");
  return ctx;
}
