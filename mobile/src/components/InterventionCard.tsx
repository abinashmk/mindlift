import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import {Card} from './ui/Card';
import {InterventionStatusBadge} from './ui/Badge';
import {InterventionEvent} from '@/types';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  SPACING,
} from '@/utils/constants';
import {formatDuration} from '@/utils/formatters';

interface InterventionCardProps {
  intervention: InterventionEvent;
  onPress: () => void;
}

export function InterventionCard({intervention, onPress}: InterventionCardProps) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Open intervention: ${intervention.name}`}>
      <Card style={styles.card}>
        <View style={styles.topRow}>
          <Text
            style={[styles.name, {color: colors.textPrimary}]}
            numberOfLines={1}>
            {intervention.name}
          </Text>
          <Text style={[styles.duration, {color: colors.textTertiary}]}>
            {formatDuration(intervention.duration_minutes)}
          </Text>
        </View>
        {intervention.suggested_reason ? (
          <Text
            style={[styles.reason, {color: colors.textSecondary}]}
            numberOfLines={2}>
            {intervention.suggested_reason}
          </Text>
        ) : null}
        <View style={styles.badgeRow}>
          <InterventionStatusBadge status={intervention.status} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: SPACING.xs,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    flex: 1,
    marginRight: SPACING.sm,
  },
  duration: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
  },
  reason: {
    fontSize: FONT_SIZE.sm,
    lineHeight: FONT_SIZE.sm * 1.4,
  },
  badgeRow: {
    marginTop: 4,
  },
});
