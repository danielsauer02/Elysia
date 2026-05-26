/**
 * In-memory dedupe for OAuth callbacks.
 *
 * On Android the OAuth redirect can arrive twice: once inside the
 * `WebBrowser.openAuthSessionAsync` session that opened the flow, and once
 * as a real `elysia://oauth/<provider>` deep link that lands on
 * `app/oauth/[provider].tsx`. Both paths call the Convex exchange action,
 * and although the server is now idempotent, we still want to avoid the
 * second round-trip (and any user-visible flicker).
 *
 * Strategy: each successful or in-flight exchange registers its `state`
 * nonce here for a short window. The deep-link handler checks first and
 * bails out if the nonce is already being / has just been processed.
 */

const HANDLED_TTL_MS = 30 * 1000; // 30s grace window.
const handled = new Map<string, number>();

/**
 * Record that an OAuth state nonce is being handled or has just completed.
 * Subsequent `wasRecentlyHandled` calls within HANDLED_TTL_MS return true.
 */
export function markOAuthStateHandled(state: string): void {
  if (!state) return;
  pruneOld();
  handled.set(state, Date.now());
}

/**
 * Returns true if `markOAuthStateHandled(state)` was called within the
 * grace window. Used by the deep-link fallback route to skip a duplicate
 * exchange.
 */
export function wasRecentlyHandled(state: string | null | undefined): boolean {
  if (!state) return false;
  pruneOld();
  const at = handled.get(state);
  if (at === undefined) return false;
  return Date.now() - at <= HANDLED_TTL_MS;
}

function pruneOld(): void {
  const cutoff = Date.now() - HANDLED_TTL_MS;
  for (const [k, t] of handled) {
    if (t < cutoff) handled.delete(k);
  }
}
