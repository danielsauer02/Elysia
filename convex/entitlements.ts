import { query } from "./_generated/server";

export const getEntitlements = query({
  args: {},
  handler: async () => {
    return {
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
  },
});
