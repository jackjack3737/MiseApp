const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Config Plugin che disabilita COMPLETAMENTE ProGuard e shrinkResources
 * nella build release Android. Risolve crash tipo:
 * kotlin.UninitializedPropertyAccessException: lateinit property requestPermission has not been initialized
 * causati da R8/ProGuard che rompono librerie come react-native-health-connect.
 *
 * La build peserà di più (come la debug) ma il codice non verrà minificato.
 */
function withDisableMinification(config) {
  return withAppBuildGradle(config, (config) => {
    let buildGradle = config.modResults.contents;

    // 1. Sostituisce minifyEnabled (qualsiasi espressione) con minifyEnabled false
    // Gestisce: minifyEnabled enableProguardInReleaseBuilds, minifyEnabled true, etc.
    buildGradle = buildGradle.replace(
      /^(\s*)minifyEnabled\s+.+$/gm,
      '$1minifyEnabled false'
    );

    // 2. Sostituisce shrinkResources (qualsiasi espressione) con shrinkResources false
    // Gestisce: shrinkResources (findProperty(...) ?: false), shrinkResources true, etc.
    buildGradle = buildGradle.replace(
      /^(\s*)shrinkResources\s+.+$/gm,
      '$1shrinkResources false'
    );

    config.modResults.contents = buildGradle;
    return config;
  });
}

module.exports = withDisableMinification;
