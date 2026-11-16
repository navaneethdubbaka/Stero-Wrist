import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../shared/ui/Screen';
import { colors, space, touch, type as typeScale } from '../../shared/theme/tokens';
import { sttEngineLabel } from '../settings/SttSettingsScreen';
import type { SttEngineId } from '../../shared/types/settings';
import {
  clearTranscriptHistory,
  listTranscriptHistory,
  subscribeTranscriptHistory,
  type TranscriptRecord,
} from './transcriptHistory';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function engineName(id: string): string {
  return sttEngineLabel(id as SttEngineId);
}

export function TranscriptHistoryScreen() {
  const [rows, setRows] = useState<TranscriptRecord[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const reload = useCallback(() => {
    setRows(listTranscriptHistory());
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
      return subscribeTranscriptHistory(reload);
    }, [reload]),
  );

  const empty = rows.length === 0;
  const data = useMemo(() => rows, [rows]);

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Transcript history</Text>
        <Pressable
          onPress={() => {
            if (empty) return;
            Alert.alert(
              'Clear history',
              'Delete all saved transcripts on this phone?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Clear',
                  style: 'destructive',
                  onPress: () => {
                    clearTranscriptHistory();
                    reload();
                  },
                },
              ],
            );
          }}
          disabled={empty}
          accessibilityRole="button"
        >
          <Text style={[styles.clear, empty && styles.clearOff]}>Clear</Text>
        </Pressable>
      </View>
      {empty ? (
        <Text style={styles.placeholder}>
          Hang up a Talk and the transcribed text will land here.
        </Text>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const open = openId === item.id;
            return (
              <Pressable
                style={styles.card}
                onPress={() => setOpenId(open ? null : item.id)}
              >
                <Text style={styles.meta}>
                  {formatWhen(item.createdAt)} · {engineName(item.engine)}
                </Text>
                <Text style={styles.text} numberOfLines={open ? undefined : 3}>
                  {item.text}
                </Text>
                {item.reply ? (
                  <Text style={styles.reply} numberOfLines={open ? undefined : 2}>
                    Hermes: {item.reply}
                  </Text>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  title: {
    ...typeScale.title,
    color: colors.foam,
  },
  clear: {
    ...typeScale.label,
    color: colors.lanternPending,
    minHeight: touch.min,
    textAlignVertical: 'center',
  },
  clearOff: {
    color: colors.lanternOff,
  },
  placeholder: {
    ...typeScale.body,
    color: colors.mist,
  },
  list: {
    gap: space.sm,
    paddingBottom: space.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: space.md,
    gap: 6,
  },
  meta: {
    ...typeScale.caption,
    color: colors.mist,
  },
  text: {
    ...typeScale.body,
    color: colors.foam,
  },
  reply: {
    ...typeScale.caption,
    color: colors.lanternReady,
  },
});
