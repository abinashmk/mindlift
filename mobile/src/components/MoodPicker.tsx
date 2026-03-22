import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  MIN_TAPPABLE,
  MOOD_EMOJIS,
  SPACING,
} from '@/utils/constants';

interface MoodPickerProps {
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const MOOD_LABELS: Record<number, string> = {
  1: 'Bad',
  2: 'Low',
  3: 'Okay',
  4: 'Good',
  5: 'Great',
};

export function MoodPicker({value, onChange, disabled = false}: MoodPickerProps) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map(score => {
        const isSelected = value === score;
        return (
          <TouchableOpacity
            key={score}
            style={[
              styles.option,
              {
                backgroundColor: isSelected
                  ? colors.primaryLight
                  : colors.surfaceSecondary,
                borderColor: isSelected ? colors.primary : 'transparent',
                borderWidth: isSelected ? 2 : 0,
              },
            ]}
            onPress={() => !disabled && onChange(score)}
            activeOpacity={0.7}
            accessibilityRole="radio"
            accessibilityLabel={`Mood ${score}: ${MOOD_LABELS[score]}`}
            accessibilityState={{selected: isSelected, disabled}}>
            <Text style={styles.emoji}>{MOOD_EMOJIS[score]}</Text>
            <Text
              style={[
                styles.label,
                {
                  color: isSelected ? colors.primary : colors.textSecondary,
                  fontWeight: isSelected ? '600' : '400',
                },
              ]}>
              {MOOD_LABELS[score]}
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
    justifyContent: 'space-between',
    gap: SPACING.xs,
  },
  option: {
    flex: 1,
    minHeight: MIN_TAPPABLE,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emoji: {
    fontSize: 22,
  },
  label: {
    fontSize: FONT_SIZE.xs,
  },
});
