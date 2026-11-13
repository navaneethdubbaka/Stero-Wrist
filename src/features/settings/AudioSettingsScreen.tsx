import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../shared/ui/Screen';
import { colors, space, touch, type as typeScale } from '../../shared/theme/tokens';
import type { AudioInputPreference } from '../../shared/types/settings';
import { readActiveInputInfo } from '../assistant/audioRoute';
import { formatMicSourceLabel } from '../assistant/audioRoutePolicy';
import { useSettingsStore } from './settingsStore';

const INPUT_OPTIONS: { id: AudioInputPreference; label: string; hint: string }[] =
  [
    {
      id: 'auto',
      label: 'Auto',
      hint: 'Prefer watch HFP when connected; else phone mic',
    },
    {
      id: 'watch',
      label: 'Watch / HFP',
      hint: 'Force Bluetooth HFP when available',
    },
    {
      id: 'phone',
      label: 'Phone mic',
      hint: 'Never start SCO; always phone mic',
    },
  ];

export function AudioSettingsScreen() {
  const audio = useSettingsStore((s) => s.settings.audio);
  const setAudio = useSettingsStore((s) => s.setAudio);
  const [probeLabel, setProbeLabel] = useState('Probing…');

  const refreshProbe = useCallback(() => {
    void readActiveInputInfo().then((info) => {
      setProbeLabel(formatMicSourceLabel(info));
    });
  }, []);

  useEffect(() => {
    refreshProbe();
  }, [refreshProbe]);

  return (
    <Screen>
      <Text style={styles.title}>Audio</Text>
      <Text style={styles.hint}>
        Input and output stay independent. Replies always play on the phone
        speaker in Phase 5.
      </Text>

      <Text style={styles.section}>Input preference</Text>
      {INPUT_OPTIONS.map((opt) => {
        const selected = audio.inputDevice === opt.id;
        return (
          <Pressable
            key={opt.id}
            style={[styles.option, selected && styles.optionSelected]}
            onPress={() => setAudio({ inputDevice: opt.id })}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text style={styles.optionLabel}>{opt.label}</Text>
            <Text style={styles.optionHint}>{opt.hint}</Text>
          </Pressable>
        );
      })}

      <Text style={styles.section}>Live route probe</Text>
      <Text style={styles.probe}>{probeLabel}</Text>
      <Pressable style={styles.refreshBtn} onPress={refreshProbe}>
        <Text style={styles.refreshText}>Refresh probe</Text>
      </Pressable>

      <Text style={styles.section}>Output</Text>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Phone speaker</Text>
        <Text style={styles.bannerBody}>
          Watch / earbud output routing is deferred to Phase 9. SCO is torn down
          before TTS so replies stay on the phone.
        </Text>
      </View>

      {Platform.OS === 'ios' ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>iOS</Text>
          <Text style={styles.bannerBody}>
            Watch mic and default-assistant activation are Android-first. Use a
            Shortcut that opens stero-wrist://activate for phone-mic voice.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typeScale.title,
    color: colors.foam,
  },
  hint: {
    ...typeScale.caption,
    color: colors.mist,
  },
  section: {
    ...typeScale.label,
    color: colors.foam,
    marginTop: space.md,
  },
  option: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: 14,
    gap: 4,
    minHeight: touch.min,
    justifyContent: 'center',
  },
  optionSelected: {
    borderColor: colors.lanternReady,
  },
  optionLabel: {
    ...typeScale.label,
    color: colors.foam,
  },
  optionHint: {
    ...typeScale.caption,
    color: colors.mist,
  },
  probe: {
    ...typeScale.body,
    color: colors.foam,
  },
  refreshBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  refreshText: {
    ...typeScale.label,
    color: colors.lanternReady,
  },
  banner: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: 16,
    gap: 6,
  },
  bannerTitle: {
    ...typeScale.label,
    color: colors.lanternPending,
  },
  bannerBody: {
    ...typeScale.body,
    color: colors.mist,
  },
});
