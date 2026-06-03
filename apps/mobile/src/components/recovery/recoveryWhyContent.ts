/**
 * Copy + evidence-backed facts for the "Why recovery matters" education block.
 *
 * Each benefit carries: an orbit node icon, a generated hero visual for its
 * detail sheet, a short summary, a lead paragraph and 3–4 researched facts
 * (each citing a well-known sleep / recovery finding — population-level
 * research, not individual medical advice).
 */
import type { ImageSourcePropType } from "react-native";

export type RecoveryBenefitId =
  | "performance"
  | "immune"
  | "mental"
  | "longevity"
  | "hormonal";

export type IconFamily = "ion" | "mci";

export interface RecoveryBenefitFact {
  /** Ionicons name. */
  icon: string;
  text: string;
  /** Short study / evidence citation, shown small + bottom-right. */
  source: string;
}

export interface RecoveryBenefit {
  id: RecoveryBenefitId;
  label: string;
  /** Two-line label for the orbit node. */
  shortLabel: [string, string];
  nodeIconFamily: IconFamily;
  nodeIcon: string;
  /** Angle (deg) on the orbit ellipse — 0 = right, 90 = bottom, CCW screen. */
  angleDeg: number;
  summary: string;
  sheetBody: string;
  image: ImageSourcePropType;
  facts: RecoveryBenefitFact[];
}

export const RECOVERY_WHY_BENEFITS: RecoveryBenefit[] = [
  {
    id: "performance",
    label: "Better Performance",
    shortLabel: ["Better", "Performance"],
    nodeIconFamily: "ion",
    nodeIcon: "bar-chart",
    angleDeg: 235,
    summary:
      "Recovery rebuilds muscle, refuels energy stores and locks in skills — so training turns into gains instead of burnout.",
    sheetBody:
      "Recovery is when adaptation actually happens. Sleep and rest restore glycogen, clear fatigue and consolidate motor skills, so your hard sessions translate into strength, speed and endurance — every single day.",
    image: require("../../../assets/recovery/why-benefit-performance.png"),
    facts: [
      {
        icon: "flash",
        text: "Extending sleep toward ~10 h improved athletes' sprint speed and shooting accuracy by about 9%.",
        source: "Mah et al., 2011",
      },
      {
        icon: "barbell",
        text: "Even partial sleep loss cuts time-to-exhaustion by roughly 10–30% in endurance efforts.",
        source: "Fullagar et al., 2015",
      },
      {
        icon: "moon",
        text: "Up to ~70% of daily growth hormone — key for tissue repair — is released during deep sleep.",
        source: "Van Cauter et al., 2000",
      },
      {
        icon: "alert-circle",
        text: "Chronically under-recovered athletes show around 1.7× higher overuse-injury risk.",
        source: "Milewski et al., 2014",
      },
    ],
  },
  {
    id: "immune",
    label: "Stronger Immune System",
    shortLabel: ["Stronger", "Immune System"],
    nodeIconFamily: "ion",
    nodeIcon: "shield-checkmark",
    angleDeg: 305,
    summary:
      "Deep rest tunes inflammation and immune defences — so a hard week is less likely to turn into a sick week.",
    sheetBody:
      "Sleep is an immune organiser. It paces cytokine rhythms, natural-killer-cell activity and antibody responses. Skimping on recovery after strain leaves your defences lagging exactly when you need them.",
    image: require("../../../assets/recovery/why-benefit-immune.png"),
    facts: [
      {
        icon: "shield",
        text: "Sleeping under 7 h made people about 3× more likely to catch a cold after direct exposure.",
        source: "Prather et al., 2015",
      },
      {
        icon: "pulse",
        text: "A single night of poor sleep can drop natural-killer-cell activity by up to ~70%.",
        source: "Irwin et al., 1996",
      },
      {
        icon: "medkit",
        text: "Solid sleep around a vaccination can roughly double the antibody response.",
        source: "Spiegel et al., 2002",
      },
      {
        icon: "flame",
        text: "Chronic short sleep raises inflammatory markers such as CRP and IL-6.",
        source: "Irwin et al., 2016",
      },
    ],
  },
  {
    id: "mental",
    label: "Mental Clarity",
    shortLabel: ["Mental", "Clarity"],
    nodeIconFamily: "mci",
    nodeIcon: "brain",
    angleDeg: 155,
    summary:
      "Restored sleep clears brain fog, sharpens focus and steadies mood for decisions under pressure.",
    sheetBody:
      "The prefrontal cortex is highly sleep-sensitive. Recovery restores attention, emotional control and creative problem-solving — and overnight your brain physically clears metabolic waste built up during the day.",
    image: require("../../../assets/recovery/why-benefit-mental.png"),
    facts: [
      {
        icon: "eye",
        text: "Being awake 17–19 h impairs reaction time about as much as a 0.05% blood-alcohol level.",
        source: "Dawson & Reid, 1997",
      },
      {
        icon: "water",
        text: "During deep sleep the glymphatic system flushes metabolic waste, including beta-amyloid.",
        source: "Xie et al., 2013",
      },
      {
        icon: "happy",
        text: "One sleepless night raised amygdala emotional reactivity by ~60%, amplifying stress.",
        source: "Yoo et al., 2007",
      },
      {
        icon: "book",
        text: "Sleeping after you learn boosts memory retention by roughly 20–40%.",
        source: "Walker et al., 2004",
      },
    ],
  },
  {
    id: "longevity",
    label: "Long-term Health",
    shortLabel: ["Long-term", "Health"],
    nodeIconFamily: "ion",
    nodeIcon: "heart",
    angleDeg: 25,
    summary:
      "Consistent recovery eases the chronic load on your heart and metabolism — compounding over years, not days.",
    sheetBody:
      "Recovery is a longevity lever. It keeps blood pressure, glucose and inflammatory tone in check. Wearables track this through resting heart rate, HRV and how regular your sleep is.",
    image: require("../../../assets/recovery/why-benefit-longevity.png"),
    facts: [
      {
        icon: "heart",
        text: "Habitually sleeping under 6 h is linked to about 48% higher coronary heart-disease risk.",
        source: "Cappuccio et al., 2011",
      },
      {
        icon: "analytics",
        text: "Higher resting HRV predicts lower cardiovascular and all-cause mortality in large cohorts.",
        source: "Hillebrand et al., 2013",
      },
      {
        icon: "nutrition",
        text: "Short sleep impairs glucose handling, raising the risk of type-2 diabetes.",
        source: "Spiegel et al., 1999",
      },
      {
        icon: "calendar",
        text: "People with consistent 7–8 h nights show lower all-cause mortality over time.",
        source: "Cappuccio et al., 2010",
      },
    ],
  },
  {
    id: "hormonal",
    label: "Hormonal Balance",
    shortLabel: ["Hormonal", "Balance"],
    nodeIconFamily: "mci",
    nodeIcon: "scale-balance",
    angleDeg: 90,
    summary:
      "Night-time recovery resets cortisol, growth hormone and appetite hormones that steer energy and repair.",
    sheetBody:
      "Your endocrine system runs on circadian timing. Deep sleep drives growth-hormone pulses, while short sleep raises evening cortisol and distorts the hunger hormones leptin and ghrelin — reshaping your energy and recovery chemistry.",
    image: require("../../../assets/recovery/why-benefit-hormonal.png"),
    facts: [
      {
        icon: "water",
        text: "One week of sleep restriction raised evening cortisol by about 37–45%.",
        source: "Leproult et al., 1997",
      },
      {
        icon: "nutrition",
        text: "Two nights of 4 h sleep cut leptin ~18% and raised ghrelin ~28%, spiking hunger.",
        source: "Spiegel et al., 2004",
      },
      {
        icon: "barbell",
        text: "A week of 5 h sleep lowered young men's testosterone by about 10–15%.",
        source: "Leproult & Van Cauter, 2011",
      },
      {
        icon: "moon",
        text: "Deep slow-wave sleep drives the largest nightly growth-hormone pulse.",
        source: "Van Cauter et al., 2000",
      },
    ],
  },
];

export const RECOVERY_WHY_INSIGHT =
  "Consistent recovery compounds — small wins in sleep and rest stack up into better performance, health and resilience in every area of your life.";
