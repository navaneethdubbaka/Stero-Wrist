import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  fcmDeviceTokenSecretId,
  secretDelete,
  secretGet,
  secretSet,
} from '../../shared/storage/secrets';
import { ensureNotificationChannels } from './notificationChannels';

export async function requestNotificationPermissions(): Promise<{
  granted: boolean;
  message?: string;
}> {
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') {
    return {
      granted: false,
      message: 'Notification permission was denied.',
    };
  }
  return { granted: true };
}

/**
 * Ensure channels exist, then fetch the native FCM/APNs device token.
 */
export async function getNativeDevicePushToken(): Promise<string> {
  await ensureNotificationChannels();
  const token = await Notifications.getDevicePushTokenAsync();
  if (!token?.data || typeof token.data !== 'string') {
    throw new Error('Could not obtain a native device push token.');
  }
  return token.data;
}

export async function persistDeviceToken(token: string): Promise<void> {
  await secretSet(fcmDeviceTokenSecretId(), token);
}

export async function readPersistedDeviceToken(): Promise<string | null> {
  return secretGet(fcmDeviceTokenSecretId());
}

export async function clearPersistedDeviceToken(): Promise<void> {
  await secretDelete(fcmDeviceTokenSecretId()).catch(() => undefined);
}

export function addDevicePushTokenListener(
  listener: (token: string) => void,
): { remove: () => void } {
  return Notifications.addPushTokenListener((devicePushToken) => {
    const value = devicePushToken.data;
    if (typeof value === 'string' && value.length > 0) {
      listener(value);
    }
  });
}

export function platformLabel(): 'android' | 'ios' {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}
