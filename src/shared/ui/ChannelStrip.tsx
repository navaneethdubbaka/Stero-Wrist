import { StyleSheet, Text, View } from 'react-native';
import { colors, space, type as typeScale } from '../theme/tokens';

export type LanternState = 'ready' | 'pending' | 'error' | 'off';

export type ChannelSegment = {
  id: string;
  label: string;
  state: LanternState;
};

const lanternColor: Record<LanternState, string> = {
  ready: colors.lanternReady,
  pending: colors.lanternPending,
  error: colors.lanternError,
  off: colors.lanternOff,
};

type Props = {
  segments: ChannelSegment[];
};

export function ChannelStrip({ segments }: Props) {
  return (
    <View style={styles.rail} accessibilityRole="summary">
      {segments.map((segment, index) => (
        <View
          key={segment.id}
          style={[
            styles.cell,
            index === 0 && styles.cellFirst,
            index === segments.length - 1 && styles.cellLast,
          ]}
          accessibilityLabel={`${segment.label}: ${segment.state}`}
        >
          <View
            style={[styles.lantern, { backgroundColor: lanternColor[segment.state] }]}
          />
          <Text style={styles.label}>{segment.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: 'row',
    backgroundColor: colors.brandBand,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.outline,
  },
  cell: {
    flex: 1,
    minHeight: 56,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.outline,
  },
  cellFirst: {
    borderLeftWidth: 0,
  },
  cellLast: {},
  lantern: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    ...typeScale.caption,
    color: colors.foam,
    textAlign: 'center',
  },
});
