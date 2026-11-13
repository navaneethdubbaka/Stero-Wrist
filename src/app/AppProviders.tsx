import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './navigation';
import { startAssistantActivationListeners } from '../features/assistant/assistantActivation';
import { startNotificationListeners } from '../features/notifications/NotificationHandler';
import { useProfilesStore } from '../features/profiles/profilesStore';
import { useSettingsStore } from '../features/settings/settingsStore';
import { initObservability } from '../shared/observability/sentry';
import { hydratePrefs } from '../shared/storage/prefs';
import { colors, type as typeScale } from '../shared/theme/tokens';

export function AppProviders() {
  const hydrateProfiles = useProfilesStore((s) => s.hydrate);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const profilesReady = useProfilesStore((s) => s.hydrated);
  const settingsReady = useSettingsStore((s) => s.hydrated);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    initObservability();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await hydratePrefs();
      if (cancelled) return;
      hydrateProfiles();
      hydrateSettings();
      setBooted(true);
    })().catch(() => {
      hydrateProfiles();
      hydrateSettings();
      setBooted(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hydrateProfiles, hydrateSettings]);

  useEffect(() => {
    if (!booted || !profilesReady || !settingsReady) return;
    const stopAssistant = startAssistantActivationListeners();
    const stopNotify = startNotificationListeners();
    return () => {
      stopAssistant();
      stopNotify();
    };
  }, [booted, profilesReady, settingsReady]);

  const ready = booted && profilesReady && settingsReady;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {ready ? (
        <RootNavigator />
      ) : (
        <View style={styles.boot}>
          <ActivityIndicator color={colors.lanternReady} />
          <Text style={styles.bootText}>Stero Wrist</Text>
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  bootText: {
    ...typeScale.brand,
    color: colors.foam,
  },
});
