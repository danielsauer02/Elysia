/**
 * sleepMetricCatalog
 *
 * Static metadata table for every KPI in the SleepMetricsGrid. Drives
 * tile rendering AND the /sleep-metric/[metric] route → keep the ids
 * stable. The `id` matches both `metric` arg of
 * `api.sleep.getSleepMetricSeries` AND the URL param.
 */
import type { Ionicons } from "@expo/vector-icons";

export type MetricDotKind = "good" | "neutral" | "bad";

/** Which container a metric lives in on the Metrics screen. */
export type MetricGroup = "sleepSpecific" | "biometric";

/**
 * How the detail / trend view renders this KPI:
 *   - "barLine"        bars on W/M, switches to a line on 6M/Y (point-per-
 *                      night scores, mirrors the Sleep Fitness Score view)
 *   - "line"           a continuous line on every timeframe
 *   - "scatter"        a line plus the raw nightly dots (HR keeps its dots)
 *   - "debtCumulative" the special last-7-days running deficit line
 */
export type MetricDetailChart = "barLine" | "line" | "scatter" | "debtCumulative";

/** How the Y-axis scale is derived for the detail chart. */
export type MetricScaleMode = "pct100" | "auto";

/**
 * Shape of the "optimal" overlay on the deep-dive chart + how `classifyDot`
 * reads it:
 *   - "band"  a two-sided healthy window `[lo, hi]` (default)
 *   - "below" lower is better with no low-side penalty; only `hi` is the
 *             threshold (e.g. resting heart rate — under the line is good,
 *             and even lower is better still)
 *   - "above" higher is better with no high-side penalty; only `lo` matters
 *   - "none"  no meaningful fixed optimal (e.g. HRV is individual) — no band,
 *             no legend, neutral dot
 */
export type MetricOptimalKind = "band" | "below" | "above" | "none";

export interface SleepMetric {
  id: string;
  label: string;
  unit: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Container grouping. */
  group: MetricGroup;
  /** Whether the detail screen exists for this metric. */
  allowDetail: boolean;
  /** Layout family used by /sleep-metric/[metric]. */
  trendKind: "scatterLine" | "bar" | "line";
  /** Chart family for the deep-dive trend view. */
  detailChart: MetricDetailChart;
  /** Y-axis scale strategy for the deep-dive trend view. */
  scaleMode: MetricScaleMode;
  /** Higher value = healthier (`true`) or unhealthier (`false`). */
  higherIsBetter: boolean;
  /** Thresholds in display-unit; sorted ascending. */
  goodRange?: [number, number];
  /** How the optimal overlay behaves. Defaults to "band". */
  optimalKind?: MetricOptimalKind;
  /** Tighten the auto Y-scale to the data (ignore goodRange padding). */
  tightZoom?: boolean;
  /** Formatter for the value. */
  format: (v: number | null) => string;
  /** Explanatory copy for the expandable "About …" widget. */
  about: string;
  /** Optional small caption under the label (e.g. timeframe context). */
  caption?: string;
  /** Pretty range for the trend axis (optional). */
  yMin?: number;
  yMax?: number;
}

const DASH = "—";

function fmtInt(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return DASH;
  return String(Math.round(v));
}

function fmtMs(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return DASH;
  return `${Math.round(v)} ms`;
}

function fmtPct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return DASH;
  return `${Math.round(v)}%`;
}

function fmtHm(v: number | null): string {
  if (v === null || !Number.isFinite(v) || v < 0) return DASH;
  const h = Math.floor(v / 60);
  const m = Math.round(v % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export const SLEEP_METRICS: SleepMetric[] = [
  // ── Sleep-specific ───────────────────────────────────────────────
  {
    id: "performance",
    label: "Sleep vs need",
    unit: "%",
    icon: "stats-chart-outline",
    group: "sleepSpecific",
    allowDetail: true,
    trendKind: "bar",
    detailChart: "barLine",
    scaleMode: "pct100",
    higherIsBetter: true,
    goodRange: [85, 100],
    format: fmtPct,
    about:
      "Sleep vs need compares how much you actually slept against the amount your body needed that night. Your need grows with sleep debt and strain, so 100% means you fully covered the demand. Consistently landing in the 85–100% band is the single strongest lever for daytime energy and long-term recovery.",
    yMin: 0,
    yMax: 110,
  },
  {
    id: "consistency",
    label: "Consistency",
    unit: "%",
    icon: "calendar-outline",
    group: "sleepSpecific",
    allowDetail: true,
    trendKind: "line",
    detailChart: "line",
    scaleMode: "pct100",
    higherIsBetter: true,
    goodRange: [70, 100],
    format: fmtPct,
    about:
      "Consistency scores how closely your bed and wake times match across recent days. A steady schedule keeps your circadian rhythm aligned, which improves sleep onset, deep-sleep depth and morning alertness. Above 70% is solid; the closer to 100%, the more locked-in your body clock is.",
    yMin: 0,
    yMax: 100,
  },
  {
    id: "debt",
    label: "Sleep deficit",
    unit: "hh:mm",
    icon: "timer-outline",
    group: "sleepSpecific",
    allowDetail: true,
    trendKind: "line",
    detailChart: "debtCumulative",
    scaleMode: "auto",
    higherIsBetter: false,
    goodRange: [0, 120],
    format: fmtHm,
    about:
      "Sleep deficit is the gap between the sleep you needed and the sleep you got — for the night shown in the tile, that's last night alone. The trend adds up each night's shortfall across the last seven days so you can see how the deficit accumulates. Smaller is better; a rising line means recovery is falling behind demand.",
  },
  {
    id: "restorative",
    label: "Restorative Sleep",
    unit: "hh:mm",
    icon: "sparkles-outline",
    group: "sleepSpecific",
    allowDetail: true,
    trendKind: "bar",
    detailChart: "barLine",
    scaleMode: "auto",
    higherIsBetter: true,
    // REM + Deep target ≈ 35-45% of an 8h night ≈ 170-215 min.
    goodRange: [165, 240],
    format: fmtHm,
    about:
      "Restorative sleep is the sum of your REM and deep-sleep minutes — the two stages that do the real recovery work. Deep sleep repairs the body and clears metabolic waste from the brain, while REM consolidates memory and regulates mood. Aim for roughly 2h45m–4h a night; too little here is what makes you wake up unrefreshed even after a long night.",
    yMin: 0,
    yMax: 300,
  },
  // ── Biometrics (nightly averages) ────────────────────────────────
  {
    id: "hr",
    label: "Resting HR",
    unit: "bpm",
    icon: "heart-outline",
    group: "biometric",
    allowDetail: true,
    trendKind: "scatterLine",
    detailChart: "scatter",
    scaleMode: "auto",
    higherIsBetter: false,
    // Lower is better: the green zone is everything *under* the upper
    // threshold (the lower bound is just a physiological display floor).
    // The threshold is age-adjusted at render time via effectiveGoodRange.
    optimalKind: "below",
    goodRange: [38, 66],
    format: (v) => (v === null || !Number.isFinite(v) ? DASH : `${Math.round(v)} bpm`),
    about:
      "Sleeping heart rate is your average beats-per-minute while asleep — it normally falls to the lowest point of your day overnight. With heart rate, lower is better: a slower sleeping pulse reflects stronger cardiovascular fitness and deeper recovery, so we don't penalise low numbers. The green zone marks a healthy upper limit, and we nudge that limit slightly with age because resting heart rate tends to creep up over the years. Staying under your line is good; drifting above it for several nights can flag late meals, alcohol, illness or stress.",
    yMin: 40,
    yMax: 80,
  },
  {
    id: "hrv",
    label: "HRV",
    unit: "ms",
    icon: "pulse-outline",
    group: "biometric",
    allowDetail: true,
    trendKind: "scatterLine",
    detailChart: "line",
    scaleMode: "auto",
    higherIsBetter: true,
    // HRV is so individual (genetics, age, fitness) that a fixed "optimal"
    // band would mislead more than help — we deliberately show none and let
    // you read your own trend instead.
    optimalKind: "none",
    format: fmtMs,
    about:
      "Heart-rate variability is the beat-to-beat variation in your heartbeat, measured in milliseconds during sleep. Higher generally means a well-recovered, parasympathetic-dominant nervous system; a sustained drop often precedes illness, overtraining or poor recovery. We don't draw an optimal range here on purpose: healthy HRV varies hugely between people and falls with age, so the only number that matters is your own baseline. Watch whether tonight sits above or below your recent average rather than chasing an absolute target.",
    yMin: 10,
    yMax: 120,
  },
  {
    id: "rr",
    label: "Respiratory rate",
    unit: "br/min",
    icon: "leaf-outline",
    group: "biometric",
    allowDetail: true,
    trendKind: "scatterLine",
    detailChart: "line",
    scaleMode: "auto",
    higherIsBetter: false,
    // No fixed optimal band: respiratory rate is so steady per person that a
    // generic range adds little — your own baseline and its stability are
    // what matter. The axis still scales closely (but not too tight) so the
    // small nightly swings are readable.
    optimalKind: "none",
    tightZoom: true,
    format: (v) => (v === null || !Number.isFinite(v) ? DASH : `${v.toFixed(1)} br/min`),
    about:
      "Respiratory rate is the number of breaths you take per minute during sleep, and it's one of the most stable signals your body produces — most healthy adults sit around 12–16 breaths per minute asleep. Because it barely moves night to night, even a small sustained rise stands out and can be an early sign of illness, alcohol or a hard day. We don't draw a fixed optimal band: your own steady baseline is the reference, so watch how level your line stays rather than chasing an exact number.",
    yMin: 8,
    yMax: 22,
  },
  {
    id: "spo2",
    label: "SpO2",
    unit: "%",
    icon: "water-outline",
    group: "biometric",
    allowDetail: true,
    trendKind: "scatterLine",
    detailChart: "line",
    scaleMode: "auto",
    higherIsBetter: true,
    // Higher is better, capped at 100%: the green zone is "at or above 95%".
    optimalKind: "above",
    goodRange: [95, 100],
    format: fmtPct,
    about:
      "Blood-oxygen saturation (SpO₂) is the percentage of oxygen your red blood cells carry while you sleep. The healthy zone is 95% and up — that's where we draw the line, because at that level your airway and oxygen delivery are doing their job through the night. The reading isn't age-dependent; what matters is staying high. Repeated dips below 95% can point to disrupted breathing and are worth watching if they persist.",
    yMin: 85,
    yMax: 100,
  },
  {
    id: "hrDip",
    label: "Heart rate dip",
    unit: "%",
    icon: "trending-down-outline",
    group: "biometric",
    allowDetail: true,
    trendKind: "line",
    detailChart: "line",
    scaleMode: "auto",
    // A healthy nocturnal HR dip (day average → sleeping low) is ~10%+.
    // Below ~10% is weak autonomic recovery; a larger dip stays good, so
    // this is an "above the threshold" optimal rather than a closed band.
    higherIsBetter: true,
    optimalKind: "above",
    goodRange: [10, 40],
    format: fmtPct,
    about:
      "Heart-rate dip is how far your heart rate falls overnight — the percentage drop from your daytime average down to your lowest sleeping rate. The green zone is roughly 10% and deeper: a bigger dip means your nervous system is switching properly into rest-and-recover mode, so more is better here and we don't cap it. A shallow dip can mean stress, late eating or alcohol kept your body on alert. It's read against your own daytime average, so it adjusts to you rather than to your age.",
  },
];

/** Metrics belonging to a given container, in declaration order. */
export function metricsForGroup(group: MetricGroup): SleepMetric[] {
  return SLEEP_METRICS.filter((m) => m.group === group);
}

/** Look up by id. Throws when the id is unknown — keeps router safe. */
export function getSleepMetric(id: string): SleepMetric | undefined {
  return SLEEP_METRICS.find((m) => m.id === id);
}

/** Whole years from an ISO date of birth, or null if unparseable. */
export function ageYearsFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const ms = Date.parse(dob);
  if (!Number.isFinite(ms)) return null;
  const now = new Date();
  const birth = new Date(ms);
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/**
 * Age-adjusted upper threshold (bpm) for a healthy sleeping/resting heart
 * rate. Resting HR tends to creep up with age, so we relax the ceiling a
 * little for older users. This is a general guideline, not a diagnosis.
 */
export function rhrUpperThreshold(age: number | null): number {
  if (age == null || !Number.isFinite(age)) return 66;
  if (age < 30) return 62;
  if (age < 40) return 64;
  if (age < 50) return 66;
  if (age < 60) return 68;
  return 70;
}

/**
 * The metric's optimal range with any runtime personalisation applied
 * (currently: the age-adjusted resting-HR ceiling). Returns null when the
 * metric has no fixed optimal (`optimalKind: "none"`).
 */
export function effectiveGoodRange(
  metric: SleepMetric,
  age: number | null = null
): [number, number] | null {
  if (!metric.goodRange || metric.optimalKind === "none") return null;
  // Both the sleep view's sleeping-HR tile ("hr") and the recovery view's
  // resting-HR tile ("rhr") use the same age-adjusted upper ceiling.
  if (metric.id === "hr" || metric.id === "rhr") {
    return [metric.goodRange[0], rhrUpperThreshold(age)];
  }
  return metric.goodRange;
}

/**
 * Classify a value as good/neutral/bad given the metric's optimal model.
 * Honours `optimalKind` ("band" | "below" | "above" | "none") and the
 * age-adjusted range. Returns `neutral` when there is no fixed optimal or
 * the value is missing.
 */
export function classifyDot(
  metric: SleepMetric,
  value: number | null,
  age: number | null = null
): MetricDotKind {
  if (value === null || !Number.isFinite(value)) return "neutral";
  const range = effectiveGoodRange(metric, age);
  if (!range) return "neutral";
  const [lo, hi] = range;
  const kind = metric.optimalKind ?? "band";
  if (kind === "below") return value <= hi ? "good" : "bad";
  if (kind === "above") return value >= lo ? "good" : "bad";
  // Two-sided band.
  const inRange = value >= lo && value <= hi;
  if (inRange) return "good";
  if (metric.higherIsBetter) return value < lo ? "bad" : "neutral";
  return value > hi ? "bad" : "neutral";
}
