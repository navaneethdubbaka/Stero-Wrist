const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PERMISSIONS = [
  'android.permission.RECORD_AUDIO',
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.BLUETOOTH',
  'android.permission.BLUETOOTH_CONNECT',
  'android.permission.BLUETOOTH_SCAN',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  'android.permission.POST_NOTIFICATIONS',
  // Declared so `adb shell pm grant ... WRITE_SECURE_SETTINGS` can stick voice_interaction_service.
  'android.permission.WRITE_SECURE_SETTINGS',
];

const VIS = 'expo.modules.steroassistant.SteroVoiceInteractionService';
const VISS = 'expo.modules.steroassistant.SteroVoiceInteractionSessionService';
const RECOG = 'expo.modules.steroassistant.SteroRecognitionService';
const FGS = 'expo.modules.steroassistant.SteroMicForegroundService';
const ASSIST = 'expo.modules.steroassistant.SteroAssistActivity';

function ensurePermission(manifest, name) {
  if (!Array.isArray(manifest['uses-permission'])) {
    manifest['uses-permission'] = [];
  }
  const exists = manifest['uses-permission'].some(
    (p) => p.$?.['android:name'] === name,
  );
  if (!exists) {
    manifest['uses-permission'].push({ $: { 'android:name': name } });
  }
}

function ensureService(application, service) {
  if (!Array.isArray(application.service)) {
    application.service = [];
  }
  const name = service.$['android:name'];
  const idx = application.service.findIndex((s) => s.$?.['android:name'] === name);
  if (idx >= 0) {
    application.service[idx] = service;
  } else {
    application.service.push(service);
  }
}

function ensureActivity(application, activity) {
  if (!Array.isArray(application.activity)) {
    application.activity = [];
  }
  const name = activity.$['android:name'];
  const idx = application.activity.findIndex((a) => a.$?.['android:name'] === name);
  if (idx >= 0) {
    application.activity[idx] = activity;
  } else {
    application.activity.push(activity);
  }
}

/**
 * Registers VoiceInteraction + Assist activity, FGS, and mic/BT permissions.
 */
const withSteroAssistant = (config) => {
  config = AndroidConfig.Permissions.withPermissions(config, PERMISSIONS);

  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    for (const perm of PERMISSIONS) {
      ensurePermission(manifest, perm);
    }

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      config.modResults,
    );

    ensureService(application, {
      $: {
        'android:name': VIS,
        'android:permission': 'android.permission.BIND_VOICE_INTERACTION',
        'android:exported': 'true',
        'android:label': 'Stero Wrist',
      },
      'intent-filter': [
        {
          action: [
            {
              $: {
                'android:name': 'android.service.voice.VoiceInteractionService',
              },
            },
          ],
        },
      ],
      'meta-data': [
        {
          $: {
            'android:name': 'android.voice_interaction',
            'android:resource': '@xml/stero_voice_interaction',
          },
        },
      ],
    });

    ensureService(application, {
      $: {
        'android:name': VISS,
        'android:permission': 'android.permission.BIND_VOICE_INTERACTION',
        'android:exported': 'true',
      },
    });

    // Required by VoiceInteractionServiceInfo — without it dumpsys reports
    // "NOT VALID: No recognitionService specified" and Assist falls back to settings.
    ensureService(application, {
      $: {
        'android:name': RECOG,
        'android:permission': 'android.permission.BIND_RECOGNITION_SERVICE',
        'android:exported': 'true',
      },
      'intent-filter': [
        {
          action: [
            { $: { 'android:name': 'android.speech.RecognitionService' } },
          ],
          category: [
            { $: { 'android:name': 'android.intent.category.DEFAULT' } },
          ],
        },
      ],
      'meta-data': [
        {
          $: {
            'android:name': 'android.speech',
            'android:resource': '@xml/stero_recognition_service',
          },
        },
      ],
    });

    ensureService(application, {
      $: {
        'android:name': FGS,
        'android:exported': 'false',
        'android:foregroundServiceType': 'microphone',
      },
    });

    // Assist / voice-command activity — shows in Assist app pickers on many OEMs.
    ensureActivity(application, {
      $: {
        'android:name': ASSIST,
        'android:exported': 'true',
        'android:theme': '@android:style/Theme.Translucent.NoTitleBar',
        'android:excludeFromRecents': 'true',
        'android:label': 'Stero Wrist',
      },
      'intent-filter': [
        {
          action: [
            { $: { 'android:name': 'android.intent.action.ASSIST' } },
          ],
          category: [
            { $: { 'android:name': 'android.intent.category.DEFAULT' } },
          ],
        },
        {
          action: [
            { $: { 'android:name': 'android.intent.action.VOICE_COMMAND' } },
          ],
          category: [
            { $: { 'android:name': 'android.intent.category.DEFAULT' } },
          ],
        },
      ],
    });

    return config;
  });

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const xmlDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'res',
        'xml',
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      const xmlPath = path.join(xmlDir, 'stero_voice_interaction.xml');
      const xml = `<?xml version="1.0" encoding="utf-8"?>
<voice-interaction-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:sessionService="${VISS}"
    android:recognitionService="${RECOG}"
    android:settingsActivity="com.sterowrist.app.MainActivity"
    android:supportsAssist="true"
    android:supportsLaunchVoiceAssistFromKeyguard="true"
    android:supportsLocalInteraction="true" />
`;
      fs.writeFileSync(xmlPath, xml, 'utf8');

      const recogXmlPath = path.join(xmlDir, 'stero_recognition_service.xml');
      const recogXml = `<?xml version="1.0" encoding="utf-8"?>
<recognition-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:settingsActivity="com.sterowrist.app.MainActivity" />
`;
      fs.writeFileSync(recogXmlPath, recogXml, 'utf8');
      return config;
    },
  ]);

  return config;
};

module.exports = withSteroAssistant;
