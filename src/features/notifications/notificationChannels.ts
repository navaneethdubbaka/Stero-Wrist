import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  PRIORITY_CATEGORY_IDS,
  PRIORITY_CHANNEL_IDS,
  type NotificationPriority,
} from './types';

export function channelIdForPriority(priority: NotificationPriority): string {
  return PRIORITY_CHANNEL_IDS[priority];
}

export function categoryIdForPriority(priority: NotificationPriority): string {
  return PRIORITY_CATEGORY_IDS[priority];
}

/**
 * Create Android channels + iOS categories by Hermes priority.
 * Must run before getDevicePushTokenAsync on Android 13+.
 */
export async function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(PRIORITY_CHANNEL_IDS.critical, {
      name: 'Critical alerts',
      importance: Notifications.AndroidImportance.MAX,
      bypassDnd: true,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E85D4C',
    });
    await Notifications.setNotificationChannelAsync(PRIORITY_CHANNEL_IDS.high, {
      name: 'High priority',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 100, 200],
    });
    await Notifications.setNotificationChannelAsync(PRIORITY_CHANNEL_IDS.normal, {
      name: 'Normal',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync(PRIORITY_CHANNEL_IDS.low, {
      name: 'Low / quiet',
      importance: Notifications.AndroidImportance.LOW,
    });
  }

  if (Platform.OS === 'ios') {
    await Notifications.setNotificationCategoryAsync(
      PRIORITY_CATEGORY_IDS.critical,
      [],
    );
    await Notifications.setNotificationCategoryAsync(PRIORITY_CATEGORY_IDS.high, []);
    await Notifications.setNotificationCategoryAsync(
      PRIORITY_CATEGORY_IDS.normal,
      [],
    );
    await Notifications.setNotificationCategoryAsync(PRIORITY_CATEGORY_IDS.low, []);
  }
}
