import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  isDefaultAssistant,
  isSteroAssistantAvailable,
} from '../../../modules/stero-assistant/src';
import { Screen } from '../../shared/ui/Screen';
import { ChannelStrip, type ChannelSegment } from '../../shared/ui/ChannelStrip';
import { colors, space, touch, type as typeScale } from '../../shared/theme/tokens';
import { useProfilesStore } from '../profiles/profilesStore';
import { useSettingsStore } from '../settings/settingsStore';
import type { RootStackParamList } from '../../app/navigation';
import { buildChannelStates } from './channelStatus';
import { useVoiceSessionStore } from '../assistant/voiceSessionStore';
import { voiceStateLabel } from '../assistant/voiceStateMachine';
import {
  activateVoiceSession,
  cancelVoiceSession,
  dismissVoiceError,
  retryLastTranscript,
} from '../assistant/VoiceSessionController';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

function providerLabel(provider: string): string {
  switch (provider) {
    case 'system':
      return 'System TTS';
    case 'openai':
      return 'OpenAI TTS';
    case 'fish_audio':
      return 'Fish Audio';
    case 'custom_http':
      return 'Custom HTTP TTS';
    default:
      return provider;
  }
}

export function HomeScreen({ navigation }: Props) {
  const profiles = useProfilesStore((s) => s.profiles);
  const activeProfile = useProfilesStore((s) => s.getActiveProfile());
  const settings = useSettingsStore((s) => s.settings);
  const tts = settings.tts;
  const notifications = settings.notifications;

  const snapshot = useVoiceSessionStore((s) => s.snapshot);
  const partialTranscript = useVoiceSessionStore((s) => s.partialTranscript);
  const micRoute = useVoiceSessionStore((s) => s.micRoute);
  const voiceState = snapshot.state;
  const [assistantRoleOk, setAssistantRoleOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android' || !isSteroAssistantAvailable()) {
      setAssistantRoleOk(null);
      return;
    }
    void isDefaultAssistant().then(setAssistantRoleOk);
  }, []);

  const channel = useMemo(
    () => buildChannelStates(activeProfile, settings, voiceState),
    [activeProfile, settings, voiceState],
  );

  const segments: ChannelSegment[] = [
    { id: 'assistant', label: 'Assistant', state: channel.assistant },
    { id: 'hermes', label: 'Hermes', state: channel.hermes },
    { id: 'tts', label: 'TTS', state: channel.tts },
    { id: 'notify', label: 'Notify', state: channel.notify },
  ];

  const showSetup = profiles.length === 0;
  const voiceBusy =
    voiceState !== 'IDLE' && voiceState !== 'ERROR';
  const canActivate =
    settings.assistant.enabled &&
    settings.assistant.defaultMode === 'single_request' &&
    (voiceState === 'IDLE' || voiceState === 'ERROR');
  const canCancel =
    voiceState === 'ACTIVATED' ||
    voiceState === 'LISTENING' ||
    voiceState === 'TRANSCRIBING' ||
    voiceState === 'SENDING' ||
    voiceState === 'WAITING_RESPONSE' ||
    voiceState === 'SPEAKING';

  const displayTranscript =
    snapshot.context.finalTranscript ||
    partialTranscript ||
    '';

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.brand}>Stero Wrist</Text>
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          style={styles.settingsBtn}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Text style={styles.settingsLabel}>Settings</Text>
        </Pressable>
      </View>

      <Text style={styles.kicker}>Channel status</Text>
      <ChannelStrip segments={segments} />

      <View style={styles.voiceBlock}>
        <Text style={styles.sectionLabel}>Voice session</Text>
        <Text style={styles.voiceState}>{voiceStateLabel(voiceState)}</Text>

        {micRoute.label ? (
          <Text style={styles.meta}>{micRoute.label}</Text>
        ) : null}
        {micRoute.banner ? (
          <Text style={styles.micBanner}>{micRoute.banner}</Text>
        ) : null}

        <View style={styles.voiceActions}>
          <Pressable
            style={[styles.activateBtn, !canActivate && styles.btnDisabled]}
            disabled={!canActivate}
            onPress={() => {
              void activateVoiceSession({ trigger: 'home' });
            }}
            accessibilityRole="button"
            accessibilityLabel="Activate assistant"
          >
            <Text style={styles.activateText}>Activate assistant</Text>
          </Pressable>
          {canCancel ? (
            <Pressable
              style={styles.cancelBtn}
              onPress={() => {
                void cancelVoiceSession();
              }}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          ) : null}
          {voiceState === 'ERROR' && snapshot.context.failedSend ? (
            <Pressable
              style={styles.activateBtn}
              onPress={() => {
                Alert.alert(
                  'Retry last request',
                  'Send the last transcript to Hermes again?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Retry',
                      onPress: () => {
                        void retryLastTranscript();
                      },
                    },
                  ],
                );
              }}
              accessibilityRole="button"
              accessibilityLabel="Retry last request"
            >
              <Text style={styles.activateText}>Retry last request</Text>
            </Pressable>
          ) : null}
          {voiceState === 'ERROR' ? (
            <Pressable
              style={styles.cancelBtn}
              onPress={() => dismissVoiceError()}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Dismiss</Text>
            </Pressable>
          ) : null}
        </View>

        {displayTranscript ? (
          <View style={styles.transcriptBox}>
            <Text style={styles.sectionLabel}>
              {snapshot.context.finalTranscript ? 'Transcript' : 'Hearing…'}
            </Text>
            <Text style={styles.body}>{displayTranscript}</Text>
          </View>
        ) : (
          <Text style={styles.placeholder}>
            {voiceBusy
              ? 'Listening for speech…'
              : 'Tap Activate and speak — sends to Hermes webhook'}
          </Text>
        )}

        {snapshot.context.lastReply ? (
          <View style={styles.transcriptBox}>
            <Text style={styles.sectionLabel}>Last reply</Text>
            <Text style={styles.body}>{snapshot.context.lastReply}</Text>
          </View>
        ) : null}

        {snapshot.context.sessionId ? (
          <Text style={styles.meta}>Session {snapshot.context.sessionId}</Text>
        ) : null}

        {snapshot.context.errorMessage ? (
          <Text style={styles.errorText}>{snapshot.context.errorMessage}</Text>
        ) : null}
      </View>

      <View style={styles.block}>
        <Text style={styles.sectionLabel}>Active profile</Text>
        <Text style={styles.profileName}>
          {activeProfile?.name ?? 'None selected'}
        </Text>
        <Text style={styles.meta}>
          {activeProfile?.webhook.url
            ? activeProfile.webhook.url
            : 'No webhook URL yet'}
        </Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.sectionLabel}>TTS engine</Text>
        <Text style={styles.body}>{providerLabel(tts.provider)}</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.sectionLabel}>Notifications</Text>
        <Text style={styles.body}>
          {notifications.fcmEnabled
            ? 'Marked enabled — FCM wiring comes in Phase 6'
            : 'Not connected (Phase 6)'}
        </Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.sectionLabel}>Last interaction</Text>
        <Text style={styles.body}>
          {snapshot.context.finalTranscript
            ? snapshot.context.finalTranscript
            : 'No interactions yet'}
        </Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.sectionLabel}>Recent notifications</Text>
        <Text style={styles.placeholder}>Inbox arrives in Phase 8</Text>
      </View>

      {showSetup ? (
        <Pressable
          style={styles.cta}
          onPress={() => navigation.navigate('Profiles')}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>Set up Hermes</Text>
          <Text style={styles.ctaHint}>Create a backend profile when you are ready</Text>
        </Pressable>
      ) : null}

      {Platform.OS === 'android' && assistantRoleOk === false ? (
        <Pressable
          style={styles.ctaSecondary}
          onPress={() => navigation.navigate('AssistantRole')}
          accessibilityRole="button"
        >
          <Text style={styles.ctaTextSecondary}>
            Set Stero Wrist as default assistant
          </Text>
          <Text style={styles.ctaHint}>
            Required for the watch assistant button
          </Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touch.min,
  },
  brand: {
    ...typeScale.brand,
    color: colors.foam,
  },
  settingsBtn: {
    minHeight: touch.min,
    minWidth: touch.min,
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  settingsLabel: {
    ...typeScale.label,
    color: colors.lanternReady,
  },
  kicker: {
    ...typeScale.label,
    color: colors.mist,
  },
  block: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.outline,
    gap: space.xs,
  },
  voiceBlock: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.lanternReady,
    gap: space.sm,
  },
  voiceState: {
    ...typeScale.headline,
    color: colors.foam,
    fontSize: 24,
  },
  voiceActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  activateBtn: {
    minHeight: touch.min,
    paddingHorizontal: space.lg,
    borderRadius: 12,
    backgroundColor: colors.brandBand,
    borderWidth: 1,
    borderColor: colors.lanternReady,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activateText: {
    ...typeScale.label,
    color: colors.foam,
  },
  cancelBtn: {
    minHeight: touch.min,
    paddingHorizontal: space.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    ...typeScale.label,
    color: colors.mist,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  transcriptBox: {
    gap: space.xs,
    paddingTop: space.xs,
  },
  sectionLabel: {
    ...typeScale.label,
    color: colors.mist,
  },
  profileName: {
    ...typeScale.headline,
    color: colors.foam,
  },
  body: {
    ...typeScale.body,
    color: colors.foam,
  },
  meta: {
    ...typeScale.caption,
    color: colors.mist,
  },
  placeholder: {
    ...typeScale.body,
    color: colors.lanternOff,
  },
  errorText: {
    ...typeScale.caption,
    color: colors.danger,
  },
  micBanner: {
    ...typeScale.caption,
    color: colors.lanternPending,
  },
  cta: {
    backgroundColor: colors.brandBand,
    borderRadius: 12,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.lanternReady,
    gap: space.xs,
    minHeight: touch.min,
  },
  ctaSecondary: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.outline,
    gap: space.xs,
    minHeight: touch.min,
  },
  ctaText: {
    ...typeScale.title,
    color: colors.foam,
  },
  ctaTextSecondary: {
    ...typeScale.label,
    color: colors.foam,
  },
  ctaHint: {
    ...typeScale.caption,
    color: colors.mist,
  },
});
