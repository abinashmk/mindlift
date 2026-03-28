import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import {StressSource} from '@/api/metrics';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  SPACING,
  STRESS_SOURCE_LABELS,
} from '@/utils/constants';

interface StressSourcePickerProps {
  value: StressSource | null;
  onChange: (source: StressSource) => void;
  disabled?: boolean;
}

const SOURCES: StressSource[] = [
  'workload',
  'deadlines',
  'career',
  'finances',
  'relationships',
  'other',
];

export function StressSourcePicker({
  value,
  onChange,
  disabled = false,
}: StressSourcePickerProps) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  return (
    <View style={styles.container}>
      {SOURCES.map(source => {
        const isSelected = value === source;
        return (
          <TouchableOpacity
            key={source}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected
                  ? colors.primaryLight
                  : colors.surfaceSecondary,
                borderColor: isSelected ? colors.primary : colors.border,
              },
            ]}
            onPress={() => !disabled && onChange(source)}
            activeOpacity={0.7}
            accessibilityRole="radio"
            accessibilityLabel={STRESS_SOURCE_LABELS[source]}
            accessibilityState={{selected: isSelected, disabled}}>
            <Text
              style={[
                styles.label,
                {
                  color: isSelected ? colors.primary : colors.textSecondary,
                  fontWeight: isSelected ? '600' : '400',
                },
              ]}>
              {STRESS_SOURCE_LABELS[source]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    borderWidth: 1,
  },
  label: {
    fontSize: FONT_SIZE.sm,
  },
});
