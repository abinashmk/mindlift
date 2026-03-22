import React from 'react';
import {View, Text, StyleSheet, useColorScheme} from 'react-native';
import {BORDER_RADIUS, COLORS_DARK, COLORS_LIGHT, FONT_SIZE, SPACING} from '@/utils/constants';
import {InterventionStatus} from '@/types';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'neutral';
}

const STATUS_VARIANT: Record<InterventionStatus, BadgeProps['variant']> = {
  TRIGGERED: 'warning',
  VIEWED: 'default',
  COMPLETED: 'success',
  DISMISSED: 'neutral',
  EXPIRED: 'neutral',
};

export function Badge({label, variant = 'default'}: BadgeProps) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const bg: Record<NonNullable<BadgeProps['variant']>, string> = {
    default: colors.primaryLight,
    success: colors.successLight,
    warning: isDark ? '#431407' : '#fff7ed',
    danger: colors.dangerLight,
    neutral: colors.surfaceSecondary,
  };

  const fg: Record<NonNullable<BadgeProps['variant']>, string> = {
    default: colors.primary,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    neutral: colors.textSecondary,
  };

  return (
    <View style={[styles.badge, {backgroundColor: bg[variant ?? 'default']}]}>
      <Text style={[styles.text, {color: fg[variant ?? 'default']}]}>
        {label}
      </Text>
    </View>
  );
}

export function InterventionStatusBadge({status}: {status: InterventionStatus}) {
  return (
    <Badge
      label={status.charAt(0) + status.slice(1).toLowerCase()}
      variant={STATUS_VARIANT[status]}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
});
