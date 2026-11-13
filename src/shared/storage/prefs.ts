import AsyncStorage from '@react-native-async-storage/async-storage';

/** In-memory cache hydrated once from AsyncStorage (Expo-friendly prefs). */
const memory = new Map<string, string>();
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

export async function hydratePrefs(): Promise<void> {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    const keys = await AsyncStorage.getAllKeys();
    const steroKeys = keys.filter((k) => k.startsWith('stero.'));
    if (steroKeys.length > 0) {
      const pairs = await AsyncStorage.multiGet(steroKeys);
      for (const [key, value] of pairs) {
        if (value != null) {
          memory.set(key, value);
        }
      }
    }
    hydrated = true;
  })();
  return hydratePromise;
}

export function getPrefsBackendLabel(): string {
  return 'async-storage';
}

export function prefsGetString(key: string): string | undefined {
  return memory.get(key);
}

export function prefsSetString(key: string, value: string): void {
  memory.set(key, value);
  void AsyncStorage.setItem(key, value);
}

export function prefsDelete(key: string): void {
  memory.delete(key);
  void AsyncStorage.removeItem(key);
}
