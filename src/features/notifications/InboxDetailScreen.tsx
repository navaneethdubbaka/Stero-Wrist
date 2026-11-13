import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import type { RootStackParamList } from '../../app/navigation';
import { Screen } from '../../shared/ui/Screen';
import { colors, space, touch, type as typeScale } from '../../shared/theme/tokens';
import { userMessageForWebhookError, WebhookError } from '../webhook/errors';
import { postDeliveryAck } from './deliveryAck';
import {
  acknowledge,
  dismiss,
  getById,
  setRemindAt,
} from './inboxRepository';
import type { InboxNotification } from './inboxTypes';
import { sendNotificationFollowUp } from './sendNotificationFollowUp';

type Props = NativeStackScreenProps<RootStackParamList, 'InboxDetail'>;

function remindDate(preset: '15m' | '1h' | 'tomorrow'): Date {
  const d = new Date();
  if (preset === '15m') {
    d.setMinutes(d.getMinutes() + 15);
  } else if (preset === '1h') {
    d.setHours(d.getHours() + 1);
  } else {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  }
  return d;
}

export function InboxDetailScreen({ navigation, route }: Props) {
  const { notificationId } = route.params;
  const [item, setItem] = useState<InboxNotification | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const row = await getById(notificationId);
    setItem(row);
  }, [notificationId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onAck = async () => {
    setBusy(true);
    try {
      await acknowledge(notificationId);
      void postDeliveryAck(notificationId, 'acked');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const onDismiss = () => {
    Alert.alert(
      'Dismiss notification?',
      'This hides the item from the default inbox filters.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await dismiss(notificationId);
                void postDeliveryAck(notificationId, 'dismissed');
                navigation.goBack();
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  const onRemind = (preset: '15m' | '1h' | 'tomorrow') => {
    void (async () => {
      if (!item) return;
      setBusy(true);
      try {
        const when = remindDate(preset);
        await setRemindAt(notificationId, when.toISOString());
        await Notifications.scheduleNotificationAsync({
          content: {
            title: item.title,
            body: item.message,
            data: {
              type: 'hermes_notification',
              notification_id: item.notificationId,
              priority: item.priority,
              speak: false,
              source: item.source ?? '',
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: when,
          },
        });
        await load();
        Alert.alert('Reminder set', `Will remind at ${when.toLocaleString()}`);
      } catch (error) {
        Alert.alert(
          'Could not schedule reminder',
          error instanceof Error ? error.message : 'Unknown error',
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  const onAskHermes = () => {
    if (!item) return;
    Alert.alert(
      'Ask Hermes?',
      'Send a follow-up about this notification with context to your active profile webhook.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ask',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                const text = `Tell me more about: ${item.title}. ${item.message}`;
                const result = await sendNotificationFollowUp(
                  item.notificationId,
                  text,
                );
                await load();
                Alert.alert('Hermes reply', result.responseText.slice(0, 500));
              } catch (error) {
                const message =
                  error instanceof WebhookError
                    ? userMessageForWebhookError(error)
                    : error instanceof Error
                      ? error.message
                      : 'Ask Hermes failed.';
                Alert.alert('Ask Hermes failed', message);
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  if (!item) {
    return (
      <Screen>
        <Text style={styles.meta}>Loading…</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.body}>{item.message}</Text>
      <Text style={styles.meta}>
        {item.priority} · {item.timestamp}
        {item.source ? ` · ${item.source}` : ''}
      </Text>
      <Text style={styles.meta}>
        Status: {item.deliveryStatus}
        {item.spoken ? ' · spoken' : ''}
        {item.acknowledged ? ' · acked' : ''}
        {item.remindAt ? ` · remind ${item.remindAt}` : ''}
      </Text>
      <Text style={styles.meta}>ID {item.notificationId}</Text>

      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, busy && styles.disabled]}
          disabled={busy || item.acknowledged}
          onPress={() => {
            void onAck();
          }}
        >
          <Text style={styles.btnText}>Acknowledge</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnDanger, busy && styles.disabled]}
          disabled={busy}
          onPress={onDismiss}
        >
          <Text style={styles.btnText}>Dismiss</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, busy && styles.disabled]}
          disabled={busy}
          onPress={onAskHermes}
        >
          <Text style={styles.btnText}>Ask Hermes</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Remind later</Text>
      <View style={styles.actions}>
        <Pressable
          style={[styles.btnSecondary, busy && styles.disabled]}
          disabled={busy}
          onPress={() => onRemind('15m')}
        >
          <Text style={styles.btnSecondaryText}>15 min</Text>
        </Pressable>
        <Pressable
          style={[styles.btnSecondary, busy && styles.disabled]}
          disabled={busy}
          onPress={() => onRemind('1h')}
        >
          <Text style={styles.btnSecondaryText}>1 hour</Text>
        </Pressable>
        <Pressable
          style={[styles.btnSecondary, busy && styles.disabled]}
          disabled={busy}
          onPress={() => onRemind('tomorrow')}
        >
          <Text style={styles.btnSecondaryText}>Tomorrow</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typeScale.title,
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
  section: {
    ...typeScale.label,
    color: colors.mist,
    marginTop: space.md,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: space.sm,
  },
  btn: {
    minHeight: touch.min,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.lanternReady,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDanger: {
    backgroundColor: colors.lanternError,
  },
  btnText: {
    ...typeScale.label,
    color: colors.ink,
  },
  btnSecondary: {
    minHeight: touch.min,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    ...typeScale.label,
    color: colors.foam,
  },
  disabled: {
    opacity: 0.5,
  },
});
