import React, {useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  TextInput,
  Keyboard,
} from 'react-native';
import {DailyGoal} from '@/types';
import {CustomGoal} from '@/store/goalsSlice';
import {Card} from '@/components/ui/Card';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  SPACING,
} from '@/utils/constants';

interface Props {
  healthGoals: DailyGoal[];
  customGoals: CustomGoal[];
  onAddGoal: (label: string) => void;
  onToggleGoal: (id: string) => void;
  onRemoveGoal: (id: string) => void;
}

const HEALTH_GOAL_ICONS: Record<string, string> = {
  sleep: '🌙',
  steps: '👟',
  mood: '😊',
  stress: '🧠',
};

export function DailyGoalsCard({
  healthGoals,
  customGoals,
  onAddGoal,
  onToggleGoal,
  onRemoveGoal,
}: Props) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const [inputVisible, setInputVisible] = useState(false);
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const healthDone = healthGoals.filter(g => g.done).length;
  const customDone = customGoals.filter(g => g.done).length;
  const totalDone = healthDone + customDone;
  const total = healthGoals.length + customGoals.length;
  const progress = total > 0 ? totalDone / total : 0;

  function handleShowInput() {
    setInputVisible(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleSubmit() {
    const label = inputText.trim();
    if (label) {
      onAddGoal(label);
    }
    setInputText('');
    setInputVisible(false);
    Keyboard.dismiss();
  }

  function handleCancel() {
    setInputText('');
    setInputVisible(false);
    Keyboard.dismiss();
  }

  return (
    <Card>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, {color: colors.textSecondary}]}>
          Today's Goals
        </Text>
        <Text style={[styles.count, {color: colors.primary}]}>
          {totalDone}/{total}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.barTrack, {backgroundColor: colors.surfaceSecondary}]}>
        <View
          style={[
            styles.barFill,
            {
              width: `${progress * 100}%` as any,
              backgroundColor: progress === 1 ? colors.success : colors.primary,
            },
          ]}
        />
      </View>

      {/* Health goals */}
      <View style={styles.goalList}>
        {healthGoals.map(goal => (
          <View key={goal.key} style={styles.goalRow}>
            <Checkbox done={goal.done} color={colors.success} border={colors.border} />
            <Text style={styles.goalIcon}>{HEALTH_GOAL_ICONS[goal.key] ?? '•'}</Text>
            <View style={styles.goalText}>
              <Text
                style={[
                  styles.goalLabel,
                  {
                    color: goal.done ? colors.textTertiary : colors.textPrimary,
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

      {/* Divider if there are custom goals */}
      {customGoals.length > 0 && (
        <View style={[styles.divider, {backgroundColor: colors.border}]} />
      )}

      {/* Custom goals */}
      {customGoals.length > 0 && (
        <View style={styles.goalList}>
          {customGoals.map(goal => (
            <View key={goal.id} style={styles.goalRow}>
              <TouchableOpacity
                onPress={() => onToggleGoal(goal.id)}
                accessibilityRole="checkbox"
                accessibilityLabel={goal.label}>
                <Checkbox
                  done={goal.done}
                  color={colors.primary}
                  border={colors.border}
                />
              </TouchableOpacity>
              <Text style={styles.goalIcon}>•</Text>
              <TouchableOpacity
                style={styles.goalText}
                onPress={() => onToggleGoal(goal.id)}
                accessibilityRole="button">
                <Text
                  style={[
                    styles.goalLabel,
                    {
                      color: goal.done ? colors.textTertiary : colors.textPrimary,
                      textDecorationLine: goal.done ? 'line-through' : 'none',
                    },
                  ]}>
                  {goal.label}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onRemoveGoal(goal.id)}
                style={styles.deleteBtn}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                accessibilityRole="button"
                accessibilityLabel="Remove goal">
                <Text style={[styles.deleteIcon, {color: colors.textTertiary}]}>
                  ×
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Add goal input */}
      {inputVisible ? (
        <View style={[styles.inputRow, {borderTopColor: colors.border}]}>
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                color: colors.textPrimary,
                backgroundColor: colors.surfaceSecondary,
              },
            ]}
            placeholder="What do you want to achieve today?"
            placeholderTextColor={colors.textTertiary}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
            maxLength={120}
            autoCorrect
          />
          <View style={styles.inputActions}>
            <TouchableOpacity
              onPress={handleCancel}
              style={[styles.inputBtn, {backgroundColor: colors.surfaceSecondary}]}>
              <Text style={[styles.inputBtnText, {color: colors.textSecondary}]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!inputText.trim()}
              style={[
                styles.inputBtn,
                {
                  backgroundColor: inputText.trim()
                    ? colors.primary
                    : colors.surfaceSecondary,
                },
              ]}>
              <Text
                style={[
                  styles.inputBtnText,
                  {
                    color: inputText.trim() ? '#fff' : colors.textTertiary,
                  },
                ]}>
                Add
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          onPress={handleShowInput}
          style={[styles.addRow, {borderTopColor: colors.border}]}
          accessibilityRole="button"
          accessibilityLabel="Add a goal">
          <Text style={[styles.addPlus, {color: colors.primary}]}>+</Text>
          <Text style={[styles.addLabel, {color: colors.primary}]}>
            Add a goal
          </Text>
        </TouchableOpacity>
      )}
    </Card>
  );
}

function Checkbox({
  done,
  color,
  border,
}: {
  done: boolean;
  color: string;
  border: string;
}) {
  return (
    <View
      style={[
        styles.checkbox,
        {
          backgroundColor: done ? color : 'transparent',
          borderColor: done ? color : border,
        },
      ]}>
      {done && <Text style={styles.checkmark}>✓</Text>}
    </View>
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
  deleteBtn: {
    paddingHorizontal: 4,
  },
  deleteIcon: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '400',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: SPACING.md,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addPlus: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '400',
    lineHeight: FONT_SIZE.lg,
  },
  addLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
  },
  inputRow: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: SPACING.sm,
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: FONT_SIZE.sm,
  },
  inputActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'flex-end',
  },
  inputBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  inputBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
});
