import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Screen } from '../../shared/ui/Screen';
import { FormField } from '../../shared/ui/FormField';
import { colors, space, touch, type as typeScale } from '../../shared/theme/tokens';
import { useSettingsStore } from './settingsStore';
import type { InteractionMode } from '../../shared/types/settings';
import { prefsGetString, prefsSetString } from '../../shared/storage/prefs';
import {
  isCallRedirectionRoleHeld,
  isSteroAssistantAvailable,
  requestCallRedirectionRole,
} from '../../../modules/stero-assistant/src';

const CONTINUOUS_WARN_KEY = 'stero.continuous.batteryWarned';

const MODES: { id: InteractionMode; label: string; hint: string }[] = [
  {
    id: 'single_request',
    label: 'Single Request',
    hint: 'One utterance per activation',
  },
  {
    id: 'conversation',
    label: 'Conversation',
    hint: 'After each reply, listen again (same session, capped turns)',
  },
  {
    id: 'continuous',
    label: 'Continuous',
    hint: 'Keeps STT running — higher battery use; confirm on enable',
  },
  {
    id: 'notification_only',
    label: 'Notification Only',
    hint: 'Voice off; FCM / inbox still work',
  },
];

export function AssistantSettingsScreen() {
  const assistant = useSettingsStore((s) => s.settings.assistant);
  const setAssistant = useSettingsStore((s) => s.setAssistant);
  const [redirectHeld, setRedirectHeld] = useState<boolean | null>(null);
  const [redirectMsg, setRedirectMsg] = useState<string | null>(null);

  const refreshRedirect = useCallback(() => {
    if (!isSteroAssistantAvailable()) {
      setRedirectHeld(false);
      return;
    }
    void isCallRedirectionRoleHeld().then(setRedirectHeld);
  }, []);

  useEffect(() => {
    refreshRedirect();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshRedirect();
    });
    return () => sub.remove();
  }, [refreshRedirect]);

  const selectMode = (mode: InteractionMode) => {
    if (mode !== 'continuous') {
      setAssistant({ defaultMode: mode });
      return;
    }

    const already = prefsGetString(CONTINUOUS_WARN_KEY) === '1';
    if (already) {
      setAssistant({ defaultMode: 'continuous' });
      return;
    }

    Alert.alert(
      'Battery warning',
      'Continuous mode keeps speech recognition running and uses more battery. Mic/SCO stop only when you Cancel. Enable anyway?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enable Continuous',
          style: 'destructive',
          onPress: () => {
            prefsSetString(CONTINUOUS_WARN_KEY, '1');
            setAssistant({ defaultMode: 'continuous' });
          },
        },
      ],
    );
  };

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
            onPress={() => selectMode(mode.id)}
          >
            <Text style={styles.modeTitle}>{mode.label}</Text>
            <Text style={styles.modeHint}>{mode.hint}</Text>
          </Pressable>
        ))}
      </View>

      {assistant.defaultMode === 'continuous' ? (
        <Text style={styles.warn}>
          Continuous is active. Cancel the session to stop recognition and
          release the mic. Prefer Single Request when battery matters.
        </Text>
      ) : null}

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

      <Text style={styles.section}>Dial-pad activation</Text>
      <Text style={styles.modeHint}>
        Dial this code on the Phone app and press Call. Only this code is
        intercepted; every other number places a normal call. Leading zeros
        are kept.
      </Text>
      <FormField
        label="Dial-pad code"
        value={assistant.dialPadCode ?? '010'}
        onChangeText={(dialPadCode) => setAssistant({ dialPadCode })}
        keyboardType="numeric"
        hint="Default 010. Requires Android call-redirection role."
      />
      <Text style={styles.status}>
        {redirectHeld == null
          ? 'Checking call redirection…'
          : redirectHeld
            ? 'Call redirection is on — 010 (or your code) opens Stero'
            : 'Call redirection is off — Android will not offer 010 to Stero'}
      </Text>
      <Pressable
        style={styles.button}
        onPress={() => {
          void (async () => {
            setRedirectMsg(null);
            const result = await requestCallRedirectionRole();
            if (!result.ok) {
              setRedirectMsg(result.error ?? 'Could not open the system prompt.');
              return;
            }
            if (result.held) {
              setRedirectHeld(true);
              setRedirectMsg('Call redirection is already allowed.');
              return;
            }
            setRedirectMsg('Complete the system prompt, then return here.');
          })();
        }}
      >
        <Text style={styles.buttonText}>Allow call redirection</Text>
      </Pressable>
      {redirectMsg ? <Text style={styles.modeHint}>{redirectMsg}</Text> : null}
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
  warn: {
    ...typeScale.caption,
    color: colors.lanternPending,
  },
  status: {
    ...typeScale.caption,
    color: colors.foam,
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
});
