import React, {useCallback, useRef, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useAppDispatch, useAppSelector} from '@/store';
import {addCustomGoal, toggleCustomGoal, removeCustomGoal, pruneOldGoals} from '@/store/goalsSlice';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  PAGE_HORIZONTAL_PADDING,
  SPACING,
  CARD_VERTICAL_GAP,
} from '@/utils/constants';
import {todayISODate} from '@/utils/formatters';
import {Card} from '@/components/ui/Card';

const GOAL_ICONS: Record<string, string> = {
  sleep: '🌙',
  steps: '👟',
  mood: '😊',
  stress: '🧠',
};

export function GoalsScreen() {
  const dispatch = useAppDispatch();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const autoGoals = useAppSelector(state => state.metrics.dailyGoals);
  const customGoals = useAppSelector(state =>
    state.goals.customGoals.filter(g => g.date === todayISODate()),
  );

  const [inputText, setInputText] = useState('');
  const inputRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      dispatch(pruneOldGoals(todayISODate()));
    }, [dispatch]),
  );

  const allDone = [...autoGoals, ...customGoals].filter(g => g.done).length;
  const allTotal = autoGoals.length + customGoals.length;
  const progress = allTotal > 0 ? allDone / allTotal : 0;

  function handleAddGoal() {
    const label = inputText.trim();
    if (!label) return;
    dispatch(addCustomGoal({id: `${Date.now()}-${Math.random()}`, label, date: todayISODate()}));
    setInputText('');
    inputRef.current?.blur();
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, {backgroundColor: colors.background}]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">

        {/* Header */}
        <Text style={[styles.pageTitle, {color: colors.textPrimary}]}>
          Today's Goals
        </Text>
        <Text style={[styles.pageSubtitle, {color: colors.textSecondary}]}>
          Your daily recovery checklist
        </Text>

        {/* Progress ring area */}
        <Card style={styles.progressCard}>
          <View style={styles.progressRow}>
            <View style={styles.ringContainer}>
              <ProgressRing progress={progress} color={progress === 1 ? colors.success : colors.primary} />
            </View>
            <View style={styles.progressText}>
              <Text style={[styles.progressCount, {color: colors.textPrimary}]}>
                {allDone} / {allTotal}
              </Text>
              <Text style={[styles.progressLabel, {color: colors.textSecondary}]}>
                {progress === 1
                  ? 'All done — great recovery day!'
                  : allDone === 0
                  ? 'Get started on your goals'
                  : `${allTotal - allDone} goal${allTotal - allDone !== 1 ? 's' : ''} remaining`}
              </Text>
            </View>
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
        </Card>

        <View style={{height: CARD_VERTICAL_GAP}} />

        {/* Auto goals from health data */}
        <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>
          Recovery Targets
        </Text>
        <Card>
          {autoGoals.length === 0 ? (
            <Text style={[styles.emptyText, {color: colors.textTertiary}]}>
              Loading your data…
            </Text>
          ) : (
            <View style={styles.goalList}>
              {autoGoals.map((goal, idx) => (
                <View key={goal.key}>
                  {idx > 0 && (
                    <View style={[styles.divider, {backgroundColor: colors.border}]} />
                  )}
                  <View style={styles.goalRow}>
                    <View
                      style={[
                        styles.checkbox,
                        {
                          backgroundColor: goal.done ? colors.success : 'transparent',
                          borderColor: goal.done ? colors.success : colors.border,
                        },
                      ]}>
                      {goal.done && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.goalIcon}>{GOAL_ICONS[goal.key] ?? '•'}</Text>
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
                </View>
              ))}
            </View>
          )}
        </Card>

        <View style={{height: CARD_VERTICAL_GAP}} />

        {/* Custom goals */}
        <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>
          My Goals
        </Text>

        {customGoals.length > 0 && (
          <>
            <Card>
              <View style={styles.goalList}>
                {customGoals.map((goal, idx) => (
                  <View key={goal.id}>
                    {idx > 0 && (
                      <View style={[styles.divider, {backgroundColor: colors.border}]} />
                    )}
                    <View style={styles.goalRow}>
                      <TouchableOpacity
                        onPress={() => dispatch(toggleCustomGoal(goal.id))}
                        style={[
                          styles.checkbox,
                          {
                            backgroundColor: goal.done ? colors.success : 'transparent',
                            borderColor: goal.done ? colors.success : colors.border,
                          },
                        ]}
                        accessibilityRole="checkbox"
                        accessibilityState={{checked: goal.done}}>
                        {goal.done && <Text style={styles.checkmark}>✓</Text>}
                      </TouchableOpacity>
                      <Text style={styles.goalIcon}>🎯</Text>
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
                      </View>
                      <TouchableOpacity
                        onPress={() => dispatch(removeCustomGoal(goal.id))}
                        style={styles.removeBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Remove goal">
                        <Text style={[styles.removeText, {color: colors.textTertiary}]}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </Card>
            <View style={{height: CARD_VERTICAL_GAP}} />
          </>
        )}

        {/* Add custom goal input */}
        <Card>
          <Text style={[styles.addTitle, {color: colors.textSecondary}]}>
            Add a goal for today
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceSecondary,
                  color: colors.textPrimary,
                  borderColor: colors.border,
                },
              ]}
              placeholder="e.g. Take a 10-min walk outside"
              placeholderTextColor={colors.textTertiary}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleAddGoal}
              returnKeyType="done"
              maxLength={80}
            />
            <TouchableOpacity
              style={[
                styles.addBtn,
                {
                  backgroundColor:
                    inputText.trim() ? colors.primary : colors.surfaceSecondary,
                },
              ]}
              onPress={handleAddGoal}
              disabled={!inputText.trim()}
              accessibilityRole="button"
              accessibilityLabel="Add goal">
              <Text
                style={[
                  styles.addBtnText,
                  {color: inputText.trim() ? '#fff' : colors.textTertiary},
                ]}>
                Add
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        <View style={{height: 32}} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Progress ring: two-half-circle rotation technique
function ProgressRing({progress, color}: {progress: number; color: string}) {
  const SIZE = 80;
  const STROKE = 7;
  const pct = Math.min(Math.max(progress, 0), 1);
  const deg = pct * 360;

  // Right half always visible; left half shown once > 50%
  const rightDeg = Math.min(deg, 180);
  const leftDeg  = Math.max(deg - 180, 0);

  return (
    <View style={{width: SIZE, height: SIZE}}>
      {/* Track */}
      <View style={[StyleSheet.absoluteFill, {
        borderRadius: SIZE / 2,
        borderWidth: STROKE,
        borderColor: color + '22',
      }]} />

      {/* Right half */}
      <View style={{
        position: 'absolute', width: SIZE / 2, height: SIZE,
        left: SIZE / 2, overflow: 'hidden',
      }}>
        <View style={{
          width: SIZE, height: SIZE, borderRadius: SIZE / 2,
          borderWidth: STROKE, borderColor: 'transparent',
          borderRightColor: color, borderTopColor: rightDeg > 90 ? color : 'transparent',
          transform: [{rotate: `${rightDeg - 90}deg`}],
          left: -SIZE / 2,
        }} />
      </View>

      {/* Left half — only shown once past 50% */}
      {deg > 180 && (
        <View style={{
          position: 'absolute', width: SIZE / 2, height: SIZE,
          left: 0, overflow: 'hidden',
        }}>
          <View style={{
            width: SIZE, height: SIZE, borderRadius: SIZE / 2,
            borderWidth: STROKE, borderColor: 'transparent',
            borderLeftColor: color, borderBottomColor: leftDeg > 90 ? color : 'transparent',
            transform: [{rotate: `${leftDeg - 90}deg`}],
          }} />
        </View>
      )}

      {/* Center label */}
      <View style={[StyleSheet.absoluteFill, {alignItems: 'center', justifyContent: 'center'}]}>
        <Text style={[styles.ringPct, {color}]}>{Math.round(pct * 100)}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  content: {
    padding: PAGE_HORIZONTAL_PADDING,
    paddingTop: 56,
    paddingBottom: 32,
  },
  pageTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: FONT_SIZE.sm,
    marginBottom: 24,
  },
  progressCard: {},
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
    marginBottom: SPACING.md,
  },
  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPct: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  progressText: {flex: 1},
  progressCount: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: FONT_SIZE.sm,
    lineHeight: FONT_SIZE.sm * 1.4,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  goalList: {gap: 0},
  divider: {height: StyleSheet.hairlineWidth, marginVertical: SPACING.sm},
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
    lineHeight: 14,
  },
  goalIcon: {
    fontSize: 16,
    width: 22,
    textAlign: 'center',
  },
  goalText: {flex: 1},
  goalLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
  },
  goalDetail: {
    fontSize: FONT_SIZE.xs,
    marginTop: 1,
  },
  removeBtn: {
    padding: SPACING.xs,
  },
  removeText: {
    fontSize: FONT_SIZE.sm,
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
  addTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    fontSize: FONT_SIZE.sm,
  },
  addBtn: {
    height: 44,
    paddingHorizontal: SPACING.lg,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
});
