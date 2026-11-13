import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../shared/ui/Screen';
import { FormField } from '../../shared/ui/FormField';
import { colors, type as typeScale } from '../../shared/theme/tokens';
import { useSettingsStore } from './settingsStore';

export function AudioSettingsScreen() {
  const audio = useSettingsStore((s) => s.settings.audio);
  const setAudio = useSettingsStore((s) => s.setAudio);

  return (
    <Screen>
      <Text style={styles.title}>Audio</Text>
      <Text style={styles.hint}>
        Placeholders for Phase 5 / 9 routing. Input and output stay independent.
      </Text>

      <FormField
        label="Input device"
        value={audio.inputDevice}
        onChangeText={(inputDevice) => setAudio({ inputDevice })}
        placeholder="default"
        hint="Watch mic routing arrives with assistant integration"
      />
      <FormField
        label="Output device"
        value={audio.outputDevice}
        onChangeText={(outputDevice) => setAudio({ outputDevice })}
        placeholder="phone_speaker"
        hint="Default remains phone speaker"
      />

      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Not wired yet</Text>
        <Text style={styles.bannerBody}>
          These labels persist locally but do not change the OS audio route in Phase 1.
        </Text>
      </View>
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
