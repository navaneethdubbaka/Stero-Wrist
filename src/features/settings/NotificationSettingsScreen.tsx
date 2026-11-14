import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Screen } from '../../shared/ui/Screen';
import { FormField } from '../../shared/ui/FormField';
import { colors, space, touch, type as typeScale } from '../../shared/theme/tokens';
import type {
  NotificationPriority,
  PriorityNotifyRule,
} from '../../shared/types/settings';
import {
  disableFcmRegistration,
  syncFcmRegistration,
} from '../notifications/NotificationHandler';
import { useNotificationsStore } from '../notifications/notificationsStore';
import { clampSpeechVolume } from '../notifications/priorityPolicy';
import { useSettingsStore } from './settingsStore';

const PRIORITIES: { id: NotificationPriority; label: string }[] = [
  { id: 'critical', label: 'Critical' },
  { id: 'high', label: 'High' },
  { id: 'normal', label: 'Normal' },
  { id: 'low', label: 'Low' },
];

function statusLabel(
  status: string,
  lastError: string | null,
): { title: string; body: string } {
  switch (status) {
    case 'ready':
      return {
        title: 'Connected',
        body: 'Device token registered with Hermes.',
      };
    case 'pending':
      return {
        title: 'Pending',
        body: lastError ?? 'Waiting for permission, token, or device URL…',
      };
    case 'error':
      return {
        title: 'Error',
        body: lastError ?? 'Registration failed.',
      };
    default:
      return {
        title: 'Off',
        body: 'Enable FCM to register this device for Hermes pushes.',
      };
  }
}

export function NotificationSettingsScreen() {
  const notifications = useSettingsStore((s) => s.settings.notifications);
  const setNotifications = useSettingsStore((s) => s.setNotifications);
  const status = useNotificationsStore((s) => s.status);
  const lastError = useNotificationsStore((s) => s.lastError);
  const lastRegisteredAt = useNotificationsStore((s) => s.lastRegisteredAt);
  const [busy, setBusy] = useState(false);

  const label = statusLabel(status, lastError);

  const patchRule = (
    priority: NotificationPriority,
    patch: Partial<PriorityNotifyRule>,
  ) => {
    setNotifications({
      priorityRules: {
        ...notifications.priorityRules,
        [priority]: {
          ...notifications.priorityRules[priority],
          ...patch,
        },
      },
    });
  };

  const onToggle = async (fcmEnabled: boolean) => {
    setNotifications({ fcmEnabled });
    setBusy(true);
    try {
      if (fcmEnabled) {
        await syncFcmRegistration();
      } else {
        await disableFcmRegistration();
      }
    } finally {
      setBusy(false);
    }
  };

  const onRegisterNow = async () => {
    setBusy(true);
    try {
      if (!notifications.fcmEnabled) {
        setNotifications({ fcmEnabled: true });
      }
      await syncFcmRegistration();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.hint}>
        Hermes FCM alerts. Voice webhook stays separate. Speech follows priority
        rules and quiet hours; OS DND still controls channel sound (critical can
        bypass DND on Android).
      </Text>

      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={styles.label}>Enable FCM notifications</Text>
          <Text style={styles.caption}>
            Requests permission and registers the device token
          </Text>
        </View>
        <Switch
          value={notifications.fcmEnabled}
          disabled={busy}
          onValueChange={(value) => {
            void onToggle(value);
          }}
        />
      </View>

      <FormField
        label="Hermes device token URL"
        value={notifications.deviceTokenUrl}
        onChangeText={(deviceTokenUrl) => setNotifications({ deviceTokenUrl })}
        placeholder="https://hermes.example/v1/device-tokens"
        keyboardType="url"
        hint="POST endpoint that associates this device with your Hermes profile"
      />

      <FormField
        label="Delivery ack URL (optional)"
        value={notifications.ackUrl}
        onChangeText={(ackUrl) => setNotifications({ ackUrl })}
        placeholder="https://hermes.example/v1/notification-acks"
        keyboardType="url"
        hint="Fire-and-forget received/displayed/spoken/acked/dismissed events"
      />

      <View style={styles.statusBox}>
        <Text style={styles.section}>Connection</Text>
        <Text style={styles.statusTitle}>{label.title}</Text>
        <Text style={styles.statusBody}>{label.body}</Text>
        {lastRegisteredAt ? (
          <Text style={styles.caption}>Last registered {lastRegisteredAt}</Text>
        ) : null}
      </View>

      <Pressable
        style={[styles.primaryBtn, busy && styles.btnDisabled]}
        disabled={busy}
        onPress={() => {
          void onRegisterNow();
        }}
        accessibilityRole="button"
        accessibilityLabel="Register now"
      >
        <Text style={styles.primaryText}>
          {busy ? 'Working…' : 'Register now'}
        </Text>
      </Pressable>

      <Text style={styles.section}>Priority rules</Text>
      <Text style={styles.caption}>
        Defaults: critical/high speak; normal/low display only. Payload speak=false
        always suppresses speech.
      </Text>
      {PRIORITIES.map((p) => {
        const rule = notifications.priorityRules[p.id];
        return (
          <View key={p.id} style={styles.priorityCard}>
            <Text style={styles.priorityTitle}>{p.label}</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Notify</Text>
              <Switch
                value={rule.notify}
                onValueChange={(notify) => patchRule(p.id, { notify })}
              />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Speak</Text>
              <Switch
                value={rule.speak}
                onValueChange={(speak) => patchRule(p.id, { speak })}
              />
            </View>
          </View>
        );
      })}

      <Text style={styles.section}>Quiet hours</Text>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={styles.label}>Enable quiet hours</Text>
          <Text style={styles.caption}>
            Suppresses speech (display still shown)
          </Text>
        </View>
        <Switch
          value={notifications.quietHoursEnabled}
          onValueChange={(quietHoursEnabled) =>
            setNotifications({ quietHoursEnabled })
          }
        />
      </View>
      <FormField
        label="Start (HH:mm)"
        value={notifications.quietHoursStart}
        onChangeText={(quietHoursStart) => setNotifications({ quietHoursStart })}
        placeholder="22:00"
      />
      <FormField
        label="End (HH:mm)"
        value={notifications.quietHoursEnd}
        onChangeText={(quietHoursEnd) => setNotifications({ quietHoursEnd })}
        placeholder="07:00"
      />
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={styles.label}>Critical during quiet hours</Text>
          <Text style={styles.caption}>Allow critical alerts to speak</Text>
        </View>
        <Switch
          value={notifications.criticalDuringQuietHours}
          onValueChange={(criticalDuringQuietHours) =>
            setNotifications({ criticalDuringQuietHours })
          }
        />
      </View>

      <FormField
        label="Speech volume (0–1)"
        value={String(notifications.speechVolume)}
        onChangeText={(text) => {
          const n = Number(text);
          if (text.trim() === '') return;
          setNotifications({ speechVolume: clampSpeechVolume(n) });
        }}
        keyboardType="numeric"
        hint="Applied to system TTS for notification speech"
      />

      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={styles.label}>Store full notification body</Text>
          <Text style={styles.caption}>
            Off = inbox keeps title only (payload minimization)
          </Text>
        </View>
        <Switch
          value={notifications.storeFullNotificationBody}
          onValueChange={(storeFullNotificationBody) =>
            setNotifications({ storeFullNotificationBody })
          }
        />
      </View>

      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Session conflict</Text>
        <Text style={styles.bannerBody}>
          Alerts never cancel a voice session. Critical can interrupt assistant
          TTS while speaking; other speech waits until Idle.
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
  section: {
    ...typeScale.label,
    color: colors.mist,
    marginTop: space.sm,
  },
  statusBox: {
    gap: 4,
    marginTop: space.sm,
  },
  statusTitle: {
    ...typeScale.label,
    color: colors.foam,
  },
  statusBody: {
    ...typeScale.body,
    color: colors.mist,
  },
  priorityCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: 12,
    gap: 4,
  },
  priorityTitle: {
    ...typeScale.label,
    color: colors.foam,
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
  btnDisabled: {
    opacity: 0.5,
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
