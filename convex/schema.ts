import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  profiles: defineTable({
    clerkUserId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailChangedAt: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    heightCm: v.optional(v.number()),
    weightKg: v.optional(v.number()),
    sex: v.optional(v.string()),
    goals: v.optional(v.array(v.string())),
    wearables: v.optional(v.array(v.string())),
    updatedAt: v.optional(v.string()),
  })
    .index("by_clerk_user", ["clerkUserId"])
    .index("by_email", ["email"]),

  habits: defineTable({
    userId: v.string(),
    templateId: v.optional(v.string()),
    title: v.string(),
    category: v.string(),
    expectedBenefit: v.string(),
    state: v.string(),
    schedule: v.object({
      frequencyPerWeek: v.number(),
      targetTimesOfDay: v.array(v.string()),
      startsOn: v.string(),
      endsOn: v.optional(v.string()),
    }),
    reminderRule: v.optional(
      v.object({
        reminderTimeLocal: v.string(),
        timezone: v.string(),
        pushEnabled: v.boolean(),
      })
    ),
    /**
     * Optional auto-completion rule. When set, foodLog or workout inserts
     * matching the rule trigger an idempotent habitCompletion for today.
     * Spec: docs/analytics/scoring-model-v1.md §11 (Habit Linking).
     */
    linkingRule: v.optional(
      v.object({
        kind: v.string(), // "food_contains" | "food_category" | "workout_type"
        patterns: v.array(v.string()),
        minQuantity: v.optional(v.number()),
      })
    ),
    streakCount: v.number(),
    completionRate30d: v.number(),
    updatedAt: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_template", ["userId", "templateId"]),

  habitCompletions: defineTable({
    userId: v.string(),
    habitId: v.id("habits"),
    completedDate: v.string(),
  })
    .index("by_user_date", ["userId", "completedDate"])
    .index("by_habit_date", ["habitId", "completedDate"]),

  nutritionGoals: defineTable({
    userId: v.string(),
    goalType: v.string(),
    weeklyChangeKg: v.number(),
    activityLevel: v.string(),
    dietaryApproach: v.string(),
    calorieTarget: v.optional(v.number()),
    proteinG: v.optional(v.number()),
    carbsG: v.optional(v.number()),
    fatG: v.optional(v.number()),
    tdee: v.optional(v.number()),
    updatedAt: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  foodLog: defineTable({
    userId: v.string(),
    name: v.string(),
    brand: v.optional(v.string()),
    mealType: v.string(),
    calories: v.number(),
    proteinG: v.number(),
    carbsG: v.number(),
    fatG: v.number(),
    quantity: v.number(),
    unit: v.string(),
    barcode: v.optional(v.string()),
    loggedDate: v.string(),
    /** Optional reference to a recipe used for this entry. */
    recipeId: v.optional(v.id("recipes")),
    /** Optional reference to the food photo this entry was recognized from. */
    photoId: v.optional(v.id("foodPhotos")),
    /** AI vision confidence (0-1) when recognized from a photo. */
    confidence: v.optional(v.number()),
  })
    .index("by_user_date", ["userId", "loggedDate"])
    .index("by_user", ["userId"])
    .index("by_user_meal", ["userId", "mealType"]),

  weightLog: defineTable({
    userId: v.string(),
    weightKg: v.number(),
    loggedDate: v.string(),
  })
    .index("by_user_date", ["userId", "loggedDate"])
    .index("by_user", ["userId"]),

  wearableConnections: defineTable({
    userId: v.string(),
    provider: v.string(),
    /** AES-GCM encrypted ciphertext (base64). Plaintext only set transiently in actions. */
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.string()),
    isActive: v.boolean(),
    lastSyncedAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_provider", ["userId", "provider"]),

  /**
   * Short-lived nonces (10 min TTL) bridging the authenticated authorize-URL
   * request to the unauthenticated OAuth callback exchange. Avoids a race
   * condition where the Convex auth context is briefly unavailable after the
   * external browser session returns to the app.
   */
  oauthStates: defineTable({
    nonce: v.string(),
    provider: v.string(),
    userId: v.string(),
    createdAt: v.number(),
    /**
     * Set the first time a nonce is consumed. Within a short grace window
     * (see `consumeOAuthNonce`) we keep returning the userId so duplicate
     * callbacks (e.g. WebBrowser + deep-link on Android) succeed
     * idempotently instead of throwing.
     */
    consumedAt: v.optional(v.number()),
  }).index("by_nonce", ["nonce"]),

  // ─── Wearable data pipeline (Phase 1) ─────────────────────────────────────

  /**
   * Raw 1-min granularity samples from any source.
   * Idempotent via (userId, source, sampleId).
   */
  wearableSamples: defineTable({
    userId: v.string(),
    /** Source provider: apple_health, health_connect, whoop, oura, fitbit, garmin */
    source: v.string(),
    /** Stable identifier from the source for idempotency */
    sampleId: v.string(),
    /**
     * Canonical metric type, e.g. heart_rate, resting_heart_rate, hrv_sdnn,
     * steps, active_calories, basal_calories, distance_m, oxygen_saturation,
     * respiratory_rate, sleep_stage, vo2_max
     */
    metricType: v.string(),
    /** ISO start time (inclusive) */
    startTime: v.string(),
    /** ISO end time (exclusive). For instantaneous samples, equals startTime. */
    endTime: v.string(),
    /** Day in UTC YYYY-MM-DD for fast aggregate lookup */
    day: v.string(),
    value: v.number(),
    unit: v.string(),
    /** Sleep stage value when metricType === 'sleep_stage': light|deep|rem|awake */
    stage: v.optional(v.string()),
    /** Optional source device identifier (e.g. "Apple Watch", "Galaxy Watch 6") */
    sourceDevice: v.optional(v.string()),
    /** For Health Connect: originating package name */
    sourceApp: v.optional(v.string()),
    /** Server insert time */
    syncedAt: v.string(),
  })
    .index("by_user_metric_time", ["userId", "metricType", "startTime"])
    .index("by_user_day_metric", ["userId", "day", "metricType"])
    .index("by_user_source_sample", ["userId", "source", "sampleId"])
    .index("by_user_source_metric_time", ["userId", "source", "metricType", "startTime"]),

  wearableWorkouts: defineTable({
    userId: v.string(),
    source: v.string(),
    sourceWorkoutId: v.string(),
    /** Canonical activity type: running, cycling, strength, walking, swimming, other */
    activityType: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    day: v.string(),
    durationSec: v.number(),
    activeKcal: v.optional(v.number()),
    distanceM: v.optional(v.number()),
    hrAvgBpm: v.optional(v.number()),
    hrMaxBpm: v.optional(v.number()),
    sourceDevice: v.optional(v.string()),
    syncedAt: v.string(),
  })
    .index("by_user_time", ["userId", "startTime"])
    .index("by_user_day", ["userId", "day"])
    .index("by_user_source_workout", ["userId", "source", "sourceWorkoutId"]),

  wearableDailyMetrics: defineTable({
    userId: v.string(),
    day: v.string(),
    steps: v.optional(v.number()),
    activeKcal: v.optional(v.number()),
    basalKcal: v.optional(v.number()),
    restingHrBpm: v.optional(v.number()),
    hrAvgBpm: v.optional(v.number()),
    hrMinBpm: v.optional(v.number()),
    hrMaxBpm: v.optional(v.number()),
    sleepMinutes: v.optional(v.number()),
    sleepDeepMinutes: v.optional(v.number()),
    sleepRemMinutes: v.optional(v.number()),
    sleepLightMinutes: v.optional(v.number()),
    sleepAwakeMinutes: v.optional(v.number()),
    hrvAvgMs: v.optional(v.number()),
    spo2AvgPct: v.optional(v.number()),
    respiratoryRateAvg: v.optional(v.number()),
    distanceM: v.optional(v.number()),
    vo2Max: v.optional(v.number()),
    workoutCount: v.optional(v.number()),
    workoutKcal: v.optional(v.number()),
    /**
     * Full-day energy expenditure (basal + active + workouts) as reported by
     * the wearable's daily cycle, in kcal. Set by Whoop's /v2/cycle endpoint
     * (kilojoule → kcal). Apple Health / Health Connect users typically get
     * `basalKcal + activeKcal` instead; this field stays undefined for them.
     */
    totalKcal: v.optional(v.number()),
    /** Whoop daily strain score (0–21 scale). */
    strainScore: v.optional(v.number()),
    /** Whoop-style daily skin temperature average (Celsius). */
    skinTempCelsius: v.optional(v.number()),
    /** Sleep performance score (% of needed sleep achieved). */
    sleepPerformancePct: v.optional(v.number()),
    /** Sleep efficiency (% of in-bed time actually asleep). */
    sleepEfficiencyPct: v.optional(v.number()),
    /** Sleep consistency vs. typical bedtime/wake schedule. */
    sleepConsistencyPct: v.optional(v.number()),
    /** Per metric: which source contributed the canonical value */
    metricSources: v.optional(v.any()),
    lastUpdatedAt: v.string(),
  }).index("by_user_day", ["userId", "day"]),

  /**
   * Per-user UI preferences that need to sync across devices.
   * Currently used for the customizable Health Data tile grid; future fields
   * (sidebar order, default time window, etc.) extend this same table.
   */
  userPreferences: defineTable({
    userId: v.string(),
    /** Ordered list of enabled tile IDs from healthTiles.ts catalogue. */
    dashboardTileIds: v.optional(v.array(v.string())),
    updatedAt: v.string(),
  }).index("by_user", ["userId"]),

  wearableSyncState: defineTable({
    userId: v.string(),
    source: v.string(),
    metricType: v.string(),
    /** ISO endTime of latest synced sample - inclusive boundary for next pull */
    lastSyncedEnd: v.string(),
    lastFullSyncAt: v.optional(v.string()),
    updatedAt: v.string(),
  }).index("by_user_source_metric", ["userId", "source", "metricType"]),

  /**
   * Per-day per-metric source priority. Defaults are computed in the aggregator
   * (e.g. Whoop > Oura > Apple/HC for HRV; Garmin/Apple > HC for steps).
   */
  wearableSourceDevices: defineTable({
    userId: v.string(),
    day: v.string(),
    metricType: v.string(),
    /** Source chosen as canonical for this metric on this day */
    chosenSource: v.string(),
    /** Tie-break info: total samples seen per source */
    candidateSources: v.optional(v.array(v.string())),
    updatedAt: v.string(),
  }).index("by_user_day_metric", ["userId", "day", "metricType"]),

  // ─── Phase 3: ambitious food tracker ──────────────────────────────────────

  recipes: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    /** servings the totals refer to */
    servings: v.number(),
    /** stored ingredient list (display + recompute) */
    ingredients: v.array(
      v.object({
        name: v.string(),
        quantity: v.number(),
        unit: v.string(),
        calories: v.number(),
        proteinG: v.number(),
        carbsG: v.number(),
        fatG: v.number(),
      })
    ),
    /** Per-serving totals */
    totals: v.object({
      calories: v.number(),
      proteinG: v.number(),
      carbsG: v.number(),
      fatG: v.number(),
    }),
    isPublicTemplate: v.optional(v.boolean()),
    updatedAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_name", ["userId", "name"]),

  mealTemplates: defineTable({
    userId: v.string(),
    name: v.string(),
    mealType: v.string(),
    items: v.array(
      v.object({
        name: v.string(),
        brand: v.optional(v.string()),
        calories: v.number(),
        proteinG: v.number(),
        carbsG: v.number(),
        fatG: v.number(),
        quantity: v.number(),
        unit: v.string(),
        recipeId: v.optional(v.id("recipes")),
      })
    ),
    updatedAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_meal", ["userId", "mealType"]),

  foodPhotos: defineTable({
    userId: v.string(),
    storageId: v.string(),
    recognizedAt: v.optional(v.string()),
    modelVersion: v.optional(v.string()),
    /** The recognized items with confidences (raw model output before user edits) */
    recognizedItems: v.optional(
      v.array(
        v.object({
          name: v.string(),
          quantity: v.number(),
          unit: v.string(),
          calories: v.number(),
          proteinG: v.number(),
          carbsG: v.number(),
          fatG: v.number(),
          confidence: v.number(),
        })
      )
    ),
    error: v.optional(v.string()),
    createdAt: v.string(),
  }).index("by_user", ["userId"]),

  /**
   * Daily call quota for expensive AI features (photo recognition, etc.)
   * to enforce free vs pro limits server-side.
   */
  aiUsageDaily: defineTable({
    userId: v.string(),
    day: v.string(),
    feature: v.string(),
    count: v.number(),
    updatedAt: v.string(),
  }).index("by_user_day_feature", ["userId", "day", "feature"]),

  // ─── Phase 4: Unified Energy Analytics ────────────────────────────────────

  energyBalanceDaily: defineTable({
    userId: v.string(),
    day: v.string(),
    intakeKcal: v.optional(v.number()),
    activeKcal: v.optional(v.number()),
    basalKcal: v.optional(v.number()),
    /** TDEE estimate using Mifflin-St-Jeor + activity factor + workout */
    tdeeEstimate: v.optional(v.number()),
    /** intakeKcal - tdeeEstimate (negative = deficit) */
    balanceKcal: v.optional(v.number()),
    proteinG: v.optional(v.number()),
    proteinPerKg: v.optional(v.number()),
    /** % of daily macro targets met (0-100) */
    macroCompliancePct: v.optional(v.number()),
    /** Training load proxy: workout kcal + steps/100 */
    trainingLoad: v.optional(v.number()),
    /** Recovery proxy from HRV + sleep + RHR (0-100) */
    recoveryProxy: v.optional(v.number()),
    updatedAt: v.string(),
  }).index("by_user_day", ["userId", "day"]),

  // ─── Phase 5: Elysia Health Score & Aging Engine ─────────────────────────
  //
  // Implementation of docs/analytics/scoring-model-v1.md. Tier-aware: the
  // `pillarScores` map ALWAYS carries the full key set declared in
  // `pillarRegistry.ts`; pillars for which the user has no source data yet
  // (notably all Tier 2/3) are stored as `null` so coverage/tier computations
  // stay consistent. See the spec for formulas, weights, and references.

  dailyHealthScores: defineTable({
    userId: v.string(),
    day: v.string(),
    /** Map of PillarId -> 0..100 score (or null when no source data). */
    pillarScores: v.any(),
    /** Weighted composite over the active (non-null) pillars, 0..100. */
    composite: v.optional(v.number()),
    /** Highest tier present among active pillars (1, 2 or 3). */
    tierLevel: v.optional(v.number()),
    /** Share of Tier 1 pillars that contributed: 0..1. */
    coverage: v.optional(v.number()),
    /**
     * UI-layer aggregates (v1.2.0): map of WheelLayerId -> 0..100 score (or
     * null). Derived from pillarScores via computeLayerScores; persisted so
     * range queries can render the Longevity Wheel without re-aggregating.
     */
    layerScores: v.optional(v.any()),
    /**
     * Sign of the 7-day rolling slope of `composite`. One of
     * "improving" | "stable" | "declining". Null until 7 days of coverage.
     */
    trajectoryStatus: v.optional(v.string()),
    /**
     * Sum of today's `longevityContributions[].deltaMinutes`. Cached for the
     * Longevity Battery & dashboard summaries. Null until contributions are
     * computed.
     */
    healthspanCreditsToday: v.optional(v.number()),
    scoreModelVersion: v.string(),
    updatedAt: v.string(),
  }).index("by_user_day", ["userId", "day"]),

  /**
   * Per-user median baselines computed at the end of the 14-day calibration
   * window. `metrics` is a free-form object keyed by metric name
   * (e.g. hrvMedian, rhrMedian, sleepMedian) — kept loose to allow Tier 2/3
   * additions without schema migrations.
   */
  userBaselines: defineTable({
    userId: v.string(),
    windowStart: v.string(),
    windowEnd: v.string(),
    metrics: v.any(),
    /** "calibrating" (day 1-14), "ready" (>=14), "stale" (re-baseline due). */
    status: v.string(),
    daysCalibrated: v.number(),
    scoreModelVersion: v.string(),
    updatedAt: v.string(),
  }).index("by_user", ["userId"]),

  /**
   * Versioned snapshot of the entire pillar registry so any past
   * dailyHealthScores / agingTrajectory row can be re-derived bit-for-bit.
   */
  scoreModelVersions: defineTable({
    version: v.string(),
    releasedAt: v.string(),
    /**
     * Serialised pillar registry: [{ id, tier, weight, lambda, beta,
     * requiredSources, label, active }]. Stored as v.any() so we can evolve
     * pillar metadata without nested validator gymnastics.
     */
    pillarRegistry: v.any(),
    description: v.optional(v.string()),
  }).index("by_version", ["version"]),

  /**
   * Daily Elysia Age + Aging Velocity. NOT written while the user is still
   * calibrating (first 14 days). See docs/analytics/scoring-model-v1.md §8.
   */
  agingTrajectory: defineTable({
    userId: v.string(),
    day: v.string(),
    chronoAge: v.number(),
    elysiaAge: v.number(),
    /** elysiaAge - chronoAge. Positive = older biological than chrono. */
    delta: v.number(),
    /**
     * 28-day rolling OLS slope of `(elysiaAge - chronoAge)` extrapolated to
     * years per year. Null until >=14 trajectory rows exist.
     */
    velocity28d: v.optional(v.number()),
    /** 0..1 trust score driven by calibration + Tier-1 coverage. */
    confidence: v.number(),
    tierLevel: v.optional(v.number()),
    scoreModelVersion: v.string(),
    updatedAt: v.string(),
  }).index("by_user_day", ["userId", "day"]),

  /**
   * Per-pillar daily delta vs the user's 28-day pillar baseline, expressed
   * in equivalent minutes of life expectancy. Powers the
   * LongevityPerformanceView waterfall chart.
   */
  longevityContributions: defineTable({
    userId: v.string(),
    day: v.string(),
    pillar: v.string(),
    tier: v.number(),
    /** Positive = healthspan gain, negative = healthspan loss. */
    deltaMinutes: v.number(),
    /** Short human-readable explanation: "Sleep 6h vs your avg 7h". */
    rationale: v.string(),
    scoreModelVersion: v.string(),
  })
    .index("by_user_day", ["userId", "day"])
    .index("by_user_pillar_day", ["userId", "pillar", "day"]),

  // ─── Phase 5: AI insights ─────────────────────────────────────────────────

  insights: defineTable({
    userId: v.string(),
    day: v.string(),
    /** Category: recovery | nutrition | training | sleep | balance | streak */
    category: v.string(),
    /** Severity: positive | neutral | warning */
    severity: v.string(),
    title: v.string(),
    body: v.string(),
    /** Optional structured action: { kind, label, payload } */
    action: v.optional(
      v.object({
        kind: v.string(),
        label: v.string(),
        payload: v.optional(v.any()),
      })
    ),
    dismissedAt: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_user_day", ["userId", "day"])
    .index("by_user_created", ["userId", "createdAt"]),
});
