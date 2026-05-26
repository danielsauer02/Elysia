/**
 * Pure (no-Convex) analytics helpers.
 *
 * Extracted so they can be unit-tested with vitest without booting the
 * Convex isolate. `convex/analytics.ts` re-exports these.
 */

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ageYears(dateOfBirth: string | null, now: number = Date.now()): number | null {
  if (!dateOfBirth) return null;
  const dob = Date.parse(dateOfBirth);
  if (!Number.isFinite(dob)) return null;
  const yrs = (now - dob) / (365.25 * 86400 * 1000);
  return yrs > 0 ? yrs : null;
}

export function mifflinStJeor(args: {
  sex: string | null;
  weightKg: number | null;
  heightCm: number | null;
  dateOfBirth: string | null;
}): number | null {
  const age = ageYears(args.dateOfBirth);
  if (!args.weightKg || !args.heightCm || age === null) return null;
  const sexAdj = (args.sex ?? "").toLowerCase() === "female" ? -161 : 5;
  return Math.round(10 * args.weightKg + 6.25 * args.heightCm - 5 * age + sexAdj);
}

export const ACTIVITY_FACTOR: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function estimateTdee(args: {
  sex: string | null;
  heightCm: number | null;
  weightKg: number | null;
  dateOfBirth: string | null;
  activityLevel: string | null;
  activeKcal: number | null;
  workoutKcal: number | null;
  basalKcal: number | null;
  totalKcal?: number | null;
}): number | null {
  // Best: a wearable already reports the full-day energy expenditure
  // (Whoop cycle kilojoule, Garmin daily calories, etc.).
  if ((args.totalKcal ?? 0) > 0) {
    return Math.round(args.totalKcal as number);
  }
  if ((args.basalKcal ?? 0) > 0 && (args.activeKcal ?? 0) > 0) {
    return Math.round((args.basalKcal ?? 0) + (args.activeKcal ?? 0));
  }
  const bmr = mifflinStJeor(args);
  if (!bmr) return null;
  const factor = ACTIVITY_FACTOR[(args.activityLevel ?? "moderate").toLowerCase()] ?? 1.55;
  return Math.round(bmr * factor + (args.workoutKcal ?? 0));
}

export function computeMacroCompliance(
  target: {
    calorieTarget?: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
  },
  intake: { calories: number; proteinG: number; carbsG: number; fatG: number }
): number | null {
  const targets = [
    { tgt: target.calorieTarget, val: intake.calories },
    { tgt: target.proteinG, val: intake.proteinG },
    { tgt: target.carbsG, val: intake.carbsG },
    { tgt: target.fatG, val: intake.fatG },
  ].filter((t) => (t.tgt ?? 0) > 0);
  if (targets.length === 0) return null;
  const ratios = targets.map((t) => Math.min(1, (t.val ?? 0) / (t.tgt ?? 1)));
  return Math.round((ratios.reduce((s, r) => s + r, 0) / ratios.length) * 100);
}

export function computeRecoveryProxy(args: {
  hrvAvgMs: number | null;
  restingHrBpm: number | null;
  sleepMinutes: number | null;
}): number | null {
  const hrv = args.hrvAvgMs;
  const rhr = args.restingHrBpm;
  const sleep = args.sleepMinutes;

  const hrvScore = hrv !== null ? clamp01((hrv - 25) / 75) : null;
  const rhrScore = rhr !== null ? clamp01(1 - (rhr - 50) / 30) : null;
  const sleepScore = sleep !== null ? clamp01(sleep / 480) : null;

  const present = [hrvScore, rhrScore, sleepScore].filter((s): s is number => s !== null);
  if (present.length === 0) return null;
  return Math.round((present.reduce((s, v) => s + v, 0) / present.length) * 100);
}

export function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length < 3 || xs.length !== ys.length) return null;
  const meanX = xs.reduce((s, v) => s + v, 0) / xs.length;
  const meanY = ys.reduce((s, v) => s + v, 0) / ys.length;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return null;
  const r = num / Math.sqrt(denX * denY);
  return Math.round(r * 1000) / 1000;
}

export function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
