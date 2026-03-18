import type { Entitlement, FeatureKey } from "@elysia/domain";

export const hasFeature = (
  entitlement: Entitlement,
  feature: FeatureKey | undefined
): boolean => {
  if (!feature) {
    return true;
  }

  return entitlement.features.includes(feature);
};
