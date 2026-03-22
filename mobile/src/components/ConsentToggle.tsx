import React from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  SPACING,
} from '@/utils/constants';

interface ConsentToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  required?: boolean;
  disabled?: boolean;
}

export function ConsentToggle({
  label,
  description,
  value,
  onChange,
  required = false,
  disabled = false,
}: ConsentToggleProps) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  return (
    <View
      style={[
        styles.container,
        {borderBottomColor: colors.border},
      ]}>
      <View style={styles.textBlock}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, {color: colors.textPrimary}]}>
            {label}
          </Text>
          {required && (
            <View
              style={[
                styles.requiredBadge,
                {backgroundColor: colors.primaryLight},
              ]}>
              <Text style={[styles.requiredText, {color: colors.primary}]}>
                Required
              </Text>
            </View>
          )}
        </View>
        {description ? (
          <Text style={[styles.description, {color: colors.textSecondary}]}>
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled || required}
        trackColor={{false: colors.border, true: colors.primary}}
        thumbColor="#ffffff"
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{checked: value, disabled: disabled || required}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: SPACING.md,
  },
  textBlock: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  label: {
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },
  description: {
    fontSize: FONT_SIZE.sm,
    lineHeight: FONT_SIZE.sm * 1.4,
    marginTop: 3,
  },
  requiredBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  requiredText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
});
