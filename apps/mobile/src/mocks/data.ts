import type {
  DashboardTile,
  Entitlement,
  ProtocolTemplate,
  UserHabit,
  CatalogItem,
} from "@elysia/domain";

export const mockEntitlement: Entitlement = {
  userId: "b48e7eb8-b812-44b0-abcb-7a5afca70a13",
  tier: "free",
  features: [
    "dashboard.core",
    "library.core",
    "habits.core",
    "products.core",
    "diagnostics.placeholders",
    "nutrition.placeholder",
  ],
};

export const mockUserSummary = {
  name: "Alex",
  longevityScore: 74,
  activeStreakDays: 12,
  weeklyCompletionRate: 0.71,
};

export const mockDashboardTiles: DashboardTile[] = [
  {
    tileId: "habit_consistency",
    title: "Habit Consistency",
    description: "7-day completion trend across all active habits.",
    status: "active",
    metricKeys: ["habit_completion_rate"],
    insight: "Up 12% vs last week — keep the momentum.",
  },
  {
    tileId: "body_metrics",
    title: "Body Metrics",
    description: "Weight, BMI, and body composition trends.",
    status: "active",
    metricKeys: ["weight_kg", "bmi"],
    insight: "Last logged: 79.2 kg · BMI 24.1",
  },
  {
    tileId: "wearable_recovery",
    title: "Recovery and Sleep",
    description: "Connect Apple Health, Oura, Garmin, or Whoop for sleep and HRV data.",
    status: "placeholder_connect",
    metricKeys: [],
    ctaLabel: "Connect Source",
    requiredFeature: "dashboard.integrations",
  },
  {
    tileId: "nutrition_module",
    title: "Nutrition",
    description: "Daily macro tracking with food log and barcode scanning.",
    status: "placeholder_coming_soon",
    metricKeys: [],
    ctaLabel: "Coming in Phase 2",
    requiredFeature: "nutrition.placeholder",
  },
  {
    tileId: "diagnostics",
    title: "Diagnostics",
    description: "Blood panels, genetics, skin and hair analysis from partner clinics.",
    status: "placeholder_coming_soon",
    metricKeys: [],
    ctaLabel: "Coming Soon",
    requiredFeature: "diagnostics.placeholders",
  },
];

export const ALL_CATEGORIES = [
  "sleep",
  "recovery",
  "training",
  "nutrition",
  "supplementation",
  "cold_exposure",
  "meditation",
  "skincare",
  "mobility",
  "stress",
  "productivity",
  "preventive",
];

export const mockTemplates: ProtocolTemplate[] = [
  {
    templateId: "5f3ed6cc-0452-4bcf-b888-b5f9c863455f",
    slug: "morning-sunlight-routine",
    title: "Morning Sunlight Routine",
    shortExplanation: "10–20 min of outdoor light within 60 minutes of waking.",
    expectedBenefit: "Stronger circadian alignment, improved sleep onset, and more stable morning energy.",
    category: "sleep",
    evidenceRationale:
      "Retinal light exposure in the first hour after waking anchors cortisol peak timing and suppresses inappropriate evening melatonin secretion.",
    references: [
      {
        title: "Entrainment of the human circadian clock to the natural light-dark cycle",
        sourceType: "study",
        publicationYear: 2013,
        url: "https://doi.org/10.1016/j.cub.2013.06.039",
      },
    ],
    defaultSchedule: {
      frequencyPerWeek: 7,
      targetTimesOfDay: ["morning"],
      startsOn: "2026-03-18",
    },
    premiumTierRequired: "free",
    linkedCatalogItemIds: [],
    isPublished: true,
  },
  {
    templateId: "c0d59f5c-82f8-4afb-aeb0-4cf3c59d39b5",
    slug: "sauna-heat-exposure-protocol",
    title: "Sauna Heat Exposure Protocol",
    shortExplanation: "3–4 sessions per week, 15–20 min at 80–100°C with hydration and cooldown.",
    expectedBenefit: "Improved cardiovascular conditioning, heat shock protein expression, and post-workout recovery.",
    category: "recovery",
    evidenceRationale:
      "Repeated sauna use is associated with dose-dependent reductions in all-cause cardiovascular mortality and improvements in VO2max proxy markers.",
    references: [
      {
        title: "Sauna bathing and risk of sudden cardiac death (KIHD cohort)",
        sourceType: "study",
        publicationYear: 2018,
        url: "https://doi.org/10.1186/s12872-018-0845-z",
      },
    ],
    defaultSchedule: {
      frequencyPerWeek: 4,
      targetTimesOfDay: ["evening"],
      startsOn: "2026-03-18",
    },
    premiumTierRequired: "pro",
    linkedCatalogItemIds: [],
    isPublished: true,
  },
  {
    templateId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    slug: "daily-step-target",
    title: "Daily 8,000-Step Walking Target",
    shortExplanation: "Achieve 8,000–10,000 steps distributed across the day.",
    expectedBenefit: "Reduced all-cause mortality risk, improved metabolic health and insulin sensitivity.",
    category: "training",
    evidenceRationale:
      "Step count above 7,000/day associates with 50–70% lower all-cause mortality even without structured exercise sessions.",
    references: [
      {
        title: "Steps per day and all-cause mortality in older adults (JAMA Internal Medicine)",
        sourceType: "study",
        publicationYear: 2021,
        url: "https://doi.org/10.1001/jamainternmed.2021.3010",
      },
    ],
    defaultSchedule: {
      frequencyPerWeek: 7,
      targetTimesOfDay: ["morning", "afternoon"],
      startsOn: "2026-03-18",
    },
    premiumTierRequired: "free",
    linkedCatalogItemIds: [],
    isPublished: true,
  },
  {
    templateId: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    slug: "protein-first-meal-structure",
    title: "Protein-First Meal Structure",
    shortExplanation: "Structure each meal to lead with a high-quality protein source (30–50g per meal).",
    expectedBenefit: "Improved muscle protein synthesis, better satiety signaling, and reduced postprandial glucose spikes.",
    category: "nutrition",
    evidenceRationale:
      "Leucine threshold (~2.5–3g per meal) is required to maximally activate mTORC1 and drive muscle protein synthesis regardless of caloric state.",
    references: [
      {
        title: "Protein distribution and muscle protein synthesis (Nutrients)",
        sourceType: "review",
        publicationYear: 2020,
        url: "https://doi.org/10.3390/nu12051441",
      },
    ],
    defaultSchedule: {
      frequencyPerWeek: 7,
      targetTimesOfDay: ["morning", "midday", "evening"],
      startsOn: "2026-03-18",
    },
    premiumTierRequired: "free",
    linkedCatalogItemIds: [],
    isPublished: true,
  },
  {
    templateId: "c3d4e5f6-a7b8-9012-cdef-123456789012",
    slug: "omega-3-daily-protocol",
    title: "Omega-3 Daily Supplementation",
    shortExplanation: "1–2g combined EPA/DHA daily with a meal containing dietary fat.",
    expectedBenefit: "Reduced systemic inflammation, improved triglyceride profile, and cardioprotective effects.",
    category: "supplementation",
    evidenceRationale:
      "EPA/DHA supplementation consistently reduces plasma triglycerides and modulates prostaglandin pathways associated with chronic inflammation.",
    references: [
      {
        title: "Marine omega-3 supplementation and cardiovascular disease (NEJM)",
        sourceType: "meta_analysis",
        publicationYear: 2019,
        url: "https://doi.org/10.1056/NEJMoa1812792",
      },
    ],
    defaultSchedule: {
      frequencyPerWeek: 7,
      targetTimesOfDay: ["morning"],
      startsOn: "2026-03-18",
    },
    premiumTierRequired: "free",
    linkedCatalogItemIds: [],
    isPublished: true,
  },
  {
    templateId: "d4e5f6a7-b8c9-0123-defa-234567890123",
    slug: "cold-shower-protocol",
    title: "Cold Shower Protocol",
    shortExplanation: "End each shower with 2–3 minutes of cold water (15°C or below).",
    expectedBenefit: "Norepinephrine increase, improved alertness, faster post-exercise recovery.",
    category: "cold_exposure",
    evidenceRationale:
      "Cold water immersion acutely increases plasma norepinephrine by 200–300%, which is associated with improved mood, alertness, and metabolic rate.",
    references: [
      {
        title: "Cold exposure and norepinephrine response (European Journal of Applied Physiology)",
        sourceType: "study",
        publicationYear: 2000,
        url: "https://doi.org/10.1007/s004210050628",
      },
    ],
    defaultSchedule: {
      frequencyPerWeek: 5,
      targetTimesOfDay: ["morning"],
      startsOn: "2026-03-18",
    },
    premiumTierRequired: "free",
    linkedCatalogItemIds: [],
    isPublished: true,
  },
  {
    templateId: "e5f6a7b8-c9d0-1234-efab-345678901234",
    slug: "box-breathing-practice",
    title: "Box Breathing Practice",
    shortExplanation: "5 minutes of 4-4-4-4 box breathing before high-stress periods or before sleep.",
    expectedBenefit: "Reduced cortisol, lowered resting heart rate, improved HRV over time.",
    category: "meditation",
    evidenceRationale:
      "Slow-paced breathing at 5–6 breaths/min activates baroreceptor reflex and maximizes HRV, which is a direct marker of parasympathetic tone.",
    references: [
      {
        title: "Slow breathing as a therapeutic tool (Frontiers in Human Neuroscience)",
        sourceType: "review",
        publicationYear: 2018,
        url: "https://doi.org/10.3389/fnhum.2018.00353",
      },
    ],
    defaultSchedule: {
      frequencyPerWeek: 7,
      targetTimesOfDay: ["morning", "evening"],
      startsOn: "2026-03-18",
    },
    premiumTierRequired: "free",
    linkedCatalogItemIds: [],
    isPublished: true,
  },
  {
    templateId: "f6a7b8c9-d0e1-2345-fabc-456789012345",
    slug: "daily-spf-routine",
    title: "Daily SPF Protection Routine",
    shortExplanation: "Apply SPF 30+ sunscreen every morning regardless of cloud cover or indoor plans.",
    expectedBenefit: "Reduced photoaging, lowered skin cancer risk, and maintained collagen integrity.",
    category: "skincare",
    evidenceRationale:
      "Daily sunscreen use reduces photoaging measurably within 4.5 years, and UV exposure is the single largest modifiable contributor to skin aging.",
    references: [
      {
        title: "Daily sunscreen application and photoaging (Annals of Internal Medicine)",
        sourceType: "study",
        publicationYear: 2013,
        url: "https://doi.org/10.7326/0003-4819-158-11-201306040-00002",
      },
    ],
    defaultSchedule: {
      frequencyPerWeek: 7,
      targetTimesOfDay: ["morning"],
      startsOn: "2026-03-18",
    },
    premiumTierRequired: "free",
    linkedCatalogItemIds: [],
    isPublished: true,
  },
  {
    templateId: "a7b8c9d0-e1f2-3456-abcd-567890123456",
    slug: "hip-thoracic-mobility",
    title: "Hip and Thoracic Mobility Routine",
    shortExplanation: "10–15 min morning mobility work targeting hip flexors, thoracic spine rotation, and ankle dorsiflexion.",
    expectedBenefit: "Reduced injury risk, improved posture under desk-heavy workdays, better squat and lift mechanics.",
    category: "mobility",
    evidenceRationale:
      "Desk-bound professionals show progressive hip flexor tightening and thoracic kyphosis progression — active mobility work counteracts these structural changes.",
    references: [
      {
        title: "Sedentary behavior and musculoskeletal health (BJM Open)",
        sourceType: "review",
        publicationYear: 2019,
        url: "https://doi.org/10.1136/bmjopen-2019-035684",
      },
    ],
    defaultSchedule: {
      frequencyPerWeek: 5,
      targetTimesOfDay: ["morning"],
      startsOn: "2026-03-18",
    },
    premiumTierRequired: "pro",
    linkedCatalogItemIds: [],
    isPublished: true,
  },
  {
    templateId: "b8c9d0e1-f2a3-4567-bcde-678901234567",
    slug: "hrv-stress-management",
    title: "HRV-Based Stress Load Management",
    shortExplanation: "Track morning HRV daily and adjust training/social load based on trend, not single readings.",
    expectedBenefit: "Prevents sympathetic overload, optimizes recovery timing, and improves long-term performance ceiling.",
    category: "stress",
    evidenceRationale:
      "HRV is the most validated non-invasive proxy for autonomic nervous system balance. Trend-based load adjustment outperforms fixed periodization in long-term outcomes.",
    references: [
      {
        title: "HRV-guided training vs. pre-planned training (IJSPP)",
        sourceType: "study",
        publicationYear: 2016,
        url: "https://doi.org/10.1123/ijspp.2015-0782",
      },
    ],
    defaultSchedule: {
      frequencyPerWeek: 7,
      targetTimesOfDay: ["morning"],
      startsOn: "2026-03-18",
    },
    premiumTierRequired: "pro",
    linkedCatalogItemIds: [],
    isPublished: true,
  },
  {
    templateId: "c9d0e1f2-a3b4-5678-cdef-789012345678",
    slug: "deep-work-time-blocking",
    title: "Deep Work Time-Blocking System",
    shortExplanation: "Reserve 2–4 h of uninterrupted, distraction-free cognitive work in your peak alertness window.",
    expectedBenefit: "Higher quality output per hour, lower cortisol from context-switching, more sustainable energy management.",
    category: "productivity",
    evidenceRationale:
      "Task-switching has a measurable cognitive overhead cost. Blocking focus time during morning cortisol peaks leverages natural neurological priming for demanding cognitive work.",
    references: [
      {
        title: "Cost of task-switching and attention residue (Journal of Experimental Psychology)",
        sourceType: "study",
        publicationYear: 2005,
        url: "https://doi.org/10.1037/0278-7393.31.1.134",
      },
    ],
    defaultSchedule: {
      frequencyPerWeek: 5,
      targetTimesOfDay: ["morning"],
      startsOn: "2026-03-18",
    },
    premiumTierRequired: "free",
    linkedCatalogItemIds: [],
    isPublished: true,
  },
  {
    templateId: "d0e1f2a3-b4c5-6789-defa-890123456789",
    slug: "annual-biomarker-panel",
    title: "Annual Preventive Biomarker Panel",
    shortExplanation: "Schedule a full preventive lab panel including lipids, glucose, hormones, inflammatory markers, and vitamins.",
    expectedBenefit: "Early identification of metabolic drift, hormone imbalances, and micronutrient deficiencies before they become symptomatic.",
    category: "preventive",
    evidenceRationale:
      "Subclinical changes in ApoB, fasting insulin, testosterone, and hs-CRP are detectable years before clinical diagnosis — allowing intervention at maximum reversibility.",
    references: [
      {
        title: "Preventive cardiovascular biomarkers (European Heart Journal)",
        sourceType: "guideline",
        publicationYear: 2021,
        url: "https://doi.org/10.1093/eurheartj/ehab484",
      },
    ],
    defaultSchedule: {
      frequencyPerWeek: 1,
      targetTimesOfDay: ["morning"],
      startsOn: "2026-03-18",
    },
    premiumTierRequired: "pro",
    linkedCatalogItemIds: [],
    isPublished: true,
  },
  // ─── Additional templates ──────────────────────────────────────────────────
  {
    templateId: "e1f2a3b4-c5d6-7890-efab-901234567890",
    slug: "sleep-wind-down-protocol",
    title: "Sleep Wind-Down Protocol",
    shortExplanation: "90-minute pre-sleep routine: dim lights, no screens, light stretch, and bedroom cooling to 18–20°C.",
    expectedBenefit: "Faster sleep onset, increased deep sleep percentage, and improved next-day cognitive performance.",
    category: "sleep",
    evidenceRationale:
      "Core body temperature must drop 1–2°C to initiate sleep. Room cooling accelerates this. Blue light suppresses melatonin by up to 50% for 3h post-exposure.",
    references: [
      {
        title: "Effects of bedroom temperature on sleep quality (Journal of Physiological Anthropology)",
        sourceType: "study",
        publicationYear: 2019,
        url: "https://doi.org/10.1186/s40101-019-0190-7",
      },
    ],
    defaultSchedule: {
      frequencyPerWeek: 7,
      targetTimesOfDay: ["evening"],
      startsOn: "2026-03-18",
    },
    premiumTierRequired: "free",
    linkedCatalogItemIds: [],
    isPublished: true,
  },
  {
    templateId: "f2a3b4c5-d6e7-8901-fabc-012345678901",
    slug: "zone-2-cardio-protocol",
    title: "Zone 2 Cardio Protocol",
    shortExplanation: "3–4 sessions per week of 45–60 min at conversational pace (60–70% max HR).",
    expectedBenefit: "Mitochondrial biogenesis, improved fat oxidation, and sustained aerobic base for longevity.",
    category: "training",
    evidenceRationale:
      "Zone 2 exercise maximizes mitochondrial density adaptations and improves metabolic flexibility — the metabolic hallmarks most predictive of long-term healthspan.",
    references: [
      {
        title: "Zone 2 training and mitochondrial health (Cell Metabolism)",
        sourceType: "review",
        publicationYear: 2023,
        url: "https://doi.org/10.1016/j.cmet.2023.02.010",
      },
    ],
    defaultSchedule: {
      frequencyPerWeek: 4,
      targetTimesOfDay: ["morning", "afternoon"],
      startsOn: "2026-03-18",
    },
    premiumTierRequired: "free",
    linkedCatalogItemIds: [],
    isPublished: true,
  },
  {
    templateId: "a3b4c5d6-e7f8-9012-abcd-123456789012",
    slug: "time-restricted-eating-16-8",
    title: "Time-Restricted Eating (16:8)",
    shortExplanation: "Compress all meals into an 8-hour window (e.g. 12 pm–8 pm), fasting for 16 hours overnight.",
    expectedBenefit: "Improved metabolic flexibility, autophagy induction, and stable energy levels without caloric restriction.",
    category: "nutrition",
    evidenceRationale:
      "Time-restricted feeding aligned to daylight hours improves insulin sensitivity, reduces triglycerides, and upregulates autophagy without requiring caloric reduction.",
    references: [
      {
        title: "Time-restricted eating and metabolic outcomes (Cell Metabolism)",
        sourceType: "study",
        publicationYear: 2020,
        url: "https://doi.org/10.1016/j.cmet.2020.01.011",
      },
    ],
    defaultSchedule: {
      frequencyPerWeek: 7,
      targetTimesOfDay: ["midday", "evening"],
      startsOn: "2026-03-18",
    },
    premiumTierRequired: "free",
    linkedCatalogItemIds: [],
    isPublished: true,
  },
  {
    templateId: "b4c5d6e7-f8a9-0123-bcde-234567890123",
    slug: "vitamin-d3-k2-protocol",
    title: "Vitamin D3 + K2 Daily Supplementation",
    shortExplanation: "2,000–5,000 IU Vitamin D3 with 100–200mcg MK-7 K2, taken with a fatty meal.",
    expectedBenefit: "Optimized bone mineral density, immune modulation, and cardiovascular protection.",
    category: "supplementation",
    evidenceRationale:
      "Over 40% of Europeans are Vitamin D deficient in winter. K2 directs calcium to bone (not arterial walls), making the D3/K2 combination safer and synergistic.",
    references: [
      {
        title: "Vitamin D and K2 synergism in bone health (Nutrients)",
        sourceType: "review",
        publicationYear: 2020,
        url: "https://doi.org/10.3390/nu12010035",
      },
    ],
    defaultSchedule: {
      frequencyPerWeek: 7,
      targetTimesOfDay: ["morning"],
      startsOn: "2026-03-18",
    },
    premiumTierRequired: "free",
    linkedCatalogItemIds: [],
    isPublished: true,
  },
  {
    templateId: "c5d6e7f8-a9b0-1234-cdef-345678901234",
    slug: "ice-bath-cold-immersion",
    title: "Ice Bath Cold Immersion Protocol",
    shortExplanation: "10–15 min cold water immersion at 10–14°C, 2–3 times per week, ideally in the morning.",
    expectedBenefit: "Maximal norepinephrine response, accelerated muscle recovery, and cold adaptation.",
    category: "cold_exposure",
    evidenceRationale:
      "Full immersion protocols produce stronger neuroendocrine responses than showers, including a 200–400% norepinephrine spike that sustains alertness and improves mood for 3–4 hours.",
    references: [
      {
        title: "Cold water immersion and neurotransmitter response (Biological Psychiatry)",
        sourceType: "study",
        publicationYear: 2007,
        url: "https://doi.org/10.1016/j.biopsych.2007.09.010",
      },
    ],
    defaultSchedule: {
      frequencyPerWeek: 3,
      targetTimesOfDay: ["morning"],
      startsOn: "2026-03-18",
    },
    premiumTierRequired: "pro",
    linkedCatalogItemIds: [],
    isPublished: true,
  },
  {
    templateId: "d6e7f8a9-b0c1-2345-defa-456789012345",
    slug: "gratitude-journaling",
    title: "Gratitude Journaling Practice",
    shortExplanation: "Write 3 specific, novel gratitude entries each evening — 5–10 minutes.",
    expectedBenefit: "Reduced rumination, improved sleep quality, and measurable improvements in subjective wellbeing.",
    category: "meditation",
    evidenceRationale:
      "Gratitude practices reduce activation in the default mode network (the 'worry circuit') and increase GABA/serotonin activity, translating to improved sleep and emotional regulation.",
    references: [
      {
        title: "Gratitude intervention and wellbeing outcomes (Journal of Positive Psychology)",
        sourceType: "meta_analysis",
        publicationYear: 2021,
        url: "https://doi.org/10.1080/17439760.2020.1818807",
      },
    ],
    defaultSchedule: {
      frequencyPerWeek: 7,
      targetTimesOfDay: ["evening"],
      startsOn: "2026-03-18",
    },
    premiumTierRequired: "free",
    linkedCatalogItemIds: [],
    isPublished: true,
  },
  {
    templateId: "e7f8a9b0-c1d2-3456-efab-567890123456",
    slug: "evening-review-ritual",
    title: "Evening Review & Shutdown Ritual",
    shortExplanation: "5-min structured wind-down: complete open loops, write tomorrow's top 3 priorities, and close all work apps.",
    expectedBenefit: "Reduced cognitive overload at sleep, lower nocturnal cortisol, and improved next-day intentionality.",
    category: "productivity",
    evidenceRationale:
      "Unfinished tasks stay active in working memory (Zeigarnik effect) until 'offloaded' to a trusted system — a brief shutdown ritual terminates this memory loop and enables true rest.",
    references: [
      {
        title: "Task completion and cognitive off-loading (Psychological Science)",
        sourceType: "study",
        publicationYear: 2011,
        url: "https://doi.org/10.1177/0956797611418610",
      },
    ],
    defaultSchedule: {
      frequencyPerWeek: 5,
      targetTimesOfDay: ["evening"],
      startsOn: "2026-03-18",
    },
    premiumTierRequired: "free",
    linkedCatalogItemIds: [],
    isPublished: true,
  },
  {
    templateId: "f8a9b0c1-d2e3-4567-fabc-678901234567",
    slug: "retinol-collagen-skincare",
    title: "Retinol + Collagen Skincare Protocol",
    shortExplanation: "Nightly retinol (0.025–0.1%) application and daily oral collagen peptides (10–15g) with Vitamin C.",
    expectedBenefit: "Measurable reduction in fine lines, improved skin density, and photoaging reversal over 12 weeks.",
    category: "skincare",
    evidenceRationale:
      "Retinol is the only topical ingredient with FDA-recognized anti-aging evidence. Oral collagen peptides increase dermal collagen synthesis — effect enhanced by concurrent Vitamin C co-factor.",
    references: [
      {
        title: "Retinol and photoaging reversal (Journal of Cosmetic Dermatology)",
        sourceType: "study",
        publicationYear: 2017,
        url: "https://doi.org/10.1111/jocd.12356",
      },
    ],
    defaultSchedule: {
      frequencyPerWeek: 7,
      targetTimesOfDay: ["evening"],
      startsOn: "2026-03-18",
    },
    premiumTierRequired: "pro",
    linkedCatalogItemIds: [],
    isPublished: true,
  },
];

export const mockHabits: UserHabit[] = [
  {
    habitId: "0f6db923-4ace-44e7-a083-f70f8a7dce24",
    userId: "b48e7eb8-b812-44b0-abcb-7a5afca70a13",
    templateId: "5f3ed6cc-0452-4bcf-b888-b5f9c863455f",
    title: "Morning Sunlight",
    category: "sleep",
    expectedBenefit: "Improves circadian alignment and sleep onset.",
    state: "active",
    schedule: {
      frequencyPerWeek: 7,
      targetTimesOfDay: ["morning"],
      startsOn: "2026-03-01",
    },
    reminderRule: {
      reminderTimeLocal: "08:00",
      timezone: "Europe/Berlin",
      pushEnabled: true,
    },
    streakCount: 6,
    completionRate30d: 0.78,
    createdAt: "2026-03-01T09:00:00.000Z",
    updatedAt: "2026-03-18T09:00:00.000Z",
  },
  {
    habitId: "1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    userId: "b48e7eb8-b812-44b0-abcb-7a5afca70a13",
    title: "Daily 8k Steps",
    category: "training",
    expectedBenefit: "Reduced all-cause mortality risk.",
    state: "active",
    schedule: {
      frequencyPerWeek: 7,
      targetTimesOfDay: ["morning", "afternoon"],
      startsOn: "2026-03-10",
    },
    reminderRule: {
      reminderTimeLocal: "18:00",
      timezone: "Europe/Berlin",
      pushEnabled: true,
    },
    streakCount: 3,
    completionRate30d: 0.65,
    createdAt: "2026-03-10T09:00:00.000Z",
    updatedAt: "2026-03-18T09:00:00.000Z",
  },
  {
    habitId: "2b3c4d5e-6f7a-8901-bcde-f12345678901",
    userId: "b48e7eb8-b812-44b0-abcb-7a5afca70a13",
    title: "Cold Shower",
    category: "cold_exposure",
    expectedBenefit: "Morning alertness and faster recovery.",
    state: "active",
    schedule: {
      frequencyPerWeek: 5,
      targetTimesOfDay: ["morning"],
      startsOn: "2026-03-04",
    },
    reminderRule: {
      reminderTimeLocal: "07:30",
      timezone: "Europe/Berlin",
      pushEnabled: true,
    },
    streakCount: 12,
    completionRate30d: 0.85,
    createdAt: "2026-03-04T09:00:00.000Z",
    updatedAt: "2026-03-18T09:00:00.000Z",
  },
  {
    habitId: "3c4d5e6f-7a8b-9012-cdef-123456789012",
    userId: "b48e7eb8-b812-44b0-abcb-7a5afca70a13",
    title: "Omega-3 Supplement",
    category: "supplementation",
    expectedBenefit: "Reduced inflammation and improved lipid profile.",
    state: "planned",
    schedule: {
      frequencyPerWeek: 7,
      targetTimesOfDay: ["morning"],
      startsOn: "2026-03-25",
    },
    reminderRule: {
      reminderTimeLocal: "09:00",
      timezone: "Europe/Berlin",
      pushEnabled: false,
    },
    streakCount: 0,
    completionRate30d: 0,
    createdAt: "2026-03-18T09:00:00.000Z",
    updatedAt: "2026-03-18T09:00:00.000Z",
  },
  {
    habitId: "4d5e6f7a-8b9c-0123-defa-234567890123",
    userId: "b48e7eb8-b812-44b0-abcb-7a5afca70a13",
    title: "Deep Work Block",
    category: "productivity",
    expectedBenefit: "Higher output quality and lower cognitive fatigue.",
    state: "abandoned",
    schedule: {
      frequencyPerWeek: 5,
      targetTimesOfDay: ["morning"],
      startsOn: "2026-02-15",
    },
    reminderRule: {
      reminderTimeLocal: "09:00",
      timezone: "Europe/Berlin",
      pushEnabled: true,
    },
    streakCount: 2,
    completionRate30d: 0.4,
    createdAt: "2026-02-15T09:00:00.000Z",
    updatedAt: "2026-03-14T09:00:00.000Z",
  },
];

export interface FoodEntry {
  id: string;
  name: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  quantity: number;
  unit: string;
}

export interface MacroTarget {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export const mockMacroTarget: MacroTarget = {
  calories: 2400,
  proteinG: 190,
  carbsG: 220,
  fatG: 80,
};

export const mockFoodLog: FoodEntry[] = [
  {
    id: "f001",
    name: "Greek Yogurt (plain, 2%)",
    mealType: "breakfast",
    calories: 130,
    proteinG: 17,
    carbsG: 9,
    fatG: 3.5,
    quantity: 200,
    unit: "g",
  },
  {
    id: "f002",
    name: "Blueberries",
    mealType: "breakfast",
    calories: 57,
    proteinG: 0.7,
    carbsG: 14,
    fatG: 0.3,
    quantity: 100,
    unit: "g",
  },
  {
    id: "f003",
    name: "Chicken Breast (grilled)",
    mealType: "lunch",
    calories: 298,
    proteinG: 56,
    carbsG: 0,
    fatG: 6.5,
    quantity: 220,
    unit: "g",
  },
  {
    id: "f004",
    name: "Brown Rice (cooked)",
    mealType: "lunch",
    calories: 216,
    proteinG: 5,
    carbsG: 45,
    fatG: 1.8,
    quantity: 200,
    unit: "g",
  },
  {
    id: "f005",
    name: "Whey Protein Shake",
    mealType: "snack",
    calories: 155,
    proteinG: 30,
    carbsG: 4,
    fatG: 2.5,
    quantity: 1,
    unit: "serving",
  },
];

export const mockCatalogItems: CatalogItem[] = [
  {
    itemId: "ca000001-0000-0000-0000-000000000001",
    slug: "magnesium-glycinate-400",
    title: "Magnesium Glycinate 400mg",
    offerType: "affiliate",
    category: "supplements",
    benefitDescription:
      "Chelated magnesium form with superior bioavailability, supports sleep quality, muscle relaxation, and enzymatic reactions.",
    rationale:
      "Approximately 48% of the population consumes insufficient dietary magnesium. Glycinate chelation avoids gastrointestinal side effects common with oxide forms.",
    pricingSummary: "~€25–35 / 90 capsules",
    alternatives: ["Magnesium Citrate", "Magnesium Threonate (cognitive focus)"],
    ctaUrl: "https://example.com/magnesium-glycinate",
    regionAvailability: ["EU", "US"],
    premiumTierRequired: "free",
  },
  {
    itemId: "ca000002-0000-0000-0000-000000000002",
    slug: "whoop-4-tracker",
    title: "Whoop 4.0 Recovery Tracker",
    offerType: "affiliate",
    category: "recovery_tools",
    benefitDescription:
      "24/7 wrist-worn recovery and strain tracker measuring HRV, sleep quality, respiratory rate, and daily strain score.",
    rationale:
      "Provides continuous recovery data without a screen distraction, making it ideal for professionals wanting passive health monitoring.",
    pricingSummary: "~€30/month subscription (device included)",
    alternatives: ["Oura Ring Gen 3", "Garmin Body Battery"],
    ctaUrl: "https://example.com/whoop",
    regionAvailability: ["EU", "US"],
    premiumTierRequired: "free",
  },
  {
    itemId: "ca000003-0000-0000-0000-000000000003",
    slug: "ag1-athletic-greens",
    title: "AG1 Athletic Greens",
    offerType: "affiliate",
    category: "supplements",
    benefitDescription:
      "All-in-one greens powder with 75 vitamins, minerals, probiotics, and adaptogens in a single daily serving.",
    rationale:
      "Convenient micronutrient insurance for high-performing professionals whose diet may not cover all micronutrient bases consistently.",
    pricingSummary: "~€99/month",
    alternatives: ["Individual vitamin stack", "Green food supplementation"],
    ctaUrl: "https://example.com/ag1",
    regionAvailability: ["EU", "US"],
    premiumTierRequired: "free",
  },
  {
    itemId: "ca000004-0000-0000-0000-000000000004",
    slug: "vo2max-fitness-assessment",
    title: "VO2max Fitness Assessment",
    offerType: "partner",
    category: "diagnostics",
    benefitDescription:
      "Lab-grade cardiorespiratory fitness test providing your VO2max score, aerobic threshold zones, and fitness age benchmarking.",
    rationale:
      "VO2max is the strongest predictor of all-cause mortality beyond age 40 — better than cholesterol, blood pressure, or BMI alone.",
    pricingSummary: "~€150–250 per test",
    alternatives: ["Garmin/Apple Watch estimate", "Cooper 12-min run test"],
    ctaUrl: "https://example.com/vo2max-test",
    regionAvailability: ["DE", "AT", "CH"],
    premiumTierRequired: "pro",
  },
  {
    itemId: "ca000005-0000-0000-0000-000000000005",
    slug: "infrared-sauna-package",
    title: "Infrared Sauna Session Package",
    offerType: "partner",
    category: "sauna",
    benefitDescription:
      "10-session package at partner wellness facility with private infrared sauna cabins and guided heat protocol.",
    rationale:
      "Infrared saunas achieve similar cardiovascular and recovery adaptations at lower ambient temperatures — making them more accessible for beginners.",
    pricingSummary: "~€180–220 for 10 sessions",
    alternatives: ["Traditional Finnish sauna", "At-home portable sauna tent"],
    ctaUrl: "https://example.com/sauna-package",
    regionAvailability: ["DE"],
    premiumTierRequired: "pro",
  },
  {
    itemId: "ca000006-0000-0000-0000-000000000006",
    slug: "omega3-ultra-pure",
    title: "Omega-3 Ultra Pure (IFOS Certified)",
    offerType: "affiliate",
    category: "supplements",
    benefitDescription:
      "Pharmaceutical-grade fish oil with 5-star IFOS purity certification, 1000mg EPA + 500mg DHA per serving.",
    rationale:
      "IFOS certification ensures no rancidity or heavy metal contamination — critical quality concerns with generic omega-3 products.",
    pricingSummary: "~€35–45 / 60 softgels",
    alternatives: ["Algae-based omega-3 (vegan)", "Krill oil"],
    ctaUrl: "https://example.com/omega3-ultra",
    regionAvailability: ["EU", "US"],
    premiumTierRequired: "free",
  },
];

export const CATALOG_CATEGORIES = [
  "supplements",
  "recovery_tools",
  "diagnostics",
  "sauna",
];
