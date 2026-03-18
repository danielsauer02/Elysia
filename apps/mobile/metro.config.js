const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so Metro can resolve hoisted node_modules
// and local workspace packages (e.g. @elysia/domain).
config.watchFolders = [monorepoRoot];

// Tell Metro where to look for node_modules — project-level first,
// then monorepo root for hoisted/shared packages.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

module.exports = config;
