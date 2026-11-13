import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Screen } from '../../shared/ui/Screen';
import { FormField } from '../../shared/ui/FormField';
import { colors, space, touch, type as typeScale } from '../../shared/theme/tokens';
import { useSettingsStore } from './settingsStore';
import type { InteractionMode } from '../../shared/types/settings';

const MODES: { id: InteractionMode; label: string; hint: string }[] = [
  { id: 'single_request', label: 'Single Request', hint: 'Default — one utterance per activation' },
  { id: 'conversation', label: 'Conversation', hint: 'Phase 9' },
  { id: 'continuous', label: 'Continuous', hint: 'Phase 9' },
  { id: 'notification_only', label: 'Notification Only', hint: 'Voice off; keep FCM later' },
];

export function AssistantSettingsScreen() {
  const assistant = useSettingsStore((s) => s.settings.assistant);
  const setAssistant = useSettingsStore((s) => s.setAssistant);

  return (
    <Screen>
      <Text style={styles.title}>Assistant</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Assistant enabled</Text>
        <Switch
          value={assistant.enabled}
          onValueChange={(enabled) => setAssistant({ enabled })}
        />
      </View>

      <Text style={styles.section}>Default interaction mode</Text>
      <View style={styles.modes}>
        {MODES.map((mode) => (
          <Pressable
            key={mode.id}
            style={[
              styles.mode,
              assistant.defaultMode === mode.id && styles.modeOn,
            ]}
            onPress={() => setAssistant({ defaultMode: mode.id })}
          >
            <Text style={styles.modeTitle}>{mode.label}</Text>
            <Text style={styles.modeHint}>{mode.hint}</Text>
          </Pressable>
        ))}
      </View>

      <FormField
        label="Silence threshold (ms)"
        value={String(assistant.silenceThresholdMs)}
        onChangeText={(text) => {
          const silenceThresholdMs = Number(text.replace(/[^0-9]/g, '')) || 0;
          setAssistant({ silenceThresholdMs });
        }}
        keyboardType="numeric"
        hint="Initial recommendation ~1200 ms"
      />

      <FormField
        label="Language"
        value={assistant.language}
        onChangeText={(language) => setAssistant({ language })}
        placeholder="en-US"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typeScale.title,
    color: colors.foam,
  },
  row: {
    minHeight: touch.min,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    ...typeScale.body,
    color: colors.foam,
  },
  section: {
    ...typeScale.label,
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
});
