const { withMainActivity } = require('@expo/config-plugins');
const { addImports } = require('@expo/config-plugins/build/android/codeMod');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const TAG = 'react-native-health-connect-setPermissionDelegate';
const IMPORT = 'dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';

/**
 * Aggiunge HealthConnectPermissionDelegate.setPermissionDelegate(this) in MainActivity.onCreate.
 * Richiesto da react-native-health-connect per evitare:
 * kotlin.UninitializedPropertyAccessException: lateinit property requestPermission has not been initialized
 */
function withHealthConnectMainActivity(config) {
  return withMainActivity(config, (config) => {
    let contents = config.modResults.contents;
    const isJava = config.modResults.language === 'java';

    if (contents.includes('HealthConnectPermissionDelegate.setPermissionDelegate')) {
      return config;
    }

    contents = addImports(contents, [IMPORT], isJava);

    const line = isJava
      ? '      HealthConnectPermissionDelegate.setPermissionDelegate(this);'
      : '    HealthConnectPermissionDelegate.setPermissionDelegate(this)';

    if (!contents.match(/super\.onCreate\s*\(/)) {
      const onCreateBlock = isJava
        ? [
            '    @Override',
            '    protected void onCreate(android.os.Bundle savedInstanceState) {',
            '      super.onCreate(savedInstanceState);',
            '      HealthConnectPermissionDelegate.setPermissionDelegate(this);',
            '    }',
          ]
        : [
            '    override fun onCreate(savedInstanceState: android.os.Bundle?) {',
            '      super.onCreate(savedInstanceState)',
            '      HealthConnectPermissionDelegate.setPermissionDelegate(this)',
            '    }',
          ];
      contents = mergeContents({
        src: contents,
        anchor: isJava
          ? /(?<=public\s+class\s+\w+\s+extends\s+[^{]+\s*\{)/m
          : /(?<=class\s+\w+\s*:\s*[^{]+\s*\{)/m,
        offset: 1,
        comment: '//',
        tag: TAG,
        newSrc: onCreateBlock.join('\n'),
      }).contents;
    } else {
      contents = mergeContents({
        src: contents,
        anchor: /(?<=^.*super\.onCreate\s*\([^)]*\).*$)/m,
        offset: 1,
        comment: '//',
        tag: TAG,
        newSrc: line,
      }).contents;
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withHealthConnectMainActivity;
