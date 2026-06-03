const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

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

// @clerk/clerk-react pulls react-dom for web-only portals; native bundles must still resolve it.
const reactDomShimPath = path.resolve(projectRoot, "shims/react-dom.js");

// ── @shopify/react-native-skia 2.x: force Metro to use the precompiled
// `lib/module/` output instead of the `src/` TypeScript entrypoint.
//
// Skia's package.json sets `"react-native": "src/index.ts"`, which Metro
// honors over `"main"`. Walking that TS tree from a monorepo + multiple
// nodeModulesPaths triggers a recursive resolution path that ends in a
// "Maximum call stack size exceeded" bundling error. Entering through
// the compiled `lib/module/index.js` makes Skia's internal `./...`
// imports stay inside `lib/module/`, sidestepping the recursion.
const skiaRoot = path.dirname(
  require.resolve("@shopify/react-native-skia/package.json", {
    paths: [projectRoot, monorepoRoot],
  })
);
const skiaModuleEntry = path.join(skiaRoot, "lib", "module", "index.js");
const skiaLibModulePrefix = path.join(skiaRoot, "lib", "module") + path.sep;
const skiaLibSpecsDir = path.join(skiaRoot, "lib", "module", "specs");
const skiaSrcSpecsDir = path.join(skiaRoot, "src", "specs");

// React Native's babel-plugin-codegen scans every JS/TS file for
// `codegenNativeComponent()` calls and must extract the native-component
// schema from TypeScript types. The compiled `lib/module/specs/*.js`
// files have lost their types, so codegen throws
// "Could not find component config for native component" when it
// transforms them. Map any spec resolution that would land in
// `lib/module/specs/` back to the original `src/specs/*.ts` source.
function redirectSkiaSpecToSource(filePath) {
  if (!filePath || !filePath.startsWith(skiaLibSpecsDir + path.sep)) {
    return filePath;
  }
  const tail = filePath.slice(skiaLibSpecsDir.length); // includes leading sep
  const tsCandidate = path
    .join(skiaSrcSpecsDir, tail)
    .replace(/\.js$/, ".ts");
  if (fs.existsSync(tsCandidate)) return tsCandidate;
  const tsxCandidate = tsCandidate.replace(/\.ts$/, ".tsx");
  if (fs.existsSync(tsxCandidate)) return tsxCandidate;
  return filePath;
}

/**
 * Map tsconfig path @convex/* → repo /convex/* (avoids invalid @elysia/convex imports).
 */
function resolveConvexModule(subPath) {
  const base = path.resolve(monorepoRoot, "convex", subPath);
  const candidates = [
    base,
    `${base}.js`,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.js"),
    path.join(base, "index.ts"),
  ];
  for (const fp of candidates) {
    if (fs.existsSync(fp)) return fp;
  }
  return null;
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform !== "web" && moduleName === "react-dom") {
    return { type: "sourceFile", filePath: reactDomShimPath };
  }
  if (moduleName.startsWith("@convex/")) {
    const sub = moduleName.slice("@convex/".length);
    const filePath = resolveConvexModule(sub);
    if (filePath) {
      return { type: "sourceFile", filePath };
    }
  }
  // Skia bare-import → precompiled entry, NOT the TS src.
  if (moduleName === "@shopify/react-native-skia") {
    return { type: "sourceFile", filePath: skiaModuleEntry };
  }
  // Subpath imports under Skia, e.g. "@shopify/react-native-skia/lib/module/...":
  // also force them into `lib/module/`.
  if (moduleName.startsWith("@shopify/react-native-skia/")) {
    const sub = moduleName.slice("@shopify/react-native-skia/".length);
    const cleanSub = sub.replace(/^src\//, "").replace(/^lib\/module\//, "");
    const base = path.join(skiaRoot, "lib", "module", cleanSub);
    const candidates = [base, `${base}.js`, path.join(base, "index.js")];
    for (const fp of candidates) {
      if (fs.existsSync(fp)) {
        return {
          type: "sourceFile",
          filePath: redirectSkiaSpecToSource(fp),
        };
      }
    }
  }
  // Fall through to Metro's DEFAULT resolver (provided as
  // `context.resolveRequest`), not the bare `metro-resolver`. The default
  // resolver keeps Expo's asset handling intact — calling `metro-resolver`
  // directly misclassifies assets (e.g. `.png`) as source files, which
  // then get fed to Babel and blow the stack on binary data. We then
  // post-process so that any Skia spec file imported relatively from inside
  // `lib/module/` (e.g. `../specs/SkiaPictureViewNativeComponent`) is served
  // from the original TS source — codegen needs the type annotations.
  const result = context.resolveRequest(context, moduleName, platform);
  if (
    result &&
    result.type === "sourceFile" &&
    typeof result.filePath === "string" &&
    result.filePath.startsWith(skiaLibModulePrefix)
  ) {
    const redirected = redirectSkiaSpecToSource(result.filePath);
    if (redirected !== result.filePath) {
      return { type: "sourceFile", filePath: redirected };
    }
  }
  return result;
};

module.exports = config;
