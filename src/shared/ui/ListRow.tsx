import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space, touch, type as typeScale } from '../theme/tokens';

type Props = {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: string;
  danger?: boolean;
};

export function ListRow({ title, subtitle, onPress, trailing, danger }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && onPress ? styles.pressed : null,
      ]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={styles.textBlock}>
        <Text style={[styles.title, danger && styles.danger]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing ? <Text style={styles.trailing}>{trailing}</Text> : null}
      {onPress ? <Text style={styles.chevron}>›</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: touch.min,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  pressed: {
    backgroundColor: colors.surfaceRaised,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typeScale.body,
    color: colors.foam,
    fontWeight: '600',
  },
  subtitle: {
    ...typeScale.caption,
    color: colors.mist,
  },
  trailing: {
    ...typeScale.caption,
    color: colors.mist,
  },
  chevron: {
    color: colors.mist,
    fontSize: 22,
    lineHeight: 24,
  },
  danger: {
    color: colors.danger,
  },
});
