import { ConvexReactClient } from "convex/react";

function requireConvexUrl(): string {
  let url = process.env.EXPO_PUBLIC_CONVEX_URL?.trim() ?? "";
  url = url.replace(/\/+$/, "");
  if (!url) {
    throw new Error(
      "Missing EXPO_PUBLIC_CONVEX_URL. Add it to apps/mobile/.env (see .env.example)."
    );
  }
  if (!url.startsWith("https://") || !url.includes("convex")) {
    throw new Error(
      `EXPO_PUBLIC_CONVEX_URL looks invalid: "${url}". Use your Convex Cloud URL (…convex.cloud).`
    );
  }
  return url;
}

export const convex = new ConvexReactClient(requireConvexUrl());
