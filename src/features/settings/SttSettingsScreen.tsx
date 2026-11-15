import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { Screen } from '../../shared/ui/Screen';
import { FormField } from '../../shared/ui/FormField';
import { colors, space, touch, type as typeScale } from '../../shared/theme/tokens';
import { useSettingsStore } from './settingsStore';
import type { SttEngineId } from '../../shared/types/settings';

export const STT_ENGINE_OPTIONS: {
  id: SttEngineId;
  label: string;
  hint: string;
}[] = [
  {
    id: 'device',
    label: 'On-device / Google TTS',
    hint: 'Local SpeechRecognizer after hang-up',
  },
  {
    id: 'groq_whisper',
    label: 'Groq Whisper large v3',
    hint: 'Hang-up WAV → api.groq.com (whisper-large-v3)',
  },
  {
    id: 'groq_whisper_turbo',
    label: 'Groq Whisper turbo',
    hint: 'Hang-up WAV → api.groq.com (whisper-large-v3-turbo)',
  },
  {
    id: 'custom',
    label: 'Custom STT URL',
    hint: 'POST the WAV to your server',
  },
];

export function sttEngineLabel(id: SttEngineId | undefined): string {
  return STT_ENGINE_OPTIONS.find((e) => e.id === (id ?? 'device'))?.label ?? 'On-device';
}

export function SttSettingsScreen() {
  const assistant = useSettingsStore((s) => s.settings.assistant);
  const setAssistant = useSettingsStore((s) => s.setAssistant);
  const saveGroqApiKey = useSettingsStore((s) => s.saveGroqApiKey);
  const [groqKeyDraft, setGroqKeyDraft] = useState('');
  const [groqKeyMessage, setGroqKeyMessage] = useState<string | null>(null);
  const engine = assistant.sttEngine ?? 'device';
  const groq = engine === 'groq_whisper' || engine === 'groq_whisper_turbo';

  return (
    <Screen>
      <Text style={styles.title}>Speech to Text</Text>
      <Text style={styles.lead}>
        After you hang up a watch Talk, the recording is sent to this engine.
      </Text>

      {STT_ENGINE_OPTIONS.map((opt) => (
        <Pressable
          key={opt.id}
          style={[styles.mode, engine === opt.id && styles.modeOn]}
          onPress={() => setAssistant({ sttEngine: opt.id })}
        >
          <Text style={styles.modeTitle}>{opt.label}</Text>
          <Text style={styles.modeHint}>{opt.hint}</Text>
        </Pressable>
      ))}

      {groq ? (
        <>
          <FormField
            label="Groq API key"
            value={groqKeyDraft}
            onChangeText={setGroqKeyDraft}
            secureTextEntry
            placeholder={
              assistant.groqApiKeySecretId
                ? 'Key saved — enter a new value to replace'
                : 'gsk_… stored in SecureStore'
            }
            hint="Bearer token for api.groq.com audio transcriptions."
          />
          <Pressable
            style={styles.button}
            onPress={() => {
              void (async () => {
                try {
                  await saveGroqApiKey(groqKeyDraft);
                  setGroqKeyDraft('');
                  setGroqKeyMessage(
                    groqKeyDraft.trim()
                      ? 'Groq API key saved.'
                      : 'Groq API key cleared.',
                  );
                } catch {
                  Alert.alert(
                    'Secure storage error',
                    'Could not save the Groq API key.',
                  );
                }
              })();
            }}
          >
            <Text style={styles.buttonText}>
              {groqKeyDraft.trim() ? 'Save Groq API key' : 'Clear Groq API key'}
            </Text>
          </Pressable>
          {groqKeyMessage ? (
            <Text style={styles.modeHint}>{groqKeyMessage}</Text>
          ) : null}
        </>
      ) : null}

      {engine === 'custom' ? (
        <FormField
          label="Custom STT URL"
          value={assistant.sttUrl ?? ''}
          onChangeText={(sttUrl) => setAssistant({ sttUrl })}
          placeholder="https://example.com/stt"
          hint="POST multipart field audio (WAV) and language. JSON { transcript } or { text }."
          keyboardType="url"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typeScale.title,
    color: colors.foam,
  },
  lead: {
    ...typeScale.caption,
    color: colors.mist,
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
    ...typeScale.body,
    color: colors.foam,
    fontWeight: '600',
  },
});
