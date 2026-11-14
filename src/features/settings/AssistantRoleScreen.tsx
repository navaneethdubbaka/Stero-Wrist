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
  applyVoiceInteractionSelection,
  getAssistantStatus,
  isSteroAssistantAvailable,
  openAssistantSettings,
  type AssistantStatus,
} from '../../../modules/stero-assistant/src';
import { Screen } from '../../shared/ui/Screen';
import { colors, space, touch, type as typeScale } from '../../shared/theme/tokens';

export function AssistantRoleScreen() {
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);
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

  const voiceOk = Boolean(status?.voiceSelected);
  const roleOnly = Boolean(status?.roleHeld) && !voiceOk;
  const selected = Boolean(status?.isSelected);

  return (
    <Screen>
      <Text style={styles.title}>Default assistant</Text>
      <Text style={styles.hint}>
        Watch “Talk to assistant” uses the phone’s voice interaction service —
        not only the Digital assistant role. Both must point at Stero.
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
                : voiceOk
                  ? 'Stero is the active voice interaction service'
                  : roleOnly
                    ? 'Digital assistant role is Stero, but voice service is still None — watch will show None'
                    : selected
                      ? 'Stero is partially selected'
                      : 'Stero Wrist is not selected yet'}
            </Text>
            {status?.voiceSelected ? (
              <Text style={styles.caption}>Voice interaction service: on</Text>
            ) : (
              <Text style={styles.warn}>Voice interaction service: None (watch uses this)</Text>
            )}
            {status?.assistSelected ? (
              <Text style={styles.caption}>Assist app: on</Text>
            ) : null}
            {status?.roleHeld ? (
              <Text style={styles.caption}>Digital assistant role: held</Text>
            ) : null}
            {applyMsg ? <Text style={styles.caption}>{applyMsg}</Text> : null}
          </View>

          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              setApplyMsg(null);
              void applyVoiceInteractionSelection().then((result) => {
                if (result.ok) {
                  setApplyMsg('Voice interaction service set to Stero');
                } else {
                  setApplyMsg(
                    result.error ??
                      'Could not write secure settings — use ADB grant below',
                  );
                }
                refresh();
              });
            }}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>Fix watch “None” (apply Stero)</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryBtn}
            onPress={() => {
              void openAssistantSettings().then(() => {
                setTimeout(refresh, 1000);
              });
            }}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>Open assistant / Assist settings</Text>
          </Pressable>

          <Pressable style={styles.secondaryBtn} onPress={refresh}>
            <Text style={styles.secondaryText}>Refresh status</Text>
          </Pressable>

          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Why the watch shows None</Text>
            <Text style={styles.bannerBody}>
              Selecting Stero under “Default digital assistant app” only sets
              ROLE_ASSISTANT. The watch Assist screen reads
              voice_interaction_service, which can stay None until written
              separately. Tap “Fix watch None” above after granting the ADB
              permission once.
            </Text>
          </View>

          {status?.ourComponent ? (
            <View style={styles.banner}>
              <Text style={styles.bannerTitle}>One-time ADB grant</Text>
              <Text style={styles.bannerBody}>
                Required so the app can write voice_interaction_service:
              </Text>
              <Text style={styles.code}>
                {`adb shell pm grant com.sterowrist.app android.permission.WRITE_SECURE_SETTINGS`}
              </Text>
              <Text style={styles.bannerBody}>Then force (optional):</Text>
              <Text style={styles.code}>
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
  warn: {
    ...typeScale.caption,
    color: colors.lanternPending,
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
