import React from 'react';
import {View, Text, StyleSheet, useColorScheme} from 'react-native';
import {Card} from './ui/Card';
import {RiskLevel} from '@/types';
import {
  RISK_COLORS,
  RISK_EXPLANATIONS,
  COLORS_LIGHT,
  COLORS_DARK,
  FONT_SIZE,
  SPACING,
} from '@/utils/constants';
import {capitalize, formatTime} from '@/utils/formatters';

interface RiskCardProps {
  riskLevel: RiskLevel;
  lastUpdated?: string;
  riskScore?: number;
}

export function RiskCard({riskLevel, lastUpdated, riskScore}: RiskCardProps) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;
  const circleColor = RISK_COLORS[riskLevel];
  const explanation = RISK_EXPLANATIONS[riskLevel];

  return (
    <Card style={styles.card}>
      <Text style={[styles.title, {color: colors.textSecondary}]}>
        Burnout Load
      </Text>
      <View style={styles.row}>
        <View
          style={[styles.circle, {backgroundColor: circleColor}]}
          accessibilityLabel={`Risk level: ${riskLevel}`}
        />
        <View style={styles.textBlock}>
          <Text style={[styles.levelText, {color: colors.textPrimary}]}>
            {capitalize(riskLevel)}
            {riskScore != null && riskLevel !== 'UNDEFINED'
              ? ` · ${Math.round(riskScore * 100)}%`
              : ''}
          </Text>
          <Text style={[styles.explanation, {color: colors.textSecondary}]}>
            {explanation}
          </Text>
        </View>
      </View>
      {lastUpdated ? (
        <Text style={[styles.updated, {color: colors.textTertiary}]}>
          Updated {formatTime(lastUpdated)}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {},
  title: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginTop: 2,
  },
  textBlock: {
    flex: 1,
  },
  levelText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    marginBottom: 4,
  },
  explanation: {
    fontSize: FONT_SIZE.sm,
    lineHeight: FONT_SIZE.sm * 1.4,
  },
  updated: {
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.sm,
  },
});
