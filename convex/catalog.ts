import { query } from "./_generated/server";
import { v } from "convex/values";

export const getTemplates = query({
  args: {
    category: v.optional(v.string()),
    tier: v.optional(v.string()),
  },
  handler: async (_ctx, { category, tier }) => {
    return {
      filters: { category, tier },
      templates: [],
    };
  },
});

export const getCatalogItems = query({
  args: {
    category: v.optional(v.string()),
    offerType: v.optional(v.string()),
  },
  handler: async (_ctx, { category, offerType }) => {
    return {
      filters: { category, offerType },
      items: [],
    };
  },
});
