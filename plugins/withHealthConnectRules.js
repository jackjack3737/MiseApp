const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withHealthConnectRules = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const file = path.join(config.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      
      let contents = "";
      try {
        contents = await fs.promises.readFile(file, 'utf8');
      } catch (e) {
        contents = "";
      }

      // --- REGOLE AGGIORNATE E PIÙ POTENTI ---
      const newRules = `
# --- KETOLAB PROTECTION RULES ---
# 1. Proteggi la libreria Health Connect
-keep class androidx.health.connect.** { *; }
-keep class dev.matinzd.healthconnect.** { *; }
-keep interface dev.matinzd.healthconnect.** { *; }

# 2. Proteggi le funzioni di Android per i popup (IL FIX CRUCIALE)
-keep class androidx.activity.** { *; }
-keep class androidx.fragment.app.** { *; }
-keep class androidx.lifecycle.** { *; }

# 3. Proteggi Kotlin Coroutines (per evitare blocchi)
-keep class kotlin.coroutines.** { *; }
-keep class kotlinx.coroutines.** { *; }

# 4. Silenzia avvisi inutili
-dontwarn androidx.**
-dontwarn dev.matinzd.**
# ------------------------------------
`;

      if (!contents.includes('KETOLAB PROTECTION RULES')) {
        contents += newRules;
        await fs.promises.writeFile(file, contents, 'utf8');
      }
      
      return config;
    },
  ]);
};

module.exports = withHealthConnectRules;