import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../shared/ui/Screen';
import { FormField } from '../../shared/ui/FormField';
import { colors, space, touch, type as typeScale } from '../../shared/theme/tokens';
import { useSettingsStore } from './settingsStore';
import type { TtsProviderId } from '../../shared/types/settings';

const PROVIDERS: { id: TtsProviderId; label: string; hint: string }[] = [
  { id: 'system', label: 'System TTS', hint: 'Built-in — Phase 4 playback' },
  { id: 'openai', label: 'OpenAI', hint: 'Cloud — Phase 9' },
  { id: 'fish_audio', label: 'Fish Audio', hint: 'Cloud — Phase 9' },
  { id: 'custom_http', label: 'Custom HTTP', hint: 'Phase 9' },
];

export function TtsSettingsScreen() {
  const tts = useSettingsStore((s) => s.settings.tts);
  const setTts = useSettingsStore((s) => s.setTts);
  const saveTtsApiKey = useSettingsStore((s) => s.saveTtsApiKey);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const cloud = tts.provider !== 'system';

  const onSaveKey = async () => {
    try {
      await saveTtsApiKey(apiKeyDraft);
      setApiKeyDraft('');
      setMessage(apiKeyDraft.trim() ? 'API key saved securely.' : 'API key cleared.');
    } catch {
      Alert.alert('Secure storage error', 'Could not save the API key.');
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>Text to speech</Text>
      <Text style={styles.hint}>
        Provider selection is stored now. Speech playback arrives in Phase 4 / 9.
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

      <FormField
        label="Voice"
        value={tts.voice}
        onChangeText={(voice) => setTts({ voice })}
        placeholder="default"
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
            label="API key"
            value={apiKeyDraft}
            onChangeText={setApiKeyDraft}
            secureTextEntry
            placeholder={
              tts.apiKeySecretId
                ? 'Key saved — enter new value to replace'
                : 'Stored in secure storage'
            }
          />
          <Pressable style={styles.button} onPress={() => void onSaveKey()}>
            <Text style={styles.buttonText}>
              {apiKeyDraft.trim() ? 'Save API key' : 'Clear API key'}
            </Text>
          </Pressable>
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </>
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
  buttonText: {
    ...typeScale.label,
    color: colors.foam,
  },
  message: {
    ...typeScale.caption,
    color: colors.lanternReady,
  },
});
