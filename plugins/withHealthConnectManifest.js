const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withHealthConnectManifest(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;
    const mainApplication = androidManifest.application[0];
    
    // 1. Trova la MainActivity
    let mainActivity = mainApplication.activity.find(
      (a) => a.$['android:name'] === '.MainActivity'
    );

    // 2. AGGIUNGI GLI INTENT FILTER MANUALMENTE (Così Expo non li rompe)
    if (mainActivity) {
      if (!mainActivity['intent-filter']) {
        mainActivity['intent-filter'] = [];
      }

      // Rimuoviamo eventuali filtri duplicati/errati precedenti
      mainActivity['intent-filter'] = mainActivity['intent-filter'].filter(filter => {
         // Teniamo solo quelli standard (MAIN/LAUNCHER e VIEW/BROWSABLE)
         // Rimuoviamo quelli di Health Connect per riscriverli puliti
         const actions = filter.action || [];
         const isHealth = actions.some(a => 
             a.$['android:name'].includes('VIEW_PERMISSION_USAGE') || 
             a.$['android:name'].includes('SHOW_PERMISSIONS_RATIONALE')
         );
         return !isHealth;
      });

      // Aggiungiamo quelli corretti
      mainActivity['intent-filter'].push({
        action: [{ $: { 'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE' } }],
      });

      mainActivity['intent-filter'].push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
        category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
      });
    }

    // 3. AGGIORNA LA PROPERTY (COMPLETA DI TUTTI I PERMESSI)
    // Devono corrispondere esattamente a quelli usati nell'app
    const allPermissions = [
      "android.permission.health.READ_STEPS",
      "android.permission.health.WRITE_STEPS",
      "android.permission.health.READ_WEIGHT",
      "android.permission.health.WRITE_WEIGHT",
      "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
      "android.permission.health.READ_TOTAL_CALORIES_BURNED",
      "android.permission.health.READ_EXERCISE",
      "android.permission.health.READ_BODY_FAT",
      "android.permission.health.READ_HEART_RATE",
      "android.permission.health.READ_SLEEP"
    ].join(';');

    // Rimuovi la property vecchia se esiste
    if (mainApplication['property']) {
        mainApplication['property'] = mainApplication['property'].filter(
            p => p.$['android:name'] !== 'android.health.PROPERTY_HEALTH_CONNECT_REGISTRATION_PERMISSIONS'
        );
    } else {
        mainApplication['property'] = [];
    }

    // Aggiungi quella nuova completa
    mainApplication['property'].push({
      $: {
        'android:name': 'android.health.PROPERTY_HEALTH_CONNECT_REGISTRATION_PERMISSIONS',
        'android:value': allPermissions,
      },
    });

    return config;
  });
};