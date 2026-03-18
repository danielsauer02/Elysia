import { z } from "zod";

export const subscriptionTierSchema = z.enum(["free", "pro", "elite"]);
export type SubscriptionTier = z.infer<typeof subscriptionTierSchema>;

export const habitStateSchema = z.enum([
  "planned",
  "active",
  "paused",
  "abandoned"
]);
export type HabitState = z.infer<typeof habitStateSchema>;

export const metricSourceSchema = z.enum([
  "manual",
  "apple_health",
  "garmin",
  "whoop",
  "oura",
  "nutrition",
  "diagnostics_placeholder"
]);
export type MetricSource = z.infer<typeof metricSourceSchema>;

export const featureKeySchema = z.enum([
  "dashboard.core",
  "dashboard.integrations",
  "library.core",
  "library.premium_templates",
  "habits.core",
  "products.core",
  "diagnostics.placeholders",
  "nutrition.placeholder",
  "community.placeholder"
]);
export type FeatureKey = z.infer<typeof featureKeySchema>;

export const userProfileSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().min(2),
  email: z.string().email(),
  dateOfBirth: z.string().date(),
  heightCm: z.number().positive().max(260),
  weightKg: z.number().positive().max(500),
  sex: z.enum(["female", "male", "other", "prefer_not_to_say"]).optional(),
  goals: z.array(z.string().min(2)).min(1),
  wearableOwnership: z.array(z.string()).default([]),
  timezone: z.string().min(1),
  region: z.string().min(2),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const onboardingPayloadSchema = z.object({
  fullName: z.string().min(2),
  dateOfBirth: z.string().date(),
  heightCm: z.number().positive(),
  weightKg: z.number().positive(),
  sex: z.enum(["female", "male", "other", "prefer_not_to_say"]).optional(),
  goals: z.array(z.string().min(2)).min(1).max(8),
  wearableOwnership: z.array(z.string()).default([]),
  timezone: z.string(),
  region: z.string().min(2),
  consentVersion: z.string().min(1),
  marketingOptIn: z.boolean().default(false)
});
export type OnboardingPayload = z.infer<typeof onboardingPayloadSchema>;

export const reminderRuleSchema = z.object({
  reminderTimeLocal: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string(),
  pushEnabled: z.boolean().default(true)
});
export type ReminderRule = z.infer<typeof reminderRuleSchema>;

export const habitScheduleSchema = z.object({
  frequencyPerWeek: z.number().int().min(1).max(21),
  targetTimesOfDay: z
    .array(z.enum(["morning", "midday", "afternoon", "evening"]))
    .min(1),
  startsOn: z.string().date(),
  endsOn: z.string().date().optional()
});
export type HabitSchedule = z.infer<typeof habitScheduleSchema>;

export const userHabitSchema = z.object({
  habitId: z.string().uuid(),
  userId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  title: z.string().min(2),
  category: z.string().min(2),
  expectedBenefit: z.string().min(4),
  state: habitStateSchema,
  schedule: habitScheduleSchema,
  reminderRule: reminderRuleSchema,
  streakCount: z.number().int().nonnegative().default(0),
  completionRate30d: z.number().min(0).max(1).default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type UserHabit = z.infer<typeof userHabitSchema>;

export const evidenceReferenceSchema = z.object({
  title: z.string().min(4),
  sourceType: z.enum(["study", "meta_analysis", "review", "guideline"]),
  publicationYear: z.number().int().min(1900).max(2100),
  url: z.string().url()
});
export type EvidenceReference = z.infer<typeof evidenceReferenceSchema>;

export const protocolTemplateSchema = z.object({
  templateId: z.string().uuid(),
  slug: z.string().min(2),
  title: z.string().min(4),
  shortExplanation: z.string().min(12),
  expectedBenefit: z.string().min(8),
  category: z.string().min(2),
  evidenceRationale: z.string().min(12),
  references: z.array(evidenceReferenceSchema).default([]),
  defaultSchedule: habitScheduleSchema.optional(),
  premiumTierRequired: subscriptionTierSchema.default("free"),
  linkedCatalogItemIds: z.array(z.string().uuid()).default([]),
  isPublished: z.boolean().default(false)
});
export type ProtocolTemplate = z.infer<typeof protocolTemplateSchema>;

export const metricObservationSchema = z.object({
  observationId: z.string().uuid(),
  userId: z.string().uuid(),
  metricKey: z.string().min(2),
  source: metricSourceSchema,
  value: z.number(),
  unit: z.string().min(1),
  observedAt: z.string().datetime()
});
export type MetricObservation = z.infer<typeof metricObservationSchema>;

export const dashboardTileSchema = z.object({
  tileId: z.string().min(2),
  title: z.string().min(2),
  description: z.string().min(4),
  status: z.enum(["active", "placeholder_connect", "placeholder_coming_soon"]),
  metricKeys: z.array(z.string()).default([]),
  insight: z.string().optional(),
  ctaLabel: z.string().optional(),
  requiredFeature: featureKeySchema.optional()
});
export type DashboardTile = z.infer<typeof dashboardTileSchema>;

export const catalogItemSchema = z.object({
  itemId: z.string().uuid(),
  slug: z.string().min(2),
  title: z.string().min(4),
  offerType: z.enum(["affiliate", "internal", "partner"]),
  category: z.string().min(2),
  benefitDescription: z.string().min(10),
  rationale: z.string().min(10),
  pricingSummary: z.string().min(1),
  alternatives: z.array(z.string()).default([]),
  ctaUrl: z.string().url(),
  regionAvailability: z.array(z.string().min(2)).default([]),
  premiumTierRequired: subscriptionTierSchema.default("free")
});
export type CatalogItem = z.infer<typeof catalogItemSchema>;

export const entitlementSchema = z.object({
  userId: z.string().uuid(),
  tier: subscriptionTierSchema,
  features: z.array(featureKeySchema),
  expiresAt: z.string().datetime().optional()
});
export type Entitlement = z.infer<typeof entitlementSchema>;

export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    ok: z.boolean(),
    data: dataSchema,
    requestId: z.string().min(8)
  });
