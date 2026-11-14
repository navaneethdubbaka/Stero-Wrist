import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../shared/ui/Screen';
import { FormField } from '../../shared/ui/FormField';
import { colors, space, touch, type as typeScale } from '../../shared/theme/tokens';
import { useSettingsStore } from './settingsStore';
import type { TtsEventOverrideKey, TtsProviderId } from '../../shared/types/settings';
import {
  resolveTtsProvider,
  synthesizeAndPlay,
} from '../tts/resolveTtsProvider';
import { applyAudioOutput } from '../assistant/audioOutput';
import { stopScoAndMicService } from '../assistant/audioRoute';

const PROVIDERS: { id: TtsProviderId; label: string; hint: string }[] = [
  { id: 'system', label: 'System TTS', hint: 'Built-in — live on device' },
  {
    id: 'openai',
    label: 'OpenAI',
    hint: 'Via TTS gateway (provider id: openai)',
  },
  {
    id: 'fish_audio',
    label: 'Fish Audio',
    hint: 'Via TTS gateway (provider id: fish_audio)',
  },
  {
    id: 'custom_http',
    label: 'Custom HTTP',
    hint: 'Via TTS gateway (provider id: custom_http)',
  },
];

const EVENT_KEYS: { id: TtsEventOverrideKey; label: string }[] = [
  { id: 'assistant_response', label: 'Assistant reply' },
  { id: 'notification_critical', label: 'Critical notify' },
  { id: 'notification_high', label: 'High notify' },
  { id: 'notification_normal', label: 'Normal notify' },
  { id: 'notification_low', label: 'Low notify' },
];

const TEST_SAMPLE =
  'Stero Wrist is ready. Hermes replies will be spoken through your selected output.';

export function TtsSettingsScreen() {
  const tts = useSettingsStore((s) => s.settings.tts);
  const audio = useSettingsStore((s) => s.settings.audio);
  const setTts = useSettingsStore((s) => s.setTts);
  const saveTtsApiKey = useSettingsStore((s) => s.saveTtsApiKey);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const cloud = tts.provider !== 'system';
  const hasGateway = Boolean(tts.gatewayUrl.trim());

  const onSaveKey = async () => {
    try {
      await saveTtsApiKey(apiKeyDraft);
      setApiKeyDraft('');
      setMessage(apiKeyDraft.trim() ? 'API key saved securely.' : 'API key cleared.');
    } catch {
      Alert.alert('Secure storage error', 'Could not save the API key.');
    }
  };

  const onTestVoice = async () => {
    setTesting(true);
    setMessage(null);
    try {
      await stopScoAndMicService();
      await applyAudioOutput(audio.outputDevice);
      const resolved = resolveTtsProvider(tts.provider, 'assistant_response');
      if (resolved.silent) {
        setMessage('TTS is silent for this policy.');
        return;
      }
      const result = await synthesizeAndPlay(TEST_SAMPLE, 'assistant_response');
      setMessage(
        resolved.usedSystemFallback || result.usedSystemFallback
          ? 'Played via system TTS (set a gateway URL for cloud voices).'
          : 'Test voice finished.',
      );
    } catch {
      Alert.alert('TTS error', 'Could not play the test voice on this device.');
    } finally {
      setTesting(false);
    }
  };

  const setEventProvider = (
    event: TtsEventOverrideKey,
    value: TtsProviderId | 'silent' | 'inherit',
  ) => {
    const next = { ...(tts.eventProviders ?? {}) };
    if (value === 'inherit') {
      delete next[event];
    } else {
      next[event] = value;
    }
    setTts({ eventProviders: next });
  };

  return (
    <Screen>
      <Text style={styles.title}>Text to speech</Text>
      <Text style={styles.hint}>
        Prefer a TTS gateway so OpenAI/Fish keys never ship in the app. Without
        a gateway URL, cloud providers fall back to system TTS.
      </Text>

      <View style={styles.modes}>
        {PROVIDERS.map((provider) => (
          <Pressable
            key={provider.id}
            style={[styles.mode, tts.provider === provider.id && styles.modeOn]}
            onPress={() => setTts({ provider: provider.id })}
          >
            <Text style={styles.modeTitle}>{provider.label}</Text>
            <Text style={styles.modeHint}>{provider.hint}</Text>
          </Pressable>
        ))}
      </View>

      {cloud && !hasGateway ? (
        <Text style={styles.fallbackNote}>
          No gateway URL — cloud selection will use system TTS. On-device API
          keys are for gateway auth / local testing only; avoid shipping secrets
          in production builds.
        </Text>
      ) : null}

      <FormField
        label="TTS gateway URL"
        value={tts.gatewayUrl}
        onChangeText={(gatewayUrl) => setTts({ gatewayUrl })}
        placeholder="https://your-gateway.example/tts"
        keyboardType="url"
        hint="POST { provider, text, voice, model, language, speed, voice_reference_id }"
      />

      <FormField
        label="Voice"
        value={tts.voice}
        onChangeText={(voice) => setTts({ voice })}
        placeholder="default"
        hint="Use default, or a system / gateway voice identifier"
      />
      <FormField
        label="Language"
        value={tts.language}
        onChangeText={(language) => setTts({ language })}
      />
      <FormField
        label="Speed"
        value={String(tts.speed)}
        onChangeText={(text) => {
          const speed = Number(text) || 1;
          setTts({ speed });
        }}
        keyboardType="numeric"
      />

      <Pressable
        style={[styles.button, testing && styles.buttonDisabled]}
        onPress={() => void onTestVoice()}
        disabled={testing}
        accessibilityRole="button"
        accessibilityLabel="Test voice"
      >
        <Text style={styles.buttonText}>
          {testing ? 'Speaking…' : 'Test voice'}
        </Text>
      </Pressable>

      {cloud ? (
        <>
          <FormField
            label="Model"
            value={tts.model}
            onChangeText={(model) => setTts({ model })}
          />
          <FormField
            label="Voice reference ID"
            value={tts.voiceReferenceId}
            onChangeText={(voiceReferenceId) => setTts({ voiceReferenceId })}
          />
          <FormField
            label="Gateway / API key"
            value={apiKeyDraft}
            onChangeText={setApiKeyDraft}
            secureTextEntry
            placeholder={
              tts.apiKeySecretId
                ? 'Key saved — enter new value to replace'
                : 'Optional — stored in SecureStore'
            }
          />
          <Pressable style={styles.button} onPress={() => void onSaveKey()}>
            <Text style={styles.buttonText}>
              {apiKeyDraft.trim() ? 'Save API key' : 'Clear API key'}
            </Text>
          </Pressable>
        </>
      ) : null}

      <Text style={styles.section}>Per-event overrides</Text>
      <Text style={styles.hint}>
        Leave as Inherit to use the provider above. Silent skips speech for that
        event (notifications still respect priority speak rules).
      </Text>
      {EVENT_KEYS.map((event) => {
        const current = tts.eventProviders?.[event.id];
        const selected = current ?? 'inherit';
        return (
          <View key={event.id} style={styles.eventBlock}>
            <Text style={styles.eventLabel}>{event.label}</Text>
            <View style={styles.chips}>
              {(
                ['inherit', 'system', 'openai', 'fish_audio', 'custom_http', 'silent'] as const
              ).map((id) => (
                <Pressable
                  key={id}
                  style={[styles.chip, selected === id && styles.chipOn]}
                  onPress={() => setEventProvider(event.id, id)}
                >
                  <Text style={styles.chipText}>{id}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}

      {message ? <Text style={styles.message}>{message}</Text> : null}
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
    marginTop: space.md,
  },
  fallbackNote: {
    ...typeScale.caption,
    color: colors.lanternPending,
  },
  modes: {
    gap: space.sm,
  },
  mode: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    padding: space.md,
    gap: 4,
  },
  modeOn: {
    borderColor: colors.lanternReady,
    backgroundColor: colors.brandBand,
  },
  modeTitle: {
    ...typeScale.body,
    color: colors.foam,
    fontWeight: '600',
  },
  modeHint: {
    ...typeScale.caption,
    color: colors.mist,
  },
  button: {
    minHeight: touch.min,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandBand,
    borderWidth: 1,
    borderColor: colors.lanternReady,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...typeScale.label,
    color: colors.foam,
  },
  message: {
    ...typeScale.caption,
    color: colors.lanternReady,
  },
  eventBlock: {
    gap: space.sm,
  },
  eventLabel: {
    ...typeScale.label,
    color: colors.foam,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipOn: {
    borderColor: colors.lanternReady,
    backgroundColor: colors.brandBand,
  },
  chipText: {
    ...typeScale.caption,
    color: colors.foam,
  },
});
