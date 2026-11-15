import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './navigation';
import { startAssistantActivationListeners } from '../features/assistant/assistantActivation';
import {
  detectOverlayMode,
  markOverlayMode,
} from '../features/assistant/overlayMode';
import { startOverlayPhaseSync } from '../features/assistant/overlayPhaseSync';
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
  const [overlayReady, setOverlayReady] = useState(false);
  const [overlayMode, setOverlayMode] = useState(false);

  useEffect(() => {
    initObservability();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      try {
        const overlay = await detectOverlayMode();
        if (cancelled) return;
        markOverlayMode(overlay);
        setOverlayMode(overlay);
        setOverlayReady(true);
      } catch {
        if (cancelled) return;
        markOverlayMode(false);
        setOverlayMode(false);
        setOverlayReady(true);
      }
    };
    void probe();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void probe();
      }
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
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
    // Do not wait for prefs/overlay — Headless Talk dies if hydrate hangs.
    startAssistantActivationListeners();
    return () => undefined;
  }, []);

  useEffect(() => {
    if (!booted || !profilesReady || !settingsReady || !overlayReady) return;
    const stopPhases = overlayMode ? startOverlayPhaseSync() : () => undefined;
    const stopNotify = overlayMode
      ? () => undefined
      : startNotificationListeners();
    return () => {
      stopPhases();
      stopNotify();
    };
  }, [booted, profilesReady, settingsReady, overlayReady, overlayMode]);

  const ready = booted && profilesReady && settingsReady && overlayReady;

  if (overlayMode) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        {/* Transparent host — native orb is the only visible UI. */}
        <View style={styles.overlayHost} pointerEvents="none" />
      </SafeAreaProvider>
    );
  }

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
  overlayHost: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
