/**
 * Loads env from repo root + apps/mobile so `npm run mobile` works from monorepo root.
 * Maps CONVEX_URL → EXPO_PUBLIC_CONVEX_URL and common Clerk key names.
 */
const fs = require("fs");
const path = require("path");

function parseEnvFile(absPath) {
  try {
    if (!fs.existsSync(absPath)) return;
    const text = fs.readFileSync(absPath, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key) {
        process.env[key] = val;
      }
    }
  } catch {
    /* ignore */
  }
}

const mobileDir = __dirname;
const repoRoot = path.join(__dirname, "..", "..");

parseEnvFile(path.join(repoRoot, ".env.local"));
parseEnvFile(path.join(repoRoot, ".env"));
parseEnvFile(path.join(mobileDir, ".env.local"));
parseEnvFile(path.join(mobileDir, ".env"));

const convexUrl =
  process.env.EXPO_PUBLIC_CONVEX_URL?.trim() ||
  process.env.CONVEX_URL?.trim() ||
  process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
if (convexUrl && !process.env.EXPO_PUBLIC_CONVEX_URL) {
  process.env.EXPO_PUBLIC_CONVEX_URL = convexUrl.replace(/\/+$/, "");
}

const clerk =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ||
  process.env.CLERK_PUBLISHABLE_KEY?.trim();
if (clerk && !process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) {
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = clerk;
}

module.exports = require("./app.json");
