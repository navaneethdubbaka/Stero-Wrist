import * as SecureStore from 'expo-secure-store';

const secretCache = new Map<string, string>();

export async function secretSet(id: string, value: string): Promise<void> {
  if (value) {
    secretCache.set(id, value);
  } else {
    secretCache.delete(id);
  }
  await SecureStore.setItemAsync(id, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function secretGet(id: string): Promise<string | null> {
  const cached = secretCache.get(id);
  if (cached) return cached;
  const value = await SecureStore.getItemAsync(id);
  if (value) secretCache.set(id, value);
  return value;
}

export async function secretDelete(id: string): Promise<void> {
  secretCache.delete(id);
  await SecureStore.deleteItemAsync(id);
}

export function profileTokenSecretId(profileId: string): string {
  return `stero.profile.${profileId}.token`;
}

export function ttsApiKeySecretId(): string {
  return 'stero.tts.apiKey';
}

let ttsKeyCache = '';

export function cacheTtsApiKey(key: string): void {
  ttsKeyCache = key.trim();
}

export function cachedTtsApiKey(): string {
  return ttsKeyCache;
}

export function groqApiKeySecretId(): string {
  return 'stero.stt.groq.apiKey';
}

let groqKeyCache = '';

export function cacheGroqApiKey(key: string): void {
  groqKeyCache = key.trim();
}

export function cachedGroqApiKey(): string {
  return groqKeyCache;
}

/** Native FCM / APNs device push token (not Expo Push token). */
export function fcmDeviceTokenSecretId(): string {
  return 'stero.fcm.deviceToken';
}
