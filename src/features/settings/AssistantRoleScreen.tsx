import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  isDefaultAssistant,
  isSteroAssistantAvailable,
  openAssistantSettings,
} from '../../../modules/stero-assistant/src';
import { Screen } from '../../shared/ui/Screen';
import { colors, space, touch, type as typeScale } from '../../shared/theme/tokens';

export function AssistantRoleScreen() {
  const [isDefault, setIsDefault] = useState<boolean | null>(null);
  const available = isSteroAssistantAvailable();

  const refresh = useCallback(() => {
    if (!available) {
      setIsDefault(false);
      return;
    }
    void isDefaultAssistant().then(setIsDefault);
  }, [available]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Screen>
      <Text style={styles.title}>Default assistant</Text>
      <Text style={styles.hint}>
        The smartwatch assistant button invokes Android’s configured default
        digital assistant. Set Stero Wrist as that role so the watch can start a
        voice session.
      </Text>

      {Platform.OS !== 'android' ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>iOS activation</Text>
          <Text style={styles.bannerBody}>
            iOS has no third-party default-assistant role, and Apple Watch mic /
            SiriKit App Intents are out of scope for v1. Use Shortcuts (or Action
            Button / Back Tap) to open the deep link below — cold start and warm
            resume both activate a phone-mic voice session.
          </Text>
          <Text style={styles.code}>stero-wrist://activate</Text>
          <Text style={styles.bannerBody}>
            Shortcuts setup: New Shortcut → Open URLs → paste
            stero-wrist://activate → Add to Home Screen, Action Button, or Back
            Tap. Optional: ask Siri “Hey Siri, run Stero” after naming the
            Shortcut.
          </Text>
        </View>
      ) : !available ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Dev client required</Text>
          <Text style={styles.bannerBody}>
            Rebuild with a development client after adding the stero-assistant
            native module. Expo Go cannot host VoiceInteractionService.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.statusBox}>
            <Text style={styles.section}>Status</Text>
            <Text style={styles.status}>
              {isDefault == null
                ? 'Checking…'
                : isDefault
                  ? 'Stero Wrist is the default assistant'
                  : 'Stero Wrist is not the default assistant'}
            </Text>
          </View>

          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              void openAssistantSettings().then(() => {
                setTimeout(refresh, 800);
              });
            }}
            accessibilityRole="button"
            accessibilityLabel="Set Stero Wrist as default assistant"
          >
            <Text style={styles.primaryText}>
              Set Stero Wrist as default assistant
            </Text>
          </Pressable>

          <Pressable style={styles.secondaryBtn} onPress={refresh}>
            <Text style={styles.secondaryText}>Refresh status</Text>
          </Pressable>
        </>
      )}
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
    color: colors.mist,
  },
  statusBox: {
    gap: 6,
    marginTop: space.sm,
  },
  status: {
    ...typeScale.body,
    color: colors.foam,
  },
  primaryBtn: {
    backgroundColor: colors.lanternReady,
    borderRadius: 10,
    minHeight: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryText: {
    ...typeScale.label,
    color: colors.ink,
  },
  secondaryBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  secondaryText: {
    ...typeScale.label,
    color: colors.lanternReady,
  },
  banner: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: 16,
    gap: 8,
  },
  bannerTitle: {
    ...typeScale.label,
    color: colors.lanternPending,
  },
  bannerBody: {
    ...typeScale.body,
    color: colors.mist,
  },
  code: {
    ...typeScale.label,
    color: colors.lanternReady,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
});
