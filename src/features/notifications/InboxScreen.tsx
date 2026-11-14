import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../app/navigation';
import { Screen } from '../../shared/ui/Screen';
import { colors, space, touch, type as typeScale } from '../../shared/theme/tokens';
import { listInbox } from './inboxRepository';
import type { InboxFilter, InboxNotification } from './inboxTypes';

type Props = NativeStackScreenProps<RootStackParamList, 'Inbox'>;

const FILTERS: { id: InboxFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'critical', label: 'Critical' },
  { id: 'high', label: 'High' },
  { id: 'normal', label: 'Normal' },
  { id: 'low', label: 'Low' },
  { id: 'unread', label: 'Unread' },
  { id: 'acknowledged', label: 'Acked' },
];

function priorityColor(priority: string): string {
  switch (priority) {
    case 'critical':
      return colors.lanternError;
    case 'high':
      return colors.lanternPending;
    case 'low':
      return colors.lanternOff;
    default:
      return colors.lanternReady;
  }
}

export function InboxScreen({ navigation }: Props) {
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await listInbox({ filter, query, limit: 200 });
      setItems(rows);
    } catch {
      setItems([]);
    }
  }, [filter, query]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <Screen scroll={false}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search inbox…"
        placeholderTextColor={colors.lanternOff}
        style={styles.search}
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={() => {
          void load();
        }}
      />

      <View style={styles.chips}>
        {FILTERS.map((f) => {
          const on = filter === f.id;
          return (
            <Pressable
              key={f.id}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => setFilter(f.id)}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        style={styles.flex}
        data={items}
        keyExtractor={(item) => item.notificationId}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No notifications match this filter.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              navigation.navigate('InboxDetail', {
                notificationId: item.notificationId,
              })
            }
          >
            <View
              style={[
                styles.priorityBar,
                { backgroundColor: priorityColor(item.priority) },
              ]}
            />
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.rowMsg} numberOfLines={2}>
                {item.message}
              </Text>
              <Text style={styles.rowMeta}>
                {item.priority}
                {item.spoken ? ' · spoken' : ''}
                {item.acknowledged ? ' · acked' : ''}
                {item.isBatch ? ' · batch' : ''}
                {item.source ? ` · ${item.source}` : ''}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: {
    minHeight: touch.min,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: colors.foam,
    backgroundColor: colors.surface,
    ...typeScale.body,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: space.sm,
    marginBottom: space.sm,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  chipOn: {
    borderColor: colors.lanternReady,
    backgroundColor: colors.brandBand,
  },
  chipText: {
    ...typeScale.caption,
    color: colors.mist,
  },
  chipTextOn: {
    color: colors.foam,
  },
  list: {
    gap: 8,
    paddingBottom: 24,
    flexGrow: 1,
  },
  empty: {
    ...typeScale.body,
    color: colors.lanternOff,
    marginTop: space.lg,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.outline,
    overflow: 'hidden',
    minHeight: touch.min,
  },
  priorityBar: {
    width: 4,
  },
  rowBody: {
    flex: 1,
    padding: 12,
    gap: 4,
  },
  rowTitle: {
    ...typeScale.label,
    color: colors.foam,
  },
  rowMsg: {
    ...typeScale.body,
    color: colors.mist,
  },
  rowMeta: {
    ...typeScale.caption,
    color: colors.lanternOff,
  },
});
