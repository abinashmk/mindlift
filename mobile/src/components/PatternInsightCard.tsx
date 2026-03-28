import React from 'react';
import {View, Text, StyleSheet, useColorScheme} from 'react-native';

import {PatternInsight, PatternSignal} from '@/api/metrics';
import {Card} from '@/components/ui/Card';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  SPACING,
} from '@/utils/constants';

interface Props {
  insight: PatternInsight;
}

export function PatternInsightCard({insight}: Props) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  if (!insight.has_pattern) return null;

  return (
    <Card>
      {/* Header */}
      <Text style={[styles.label, {color: colors.textTertiary}]}>
        PATTERN INSIGHT
      </Text>
      <Text style={[styles.headline, {color: colors.textPrimary}]}>
        {insight.headline}
      </Text>

      {/* Signal chips */}
      <View style={styles.chipsRow}>
        {insight.signals.map(signal => (
          <SignalChip key={`${signal.metric_key}:${signal.direction}`} signal={signal} />
        ))}
      </View>

      {/* Explanation */}
      <Text style={[styles.explanation, {color: colors.textSecondary}]}>
        {insight.explanation}
      </Text>

      <Text style={[styles.footnote, {color: colors.textTertiary}]}>
        Based on your last 3 days vs. your personal baseline
      </Text>
    </Card>
  );
}

function SignalChip({signal}: {signal: PatternSignal}) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const isDecline = signal.direction === 'decline';
  const chipColor = isDecline ? colors.warning : colors.success;
  const chipBg = isDecline
    ? isDark ? '#431407' : '#fff7ed'
    : isDark ? colors.successLight : '#f0fdf4';

  const arrow = isDecline ? '↓' : '↑';
  const sign = isDecline ? '' : '+';
  const deltaPct = `${sign}${signal.delta_pct.toFixed(0)}%`;

  return (
    <View style={[styles.chip, {backgroundColor: chipBg, borderColor: chipColor + '55'}]}>
      <Text style={[styles.chipArrow, {color: chipColor}]}>{arrow}</Text>
      <Text style={[styles.chipLabel, {color: chipColor}]}>
        {signal.label}
      </Text>
      <Text style={[styles.chipDelta, {color: chipColor}]}>{deltaPct}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: SPACING.xs,
  },
  headline: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    lineHeight: FONT_SIZE.md * 1.35,
    marginBottom: SPACING.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipArrow: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  chipLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  chipDelta: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '500',
  },
  explanation: {
    fontSize: FONT_SIZE.sm,
    lineHeight: FONT_SIZE.sm * 1.55,
    marginBottom: SPACING.sm,
  },
  footnote: {
    fontSize: FONT_SIZE.xs,
    fontStyle: 'italic',
  },
});
