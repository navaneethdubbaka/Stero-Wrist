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
  'android.permission.MANAGE_OWN_CALLS',
  'android.permission.POST_NOTIFICATIONS',
  // Declared so `adb shell pm grant ... WRITE_SECURE_SETTINGS` can stick voice_interaction_service.
  'android.permission.WRITE_SECURE_SETTINGS',
  // Special: grant via `adb shell appops set ... GET_USAGE_STATS allow`
  // Used to detect Google HandsFree → ManageAssist after watch Talk.
  'android.permission.PACKAGE_USAGE_STATS',
];

const VIS = 'expo.modules.steroassistant.SteroVoiceInteractionService';
const VISS = 'expo.modules.steroassistant.SteroVoiceInteractionSessionService';
const RECOG = 'expo.modules.steroassistant.SteroRecognitionService';
const FGS = 'expo.modules.steroassistant.SteroMicForegroundService';
const CALL = 'expo.modules.steroassistant.SteroConnectionService';
const REDIRECT = 'expo.modules.steroassistant.SteroCallRedirectionService';
const HANGUP = 'expo.modules.steroassistant.SteroCallHangupReceiver';
const ASSIST = 'expo.modules.steroassistant.SteroAssistActivity';
const HEADLESS = 'com.sterowrist.app.SteroHeadlessActivity';

/** Prefer VOICE_COMMUNICATION so AudioRecord follows HFP SCO / communication device. */
function patchExpoAudioRecorderSource(projectRoot) {
  const rel = path.join(
    'node_modules',
    'expo-speech-recognition',
    'android',
    'src',
    'main',
    'java',
    'expo',
    'modules',
    'speechrecognition',
    'ExpoAudioRecorder.kt',
  );
  const candidates = [
    path.join(projectRoot, rel),
    path.join(projectRoot, '..', rel),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    if (src.includes('MediaRecorder.AudioSource.VOICE_COMMUNICATION')) {
      return;
    }
    if (!src.includes('MediaRecorder.AudioSource.VOICE_RECOGNITION')) {
      return;
    }
    fs.writeFileSync(
      file,
      src.replace(
        'MediaRecorder.AudioSource.VOICE_RECOGNITION',
        'MediaRecorder.AudioSource.VOICE_COMMUNICATION',
      ),
      'utf8',
    );
  }
}

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

function ensureReceiver(application, receiver) {
  if (!Array.isArray(application.receiver)) {
    application.receiver = [];
  }
  const name = receiver.$['android:name'];
  const idx = application.receiver.findIndex((r) => r.$?.['android:name'] === name);
  if (idx >= 0) {
    application.receiver[idx] = receiver;
  } else {
    application.receiver.push(receiver);
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

    // Match Muse/ChatGPT: SessionService must declare the VIS session action.
    ensureService(application, {
      $: {
        'android:name': VISS,
        'android:permission': 'android.permission.BIND_VOICE_INTERACTION',
        'android:exported': 'true',
      },
      'intent-filter': [
        {
          action: [
            {
              $: {
                'android:name':
                  'android.service.voice.VoiceInteractionSessionService',
              },
            },
          ],
        },
      ],
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

    ensureService(application, {
      $: {
        'android:name': CALL,
        'android:permission': 'android.permission.BIND_TELECOM_CONNECTION_SERVICE',
        'android:exported': 'true',
      },
      'intent-filter': [
        {
          action: [
            { $: { 'android:name': 'android.telecom.ConnectionService' } },
          ],
        },
      ],
    });

    ensureService(application, {
      $: {
        'android:name': REDIRECT,
        'android:permission': 'android.permission.BIND_CALL_REDIRECTION_SERVICE',
        'android:exported': 'true',
      },
      'intent-filter': [
        {
          action: [
            {
              $: { 'android:name': 'android.telecom.CallRedirectionService' },
            },
          ],
        },
      ],
    });

    ensureReceiver(application, {
      $: {
        'android:name': HANGUP,
        'android:exported': 'false',
      },
    });

    // Assist / voice-command — Muse-style orb over current app / lock screen.
    // High priority on VOICE_COMMAND / HANDS_FREE: watch HFP Talk uses these.
    // (Google HandsFree is often preferred with mAlways=true — user may still need
    // to clear Google “Open by default”; HeadsetVrWatcher is the backup path.)
    ensureActivity(application, {
      $: {
        'android:name': ASSIST,
        'android:exported': 'true',
        'android:theme': '@android:style/Theme.Translucent.NoTitleBar',
        'android:excludeFromRecents': 'true',
        'android:showWhenLocked': 'true',
        'android:turnScreenOn': 'true',
        'android:taskAffinity': '',
        'android:launchMode': 'singleTask',
        'android:label': 'Stero Wrist',
      },
      'intent-filter': [
        {
          $: { 'android:priority': '1000' },
          action: [
            { $: { 'android:name': 'android.intent.action.ASSIST' } },
          ],
          category: [
            { $: { 'android:name': 'android.intent.category.DEFAULT' } },
          ],
        },
        {
          $: { 'android:priority': '1000' },
          action: [
            { $: { 'android:name': 'android.intent.action.VOICE_COMMAND' } },
          ],
          category: [
            { $: { 'android:name': 'android.intent.category.DEFAULT' } },
          ],
        },
        {
          $: { 'android:priority': '1000' },
          action: [
            {
              $: {
                'android:name': 'android.speech.action.VOICE_SEARCH_HANDS_FREE',
              },
            },
          ],
          category: [
            { $: { 'android:name': 'android.intent.category.DEFAULT' } },
          ],
        },
        {
          $: { 'android:priority': '1000' },
          action: [
            { $: { 'android:name': 'android.speech.action.WEB_SEARCH' } },
          ],
          category: [
            { $: { 'android:name': 'android.intent.category.DEFAULT' } },
          ],
        },
      ],
    });

    // Transparent RN host for overlay pipeline (no Home chrome).
    // Must use AppCompat-based theme — ReactActivity crashes on plain Translucent.
    ensureActivity(application, {
      $: {
        'android:name': HEADLESS,
        'android:exported': 'false',
        'android:theme': '@style/Theme.Stero.Overlay',
        'android:excludeFromRecents': 'true',
        'android:showWhenLocked': 'true',
        'android:turnScreenOn': 'true',
        'android:taskAffinity': 'com.sterowrist.app.overlay',
        'android:launchMode': 'singleTask',
        'android:configChanges':
          'keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode',
      },
    });

    return config;
  });

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      patchExpoAudioRecorderSource(projectRoot);
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
      // Align with ChatGPT/Muse: assist data flags, no settingsActivity pointing at
      // MainActivity (that made the gear / some OEM Talk paths open the wrong UI).
      const xml = `<?xml version="1.0" encoding="utf-8"?>
<voice-interaction-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:sessionService="${VISS}"
    android:recognitionService="${RECOG}"
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

      // AppCompat translucent theme required by ReactActivity / AppCompatActivity.
      const valuesDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'res',
        'values',
      );
      fs.mkdirSync(valuesDir, { recursive: true });
      const overlayStylesPath = path.join(valuesDir, 'stero_overlay_styles.xml');
      fs.writeFileSync(
        overlayStylesPath,
        `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <style name="Theme.Stero.Overlay" parent="Theme.AppCompat.DayNight.NoActionBar">
    <item name="android:windowIsTranslucent">true</item>
    <item name="android:windowBackground">@android:color/transparent</item>
    <item name="android:colorBackgroundCacheHint">@null</item>
    <item name="android:windowNoTitle">true</item>
    <item name="android:windowContentOverlay">@null</item>
    <item name="android:backgroundDimEnabled">false</item>
    <item name="android:statusBarColor">@android:color/transparent</item>
    <item name="android:navigationBarColor">@android:color/transparent</item>
    <item name="android:windowAnimationStyle">@null</item>
  </style>
</resources>
`,
        'utf8',
      );

      // Transparent ReactActivity host for overlay mode.
      const javaDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'sterowrist',
        'app',
      );
      fs.mkdirSync(javaDir, { recursive: true });
      const headlessPath = path.join(javaDir, 'SteroHeadlessActivity.kt');
      const headlessKt = `package com.sterowrist.app

import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import expo.modules.ReactActivityDelegateWrapper

/**
 * Invisible RN host used when Stero runs as a Muse-style overlay.
 * Loads the same "main" JS component; AppProviders renders a transparent root
 * when launched with stero_overlay / overlay=1.
 */
class SteroHeadlessActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // AppCompat translucent theme (manifest Theme.Stero.Overlay) — required by ReactActivity.
    setTheme(R.style.Theme_Stero_Overlay)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
      )
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    applyOverlayPassthroughFlags()
    super.onCreate(null)
    applyOverlayPassthroughFlags()
    try {
      expo.modules.steroassistant.SteroOverlayBridge.attachHeadless(this)
    } catch (_: Exception) {
      // Module may not be linked in unexpected builds.
    }
  }

  override fun onResume() {
    super.onResume()
    applyOverlayPassthroughFlags()
  }

  private fun applyOverlayPassthroughFlags() {
    // Pass taps to Assist orb (✕). Stay focusable so AudioRecord / STT can start.
    window.addFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE)
    window.clearFlags(WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE)
  }

  override fun onDestroy() {
    try {
      expo.modules.steroassistant.SteroOverlayBridge.clearHeadless(this)
    } catch (_: Exception) {
      // ignore
    }
    super.onDestroy()
  }

  override fun getMainComponentName(): String = "main"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
      this,
      BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
      object : DefaultReactActivityDelegate(
        this,
        mainComponentName,
        fabricEnabled,
      ) {},
    )
  }
}
`;
      fs.writeFileSync(headlessPath, headlessKt, 'utf8');

      return config;
    },
  ]);

  return config;
};

module.exports = withSteroAssistant;
