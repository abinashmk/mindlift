import React from 'react';
import {View, Text, StyleSheet, useColorScheme} from 'react-native';
import {Card} from './ui/Card';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  SPACING,
} from '@/utils/constants';

interface MetricCardProps {
  title: string;
  value: string;
  unit?: string;
  subtext?: string;
  icon?: string;
}

export function MetricCard({
  title,
  value,
  unit,
  subtext,
  icon,
}: MetricCardProps) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  return (
    <Card>
      <View style={styles.header}>
        {icon ? (
          <Text style={styles.icon}>{icon}</Text>
        ) : null}
        <Text style={[styles.title, {color: colors.textSecondary}]}>
          {title}
        </Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, {color: colors.textPrimary}]}>
          {value}
        </Text>
        {unit ? (
          <Text style={[styles.unit, {color: colors.textSecondary}]}>
            {' '}{unit}
          </Text>
        ) : null}
      </View>
      {subtext ? (
        <Text style={[styles.subtext, {color: colors.textTertiary}]}>
          {subtext}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  icon: {
    fontSize: FONT_SIZE.md,
  },
  title: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
  },
  unit: {
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },
  subtext: {
    fontSize: FONT_SIZE.xs,
    marginTop: 4,
    lineHeight: FONT_SIZE.xs * 1.4,
  },
});
