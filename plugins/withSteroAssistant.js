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
  'android.permission.BLUETOOTH_CONNECT',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  'android.permission.POST_NOTIFICATIONS',
];

const VIS = 'expo.modules.steroassistant.SteroVoiceInteractionService';
const VISS = 'expo.modules.steroassistant.SteroVoiceInteractionSessionService';
const FGS = 'expo.modules.steroassistant.SteroMicForegroundService';

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

/**
 * Registers VoiceInteraction services, FGS, and mic/BT permissions for Phase 5.
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

    ensureService(application, {
      $: {
        'android:name': FGS,
        'android:exported': 'false',
        'android:foregroundServiceType': 'microphone',
      },
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
    android:supportsAssist="true"
    android:supportsLaunchVoiceAssistFromKeyguard="true"
    android:supportsLocalInteraction="true" />
`;
      fs.writeFileSync(xmlPath, xml, 'utf8');
      return config;
    },
  ]);

  return config;
};

module.exports = withSteroAssistant;
