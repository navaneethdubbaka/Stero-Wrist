import { StyleSheet, Switch, Text, View } from 'react-native';
import { Screen } from '../../shared/ui/Screen';
import { colors, touch, type as typeScale } from '../../shared/theme/tokens';
import { useSettingsStore } from './settingsStore';

export function NotificationSettingsScreen() {
  const notifications = useSettingsStore((s) => s.settings.notifications);
  const setNotifications = useSettingsStore((s) => s.setNotifications);

  return (
    <Screen>
      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.hint}>
        Preference only for now. Firebase Cloud Messaging wiring ships in Phase 6.
      </Text>

      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={styles.label}>Enable FCM notifications</Text>
          <Text style={styles.caption}>Does not register a device token yet</Text>
        </View>
        <Switch
          value={notifications.fcmEnabled}
          onValueChange={(fcmEnabled) => setNotifications({ fcmEnabled })}
        />
      </View>

      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Coming in Phase 6</Text>
        <Text style={styles.bannerBody}>
          Priority rules, quiet hours, and spoken critical alerts are not active in
          this build.
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
  row: {
    minHeight: touch.min,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...typeScale.body,
    color: colors.foam,
  },
  caption: {
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
