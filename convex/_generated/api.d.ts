/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _helpers from "../_helpers.js";
import type * as analytics from "../analytics.js";
import type * as analyticsCore from "../analyticsCore.js";
import type * as assistant from "../assistant.js";
import type * as assistantContext from "../assistantContext.js";
import type * as catalog from "../catalog.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as dataPrivacy from "../dataPrivacy.js";
import type * as entitlements from "../entitlements.js";
import type * as foodVision from "../foodVision.js";
import type * as habits from "../habits.js";
import type * as insights from "../insights.js";
import type * as integrations from "../integrations.js";
import type * as integrationsScheduler from "../integrationsScheduler.js";
import type * as nutrition from "../nutrition.js";
import type * as profiles from "../profiles.js";
import type * as scoring from "../scoring.js";
import type * as scoring_agingEngine from "../scoring/agingEngine.js";
import type * as scoring_composite from "../scoring/composite.js";
import type * as scoring_displayLayers from "../scoring/displayLayers.js";
import type * as scoring_doseResponse from "../scoring/doseResponse.js";
import type * as scoring_index from "../scoring/index.js";
import type * as scoring_percentiles_vo2max from "../scoring/percentiles/vo2max.js";
import type * as scoring_pillarRegistry from "../scoring/pillarRegistry.js";
import type * as scoring_pillars_activity from "../scoring/pillars/activity.js";
import type * as scoring_pillars_bodyBasic from "../scoring/pillars/bodyBasic.js";
import type * as scoring_pillars_cardio from "../scoring/pillars/cardio.js";
import type * as scoring_pillars_habits from "../scoring/pillars/habits.js";
import type * as scoring_pillars_nutrition from "../scoring/pillars/nutrition.js";
import type * as scoring_pillars_recovery from "../scoring/pillars/recovery.js";
import type * as scoring_pillars_sleep from "../scoring/pillars/sleep.js";
import type * as scoring_pillars_stress from "../scoring/pillars/stress.js";
import type * as scoring_types from "../scoring/types.js";
import type * as userPreferences from "../userPreferences.js";
import type * as wearableNormalizers from "../wearableNormalizers.js";
import type * as wearables from "../wearables.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  _helpers: typeof _helpers;
  analytics: typeof analytics;
  analyticsCore: typeof analyticsCore;
  assistant: typeof assistant;
  assistantContext: typeof assistantContext;
  catalog: typeof catalog;
  crons: typeof crons;
  dashboard: typeof dashboard;
  dataPrivacy: typeof dataPrivacy;
  entitlements: typeof entitlements;
  foodVision: typeof foodVision;
  habits: typeof habits;
  insights: typeof insights;
  integrations: typeof integrations;
  integrationsScheduler: typeof integrationsScheduler;
  nutrition: typeof nutrition;
  profiles: typeof profiles;
  scoring: typeof scoring;
  "scoring/agingEngine": typeof scoring_agingEngine;
  "scoring/composite": typeof scoring_composite;
  "scoring/displayLayers": typeof scoring_displayLayers;
  "scoring/doseResponse": typeof scoring_doseResponse;
  "scoring/index": typeof scoring_index;
  "scoring/percentiles/vo2max": typeof scoring_percentiles_vo2max;
  "scoring/pillarRegistry": typeof scoring_pillarRegistry;
  "scoring/pillars/activity": typeof scoring_pillars_activity;
  "scoring/pillars/bodyBasic": typeof scoring_pillars_bodyBasic;
  "scoring/pillars/cardio": typeof scoring_pillars_cardio;
  "scoring/pillars/habits": typeof scoring_pillars_habits;
  "scoring/pillars/nutrition": typeof scoring_pillars_nutrition;
  "scoring/pillars/recovery": typeof scoring_pillars_recovery;
  "scoring/pillars/sleep": typeof scoring_pillars_sleep;
  "scoring/pillars/stress": typeof scoring_pillars_stress;
  "scoring/types": typeof scoring_types;
  userPreferences: typeof userPreferences;
  wearableNormalizers: typeof wearableNormalizers;
  wearables: typeof wearables;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
