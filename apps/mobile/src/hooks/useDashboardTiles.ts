/**
 * useDashboardTiles
 *
 * Reads the persisted dashboard tile order from Convex (`userPreferences`)
 * with an optimistic local cache so reorder/add/remove feels instantaneous
 * even before the round-trip completes.
 *
 * Falls back to `DEFAULT_TILE_IDS` until Convex returns its first snapshot.
 */
import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  DEFAULT_TILE_IDS,
  isKnownTileId,
  type TileId,
} from "@/components/dashboard/healthTiles";

type SetTilesArgs = TileId[] | ((prev: TileId[]) => TileId[]);

export function useDashboardTiles(): {
  tileIds: TileId[];
  isReady: boolean;
  setTileIds: (next: SetTilesArgs) => void;
} {
  const prefs = useQuery(api.userPreferences.getMyPreferences, {});
  const setMutation = useMutation(api.userPreferences.setDashboardTiles);

  // Optimistic local cache.
  const [local, setLocal] = useState<TileId[] | null>(null);

  // Hydrate from server snapshot whenever it changes (and we haven't started
  // editing locally since the last server confirmation).
  useEffect(() => {
    if (prefs === undefined) return; // still loading
    const persisted = prefs.dashboardTileIds;
    if (!persisted || persisted.length === 0) {
      setLocal(DEFAULT_TILE_IDS);
      return;
    }
    const filtered = persisted.filter(isKnownTileId);
    setLocal(filtered.length > 0 ? filtered : DEFAULT_TILE_IDS);
  }, [prefs]);

  const tileIds = local ?? DEFAULT_TILE_IDS;
  const isReady = local !== null;

  const setTileIds = useCallback(
    (next: SetTilesArgs) => {
      const resolved = typeof next === "function" ? next(tileIds) : next;
      const cleaned = dedupe(resolved.filter(isKnownTileId));
      setLocal(cleaned);
      // Fire-and-forget; on failure the next server snapshot will reconcile.
      void setMutation({ tileIds: cleaned }).catch(() => {});
    },
    [tileIds, setMutation]
  );

  return { tileIds, isReady, setTileIds };
}

function dedupe<T>(arr: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const v of arr) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}
