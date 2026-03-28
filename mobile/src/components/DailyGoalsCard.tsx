import React from 'react';
import {View, Text, StyleSheet, useColorScheme} from 'react-native';
import {DailyGoal} from '@/types';
import {Card} from '@/components/ui/Card';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  SPACING,
} from '@/utils/constants';

interface Props {
  goals: DailyGoal[];
}

const GOAL_ICONS: Record<string, string> = {
  sleep: '🌙',
  steps: '👟',
  mood: '😊',
  stress: '🧠',
};

export function DailyGoalsCard({goals}: Props) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const doneCount = goals.filter(g => g.done).length;
  const total = goals.length;
  const progress = total > 0 ? doneCount / total : 0;

  return (
    <Card>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, {color: colors.textSecondary}]}>
          Today's Recovery Goals
        </Text>
        <Text style={[styles.count, {color: colors.primary}]}>
          {doneCount}/{total}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.barTrack, {backgroundColor: colors.surfaceSecondary}]}>
        <View
          style={[
            styles.barFill,
            {
              width: `${progress * 100}%` as any,
              backgroundColor:
                progress === 1 ? colors.success : colors.primary,
            },
          ]}
        />
      </View>

      {/* Goal rows */}
      <View style={styles.goalList}>
        {goals.map(goal => (
          <View key={goal.key} style={styles.goalRow}>
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: goal.done
                    ? colors.success
                    : 'transparent',
                  borderColor: goal.done ? colors.success : colors.border,
                },
              ]}>
              {goal.done && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </View>
            <Text style={styles.goalIcon}>{GOAL_ICONS[goal.key] ?? '•'}</Text>
            <View style={styles.goalText}>
              <Text
                style={[
                  styles.goalLabel,
                  {
                    color: goal.done
                      ? colors.textTertiary
                      : colors.textPrimary,
                    textDecorationLine: goal.done ? 'line-through' : 'none',
                  },
                ]}>
                {goal.label}
              </Text>
              <Text style={[styles.goalDetail, {color: colors.textTertiary}]}>
                {goal.detail}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  count: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  goalList: {
    gap: SPACING.sm,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
    lineHeight: 13,
  },
  goalIcon: {
    fontSize: 16,
    width: 20,
    textAlign: 'center',
  },
  goalText: {
    flex: 1,
  },
  goalLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
  },
  goalDetail: {
    fontSize: FONT_SIZE.xs,
    marginTop: 1,
  },
});
