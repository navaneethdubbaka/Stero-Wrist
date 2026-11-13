const fs = require('fs');
const path = require('path');

/**
 * Dynamic config so google-services files are only referenced when present
 * (copy from *.example — see README).
 */
module.exports = ({ config }) => {
  const root = __dirname;
  const androidGs = path.join(root, 'google-services.json');
  const iosGs = path.join(root, 'GoogleService-Info.plist');

  const android = { ...(config.android ?? {}) };
  const ios = { ...(config.ios ?? {}) };

  if (fs.existsSync(androidGs)) {
    android.googleServicesFile = './google-services.json';
  }
  if (fs.existsSync(iosGs)) {
    ios.googleServicesFile = './GoogleService-Info.plist';
  }

  return {
    ...config,
    android,
    ios,
    plugins: [
      ...(config.plugins ?? []),
      [
        'expo-notifications',
        {
          color: '#3DDC97',
          defaultChannel: 'hermes_normal',
          enableRemoteNotifications: true,
        },
      ],
      // expo-device has no config plugin — listing it breaks prebuild (loads runtime entry).
      'expo-sqlite',
      'expo-audio',
    ],
  };
};
