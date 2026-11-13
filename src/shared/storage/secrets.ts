import * as SecureStore from 'expo-secure-store';

export async function secretSet(id: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(id, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function secretGet(id: string): Promise<string | null> {
  return SecureStore.getItemAsync(id);
}

export async function secretDelete(id: string): Promise<void> {
  await SecureStore.deleteItemAsync(id);
}

export function profileTokenSecretId(profileId: string): string {
  return `stero.profile.${profileId}.token`;
}

export function ttsApiKeySecretId(): string {
  return 'stero.tts.apiKey';
}

/** Native FCM / APNs device push token (not Expo Push token). */
export function fcmDeviceTokenSecretId(): string {
  return 'stero.fcm.deviceToken';
}
