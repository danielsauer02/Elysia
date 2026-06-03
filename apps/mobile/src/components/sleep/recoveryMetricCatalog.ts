/**
 * recoveryMetricCatalog
 *
 * Static metadata table for every biometric tile in the Recovery Deep-Dive
 * Metrics section. Mirrors `sleepMetricCatalog` (same `SleepMetric` shape and
 * helpers) so the recovery rows render and classify identically. The `id`
 * matches both the `metric` arg of `api.recovery.getRecoveryMetricSeries`
 * AND the `/recovery-metric/[metric]` URL param — keep ids stable.
 */
import type { SleepMetric } from "./sleepMetricCatalog";

const DASH = "—";

export const RECOVERY_METRICS: SleepMetric[] = [
  {
    id: "rhr",
    label: "Resting HR",
    unit: "bpm",
    icon: "heart-outline",
    group: "biometric",
    allowDetail: true,
    trendKind: "scatterLine",
    detailChart: "scatter",
    scaleMode: "auto",
    higherIsBetter: false,
    // Lower is better: the green zone is everything *under* the age-adjusted
    // upper threshold (the lower bound is just a physiological display floor).
    optimalKind: "below",
    goodRange: [38, 66],
    format: (v) => (v === null || !Number.isFinite(v) ? DASH : `${Math.round(v)} bpm`),
    about:
      "Resting heart rate is your average beats-per-minute at full rest, measured overnight. With heart rate, lower is better: a slower resting pulse reflects stronger cardiovascular fitness and deeper recovery, so we don't penalise low numbers. The green zone marks a healthy upper limit, nudged slightly with age because resting heart rate tends to creep up over the years. A multi-day rise above your line can flag late meals, alcohol, illness or accumulated strain.",
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
    optimalKind: "none",
    format: (v) => (v === null || !Number.isFinite(v) ? DASH : `${Math.round(v)} ms`),
    about:
      "Heart-rate variability is the beat-to-beat variation in your heartbeat, measured in milliseconds overnight. It is the single strongest signal of recovery: higher generally means a well-recovered, parasympathetic-dominant nervous system, while a sustained drop often precedes illness, overtraining or poor recovery. We don't draw an optimal range on purpose — healthy HRV varies hugely between people and falls with age, so the only number that matters is your own baseline. Watch whether today sits above or below your recent average.",
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
    optimalKind: "none",
    tightZoom: true,
    format: (v) => (v === null || !Number.isFinite(v) ? DASH : `${v.toFixed(1)} br/min`),
    about:
      "Respiratory rate is the number of breaths you take per minute at rest, and it's one of the most stable signals your body produces — most healthy adults sit around 12–16 breaths per minute. Because it barely moves day to day, even a small sustained rise stands out and can be an early sign of illness, alcohol or strain. We don't draw a fixed optimal band: your own steady baseline is the reference, so watch how level your line stays rather than chasing an exact number.",
    yMin: 8,
    yMax: 22,
  },
  {
    id: "temp",
    label: "Body temperature",
    unit: "°C",
    icon: "thermometer-outline",
    group: "biometric",
    allowDetail: true,
    trendKind: "scatterLine",
    detailChart: "line",
    scaleMode: "auto",
    higherIsBetter: false,
    // Skin temperature is only meaningful relative to your own baseline —
    // a deviation in either direction can flag illness, cycle phase or a
    // hard day, so there is no fixed optimal band.
    optimalKind: "none",
    tightZoom: true,
    format: (v) => (v === null || !Number.isFinite(v) ? DASH : `${v.toFixed(1)}°C`),
    about:
      "Body (skin) temperature is measured continuously while you sleep and reported as a nightly average. The absolute number matters less than its deviation from your personal baseline: a sustained rise of even a few tenths of a degree is one of the earliest signals of illness, while shifts also track the menstrual cycle, alcohol and a warm room. We don't draw a fixed optimal band — your own steady baseline is the reference, so watch for departures from your normal line.",
    yMin: 33,
    yMax: 38,
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
    optimalKind: "above",
    goodRange: [95, 100],
    format: (v) => (v === null || !Number.isFinite(v) ? DASH : `${Math.round(v)}%`),
    about:
      "Blood-oxygen saturation (SpO₂) is the percentage of oxygen your red blood cells carry while you sleep. The healthy zone is 95% and up — that's where we draw the line, because at that level your airway and oxygen delivery are doing their job through the night. The reading isn't age-dependent; what matters is staying high. Repeated dips below 95% can point to disrupted breathing and are worth watching if they persist.",
    yMin: 85,
    yMax: 100,
  },
];

/** Look up by id. Returns undefined when unknown — keeps the router safe. */
export function getRecoveryMetric(id: string): SleepMetric | undefined {
  return RECOVERY_METRICS.find((m) => m.id === id);
}
