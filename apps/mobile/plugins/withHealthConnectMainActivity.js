/**
 * Expo config plugin: registers the Health Connect permission delegate in MainActivity.
 *
 * `react-native-health-connect` requires the host MainActivity to call
 * `HealthConnectPermissionDelegate.setPermissionDelegate(this)` inside `onCreate`,
 * otherwise its lateinit `requestPermission` ActivityResultLauncher is never
 * initialized and calling `requestPermission()` crashes the app with
 * `kotlin.UninitializedPropertyAccessException: lateinit property requestPermission has not been initialized`.
 *
 * The library's own Expo plugin (`app.plugin.js`) only adds the
 * `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` intent-filter and leaves
 * MainActivity untouched, so we have to patch it ourselves.
 */
const { withMainActivity } = require("@expo/config-plugins");

const IMPORT_LINE =
  "import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate";
const REGISTRATION_KT =
  "    HealthConnectPermissionDelegate.setPermissionDelegate(this)";

function ensureImportKt(contents) {
  if (contents.includes(IMPORT_LINE)) return contents;
  return contents.replace(/(^package [^\n]+\n)/m, `$1\n${IMPORT_LINE}\n`);
}

function ensureRegistrationKt(contents) {
  if (contents.includes("HealthConnectPermissionDelegate.setPermissionDelegate")) {
    return contents;
  }
  const match = contents.match(/(super\.onCreate\([^)]*\)[^\n]*\n)/);
  if (!match) {
    throw new Error(
      "withHealthConnectMainActivity: could not find super.onCreate(...) in MainActivity.kt"
    );
  }
  return contents.replace(match[1], `${match[1]}${REGISTRATION_KT}\n`);
}

module.exports = function withHealthConnectMainActivity(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== "kt") {
      throw new Error(
        "withHealthConnectMainActivity expects MainActivity to be in Kotlin. " +
          `Got language=${cfg.modResults.language}.`
      );
    }
    let contents = cfg.modResults.contents;
    contents = ensureImportKt(contents);
    contents = ensureRegistrationKt(contents);
    cfg.modResults.contents = contents;
    return cfg;
  });
};
