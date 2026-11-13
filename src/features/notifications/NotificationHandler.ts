import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useProfilesStore } from '../profiles/profilesStore';
import { useSettingsStore } from '../settings/settingsStore';
import { userMessageForWebhookError, WebhookError } from '../webhook/errors';
import {
  addDevicePushTokenListener,
  clearPersistedDeviceToken,
  getNativeDevicePushToken,
  persistDeviceToken,
  requestNotificationPermissions,
} from './fcmClient';
import {
  categoryIdForPriority,
  channelIdForPriority,
  ensureNotificationChannels,
} from './notificationChannels';
import {
  enqueueOrSpeak,
  startVoiceIdleDrainSubscription,
} from './notificationSpeech';
import { useNotificationsStore } from './notificationsStore';
import {
  extractPushData,
  parseHermesNotification,
} from './parsePayload';
import {
  shouldShowNotification,
  shouldSpeakNotification,
} from './priorityPolicy';
import { registerDeviceToken } from './registerDeviceToken';
import { wasAlreadySpoken } from './spokenDedupe';
import type { HermesNotification } from './types';

let bootstrapped = false;
let tokenSub: { remove: () => void } | null = null;
let receivedSub: { remove: () => void } | null = null;
let responseSub: { remove: () => void } | null = null;
let stopDrain: (() => void) | null = null;

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data ?? {};
    const priority =
      typeof data.priority === 'string' ? data.priority.toLowerCase() : '';
    const low = priority === 'low';
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: !low,
      shouldSetBadge: false,
    };
  },
});

export async function presentHermesNotification(
  note: HermesNotification,
): Promise<void> {
  await ensureNotificationChannels();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: note.title,
      body: note.message,
      data: {
        type: note.type,
        notification_id: note.notification_id,
        priority: note.priority,
        speak: note.speak,
        source: note.source ?? '',
      },
      ...(note.priority === 'low' ? {} : { sound: true as const }),
      ...(Platform.OS === 'android'
        ? { channelId: channelIdForPriority(note.priority) }
        : { categoryIdentifier: categoryIdForPriority(note.priority) }),
    },
    trigger: null,
  });
}

function handleIncomingNotification(
  notification: Notifications.Notification,
): void {
  const raw = extractPushData(notification.request.content);
  const parsed = parseHermesNotification(raw);
  if (!parsed) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[fcm] ignored malformed payload', raw);
    }
    return;
  }

  const settings = useSettingsStore.getState().settings.notifications;

  const hasOsBody =
    Boolean(notification.request.content.title) ||
    Boolean(notification.request.content.body);

  if (!hasOsBody && shouldShowNotification(parsed, settings)) {
    void presentHermesNotification(parsed);
  }

  void enqueueOrSpeak(parsed);
}

function handleNotificationResponse(
  response: Notifications.NotificationResponse,
): void {
  const raw = extractPushData(response.notification.request.content);
  const parsed = parseHermesNotification(raw);
  if (!parsed) return;

  if (wasAlreadySpoken(parsed.notification_id)) {
    return;
  }

  const settings = useSettingsStore.getState().settings.notifications;
  if (!shouldSpeakNotification(parsed, settings)) {
    return;
  }

  void enqueueOrSpeak(parsed);
}

export async function syncFcmRegistration(): Promise<void> {
  const settings = useSettingsStore.getState().settings.notifications;
  const setStatus = useNotificationsStore.getState().setStatus;

  if (!settings.fcmEnabled) {
    setStatus('off');
    return;
  }

  setStatus('pending', { lastError: null });

  if (!settings.deviceTokenUrl.trim()) {
    setStatus('pending', {
      lastError: 'Set a Hermes device token URL to finish registration.',
    });
    return;
  }

  const perm = await requestNotificationPermissions();
  if (!perm.granted) {
    setStatus('error', {
      lastError: perm.message ?? 'Notification permission required.',
    });
    return;
  }

  try {
    const deviceToken = await getNativeDevicePushToken();
    await persistDeviceToken(deviceToken);

    const profile = useProfilesStore.getState().getActiveProfile();
    await registerDeviceToken({
      deviceTokenUrl: settings.deviceTokenUrl,
      profile,
      deviceToken,
      allowHttp: __DEV__,
    });

    setStatus('ready', {
      lastError: null,
      lastRegisteredAt: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof WebhookError
        ? userMessageForWebhookError(error)
        : error instanceof Error
          ? error.message
          : 'FCM registration failed.';
    setStatus('error', { lastError: message });
  }
}

export async function disableFcmRegistration(): Promise<void> {
  useNotificationsStore.getState().reset();
  await clearPersistedDeviceToken();
}

/**
 * Boot once: channels, listeners, speech drain, and register if FCM enabled.
 */
export function startNotificationListeners(): () => void {
  if (bootstrapped) {
    return () => undefined;
  }
  bootstrapped = true;

  void ensureNotificationChannels();
  stopDrain = startVoiceIdleDrainSubscription();

  receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    handleIncomingNotification(notification);
  });

  responseSub = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      handleNotificationResponse(response);
    },
  );

  tokenSub = addDevicePushTokenListener((token) => {
    const enabled = useSettingsStore.getState().settings.notifications.fcmEnabled;
    if (!enabled) return;
    void (async () => {
      try {
        await persistDeviceToken(token);
        const settings = useSettingsStore.getState().settings.notifications;
        const profile = useProfilesStore.getState().getActiveProfile();
        if (!settings.deviceTokenUrl.trim()) return;
        await registerDeviceToken({
          deviceTokenUrl: settings.deviceTokenUrl,
          profile,
          deviceToken: token,
          allowHttp: __DEV__,
        });
        useNotificationsStore.getState().setStatus('ready', {
          lastError: null,
          lastRegisteredAt: new Date().toISOString(),
        });
      } catch (error) {
        const message =
          error instanceof WebhookError
            ? userMessageForWebhookError(error)
            : error instanceof Error
              ? error.message
              : 'Token refresh registration failed.';
        useNotificationsStore.getState().setStatus('error', {
          lastError: message,
        });
      }
    })();
  });

  const fcmEnabled = useSettingsStore.getState().settings.notifications.fcmEnabled;
  if (fcmEnabled) {
    void syncFcmRegistration();
  } else {
    useNotificationsStore.getState().setStatus('off');
  }

  return () => {
    bootstrapped = false;
    receivedSub?.remove();
    responseSub?.remove();
    tokenSub?.remove();
    stopDrain?.();
    receivedSub = null;
    responseSub = null;
    tokenSub = null;
    stopDrain = null;
  };
}
