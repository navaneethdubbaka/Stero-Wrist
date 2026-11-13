import { useCallback, useEffect, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  getAssistantStatus,
  isSteroAssistantAvailable,
  openAssistantSettings,
  type AssistantStatus,
} from '../../../modules/stero-assistant/src';
import { Screen } from '../../shared/ui/Screen';
import { colors, space, touch, type as typeScale } from '../../shared/theme/tokens';

export function AssistantRoleScreen() {
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const available = isSteroAssistantAvailable();

  const refresh = useCallback(() => {
    if (!available) {
      setStatus(null);
      return;
    }
    void getAssistantStatus().then(setStatus);
  }, [available]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selected = Boolean(status?.isSelected);

  return (
    <Screen>
      <Text style={styles.title}>Default assistant</Text>
      <Text style={styles.hint}>
        Watch assistant buttons call the phone’s default assistant / Assist app.
        Stero must be selected there so the watch can start a voice session.
      </Text>

      {Platform.OS !== 'android' ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>iOS activation</Text>
          <Text style={styles.bannerBody}>
            iOS has no third-party default-assistant role. Use Shortcuts → Open
            URL stero-wrist://activate.
          </Text>
          <Text style={styles.code}>stero-wrist://activate</Text>
        </View>
      ) : !available ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Native module missing</Text>
          <Text style={styles.bannerBody}>
            This build is missing VoiceInteraction. Install the latest release
            APK (not Expo Go).
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.statusBox}>
            <Text style={styles.section}>Status</Text>
            <Text style={styles.status}>
              {status == null
                ? 'Checking…'
                : selected
                  ? 'Stero Wrist is selected as assistant / Assist app'
                  : 'Stero Wrist is not selected yet'}
            </Text>
            {status?.voiceSelected ? (
              <Text style={styles.caption}>Voice interaction service: on</Text>
            ) : null}
            {status?.assistSelected ? (
              <Text style={styles.caption}>Assist app: on</Text>
            ) : null}
            {status?.roleHeld ? (
              <Text style={styles.caption}>Digital assistant role: held</Text>
            ) : null}
          </View>

          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              void openAssistantSettings().then(() => {
                setTimeout(refresh, 1000);
              });
            }}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>Open assistant / Assist settings</Text>
          </Pressable>

          <Pressable style={styles.secondaryBtn} onPress={refresh}>
            <Text style={styles.secondaryText}>Refresh status</Text>
          </Pressable>

          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>If Stero is missing from the list</Text>
            <Text style={styles.bannerBody}>
              Many OEM skins (vivo / iQOO / Oppo / Xiaomi) only show Google or
              their own assistant under “Digital assistant”. Try instead:
            </Text>
            <Text style={styles.bannerBody}>
              1. Settings → Apps → Default apps → Assist & voice input → Assist
              app → Stero Wrist
            </Text>
            <Text style={styles.bannerBody}>
              2. Settings → Search “Assist” or “Voice input” → set Assist app to
              Stero Wrist
            </Text>
            <Text style={styles.bannerBody}>
              3. Long-press Home / swipe corner Assist gesture and choose Stero
              when prompted
            </Text>
            <Text style={styles.bannerBody}>
              Watch button support still depends on the OEM routing that press
              to Assist / VoiceInteraction. If the watch only talks to Jovi /
              Google, Stero cannot intercept it without OEM support.
            </Text>
          </View>

          {status?.ourComponent ? (
            <View style={styles.banner}>
              <Text style={styles.bannerTitle}>Advanced (ADB)</Text>
              <Text style={styles.bannerBody}>
                With USB debugging, you can force the voice interaction service:
              </Text>
              <Text
                style={styles.code}
                onPress={() => {
                  void Linking.openURL('https://developer.android.com/studio/command-line/adb');
                }}
              >
                {`adb shell settings put secure voice_interaction_service ${status.ourComponent}`}
              </Text>
            </View>
          ) : null}
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
  caption: {
    ...typeScale.caption,
    color: colors.lanternReady,
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
    ...typeScale.caption,
    color: colors.lanternReady,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
});
