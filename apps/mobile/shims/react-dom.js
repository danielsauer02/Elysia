/**
 * Metro shim for native (iOS/Android): @clerk/clerk-react requires react-dom for
 * web-only createPortal usage. On native that path is unused; Metro still must resolve the module.
 *
 * For Expo web, use real react-dom: `npx expo install react-dom` in apps/mobile.
 */
function createPortal(children) {
  return children;
}

function flushSync(fn) {
  return typeof fn === "function" ? fn() : undefined;
}

module.exports = {
  createPortal,
  flushSync,
};
