import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {MainStackParamList, RiskHistoryItem} from '@/types';
import {metricsApi} from '@/api/metrics';
import {useAppDispatch, useAppSelector} from '@/store';
import {setHomeData, setLoadingHome, setMoodScore} from '@/store/metricsSlice';
import {
  addCustomGoal,
  toggleCustomGoal,
  removeCustomGoal,
  pruneOldGoals,
} from '@/store/goalsSlice';
import {useMetricSync} from '@/hooks/useMetricSync';
import {RiskCard} from '@/components/RiskCard';
import {DailyGoalsCard} from '@/components/DailyGoalsCard';
import {PatternInsightCard} from '@/components/PatternInsightCard';
import {PatternInsight} from '@/api/metrics';
import {MetricCard} from '@/components/MetricCard';
import {MoodPicker} from '@/components/MoodPicker';
import {StressSourcePicker} from '@/components/StressSourcePicker';
import {StressSource} from '@/api/metrics';
import {Card} from '@/components/ui/Card';
import {Button} from '@/components/ui/Button';
import {Badge} from '@/components/ui/Badge';
import {
  CARD_VERTICAL_GAP,
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  PAGE_HORIZONTAL_PADDING,
  RISK_COLORS,
  SECTION_GAP,
  SPACING,
} from '@/utils/constants';
import {
  formatDate,
  formatSleepHours,
  formatSteps,
  formatMood,
  getGreeting,
  todayISODate,
} from '@/utils/formatters';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<NavProp>();
  const dispatch = useAppDispatch();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const {firstName} = useAppSelector(state => state.auth);
  const {todayMetrics, riskAssessment, interventions, riskHistory, dailyGoals, isLoadingHome, hasStaleQueueWarning} =
    useAppSelector(state => state.metrics);
  const customGoals = useAppSelector(state => state.goals.customGoals);

  const [moodPending, setMoodPending] = useState<number | null>(null);
  const [moodSaving, setMoodSaving] = useState(false);
  const [stressSource, setStressSource] = useState<StressSource | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [patternInsight, setPatternInsight] = useState<PatternInsight | null>(null);

  useMetricSync();

  const loadPatternInsight = useCallback(async () => {
    try {
      const res = await metricsApi.getPatternInsight();
      setPatternInsight(res.data.has_pattern ? res.data : null);
    } catch {
      // Non-critical — leave card hidden
    }
  }, []);

  const loadHomeData = useCallback(async () => {
    dispatch(setLoadingHome(true));
    try {
      const res = await metricsApi.getHomeData();
      dispatch(
        setHomeData({
          riskAssessment: res.data.risk_assessment,
          todayMetrics: res.data.today_metrics,
          suggestedIntervention: res.data.suggested_intervention,
          recentRiskHistory: res.data.recent_risk_history,
          dailyGoals: res.data.daily_goals ?? [],
        }),
      );
    } catch {
      dispatch(setLoadingHome(false));
    }
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      loadHomeData();
      loadPatternInsight();
      dispatch(pruneOldGoals(todayISODate()));
    }, [loadHomeData, loadPatternInsight, dispatch]),
  );

  function handleAddGoal(label: string) {
    dispatch(
      addCustomGoal({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        label,
        date: todayISODate(),
      }),
    );
  }

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([loadHomeData(), loadPatternInsight()]);
    setRefreshing(false);
  }

  async function handleStressSourceSave(source: StressSource) {
    setStressSource(source);
    try {
      await metricsApi.logStressSource(source, todayISODate());
    } catch {
      // Silent — stored optimistically
    }
  }

  async function handleMoodSave(score: number) {
    setMoodPending(score);
    setMoodSaving(true);
    try {
      await metricsApi.logMood(score, todayISODate());
      dispatch(setMoodScore(score));
    } catch {
      // Silent — mood stored optimistically
      dispatch(setMoodScore(score));
    } finally {
      setMoodSaving(false);
    }
  }

  const suggestedIntervention = interventions[0] ?? null;
  const recentHistory: RiskHistoryItem[] = riskHistory.slice(0, 3);
  const todayMood = moodPending ?? todayMetrics?.mood_score ?? null;
  const todayStressSource =
    stressSource ?? (todayMetrics?.stress_source as StressSource | null) ?? null;

  return (
    <ScrollView
      style={[styles.screen, {backgroundColor: colors.background}]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing || isLoadingHome}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }>
      {/* Stale queue banner */}
      {hasStaleQueueWarning && (
        <View
          style={[
            styles.banner,
            {backgroundColor: isDark ? '#431407' : '#fff7ed'},
          ]}>
          <Text style={[styles.bannerText, {color: colors.warning}]}>
            Some offline data was too old to sync and has been removed.
          </Text>
        </View>
      )}

      {/* 1. Header row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.greeting, {color: colors.textPrimary}]}>
            {getGreeting(firstName ?? 'there')}
          </Text>
          <Text style={[styles.dateText, {color: colors.textSecondary}]}>
            {formatDate(new Date().toISOString())}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('MainTabs')}
          style={styles.settingsBtn}
          accessibilityRole="button"
          accessibilityLabel="Settings">
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Today Risk Card */}
      <RiskCard
        riskLevel={riskAssessment?.risk_level ?? 'UNDEFINED'}
        riskScore={riskAssessment?.risk_score}
        lastUpdated={riskAssessment?.assessment_time}
      />

      {/* 3. Daily Goals */}
      <View style={{height: CARD_VERTICAL_GAP}} />
      <DailyGoalsCard
        healthGoals={dailyGoals}
        customGoals={customGoals}
        onAddGoal={handleAddGoal}
        onToggleGoal={id => dispatch(toggleCustomGoal(id))}
        onRemoveGoal={id => dispatch(removeCustomGoal(id))}
      />

      {/* 4. Pattern insight — shown only when active drift is detected */}
      {patternInsight && (
        <>
          <View style={{height: CARD_VERTICAL_GAP}} />
          <PatternInsightCard insight={patternInsight} />
        </>
      )}

      <View style={{height: CARD_VERTICAL_GAP}} />

      {/* 5. Sleep Card */}
      <MetricCard
        title="Sleep"
        value={formatSleepHours(todayMetrics?.sleep_hours ?? null)}
        icon="🌙"
        subtext={
          todayMetrics?.sleep_hours && todayMetrics.sleep_hours > 0
            ? 'Last night'
            : 'No sleep data yet'
        }
      />

      <View style={{height: CARD_VERTICAL_GAP}} />

      {/* 4. Activity Card */}
      <MetricCard
        title="Activity"
        value={formatSteps(todayMetrics?.steps ?? null)}
        unit={todayMetrics?.steps != null ? 'steps' : ''}
        icon="👟"
        subtext={
          todayMetrics?.steps != null
            ? 'Today'
            : 'No activity data yet'
        }
      />

      <View style={{height: CARD_VERTICAL_GAP}} />

      {/* 5. Mood Card */}
      <Card>
        <Text style={[styles.cardTitle, {color: colors.textSecondary}]}>
          Mood
        </Text>
        {todayMood != null ? (
          <View style={styles.moodDisplay}>
            <Text style={styles.moodEmoji}>{formatMood(todayMood)}</Text>
            <Text style={[styles.moodValue, {color: colors.textPrimary}]}>
              {todayMood}/5
            </Text>
          </View>
        ) : (
          <Text style={[styles.moodCta, {color: colors.textSecondary}]}>
            How are you feeling today?
          </Text>
        )}
        <MoodPicker
          value={todayMood}
          onChange={handleMoodSave}
          disabled={moodSaving}
        />
        {moodSaving && (
          <Text style={[styles.saving, {color: colors.textTertiary}]}>
            Saving…
          </Text>
        )}
        <Text
          style={[styles.stressLabel, {color: colors.textSecondary}]}>
          What's weighing on you?
        </Text>
        <StressSourcePicker
          value={todayStressSource}
          onChange={handleStressSourceSave}
        />
      </Card>

      <View style={{height: CARD_VERTICAL_GAP}} />

      {/* 6. Suggested Action Card */}
      <Card>
        <Text style={[styles.cardTitle, {color: colors.textSecondary}]}>
          Suggested Action
        </Text>
        {suggestedIntervention ? (
          <View>
            <Text style={[styles.interventionName, {color: colors.textPrimary}]}>
              {suggestedIntervention.name}
            </Text>
            {suggestedIntervention.suggested_reason ? (
              <Text
                style={[
                  styles.interventionReason,
                  {color: colors.textSecondary},
                ]}>
                {suggestedIntervention.suggested_reason}
              </Text>
            ) : null}
            <Button
              label="Open"
              onPress={() =>
                navigation.navigate('InterventionDetail', {
                  eventId: suggestedIntervention.event_id,
                })
              }
              variant="outline"
              style={styles.interventionBtn}
            />
          </View>
        ) : (
          <Text style={[styles.noAction, {color: colors.textSecondary}]}>
            No action is recommended right now.
          </Text>
        )}
      </Card>

      {/* 7. Recent Insights Preview */}
      {recentHistory.length > 0 && (
        <View style={styles.insightsSection}>
          <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>
            Recent Insights
          </Text>
          <View style={styles.chipsRow}>
            {recentHistory.map(item => (
              <View
                key={item.date}
                style={[
                  styles.chip,
                  {
                    backgroundColor: RISK_COLORS[item.risk_level] + '22',
                    borderColor: RISK_COLORS[item.risk_level],
                  },
                ]}>
                <View
                  style={[
                    styles.chipDot,
                    {backgroundColor: RISK_COLORS[item.risk_level]},
                  ]}
                />
                <Text style={[styles.chipText, {color: colors.textPrimary}]}>
                  {item.date?.slice(5) ?? ''} {/* MM-DD */}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={{height: 20}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  content: {
    padding: PAGE_HORIZONTAL_PADDING,
    paddingTop: 56,
    paddingBottom: 32,
  },
  banner: {
    borderRadius: 10,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  bannerText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SECTION_GAP,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    marginBottom: 2,
  },
  dateText: {
    fontSize: FONT_SIZE.sm,
  },
  settingsBtn: {
    padding: SPACING.xs,
  },
  settingsIcon: {
    fontSize: 22,
  },
  cardTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  moodDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  moodEmoji: {
    fontSize: 28,
  },
  moodValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
  },
  moodCta: {
    fontSize: FONT_SIZE.sm,
    marginBottom: SPACING.sm,
  },
  saving: {
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  stressLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  interventionName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  interventionReason: {
    fontSize: FONT_SIZE.sm,
    lineHeight: FONT_SIZE.sm * 1.4,
    marginBottom: SPACING.sm,
  },
  interventionBtn: {
    marginTop: SPACING.xs,
  },
  noAction: {
    fontSize: FONT_SIZE.sm,
    lineHeight: FONT_SIZE.sm * 1.4,
  },
  insightsSection: {
    marginTop: SECTION_GAP,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '500',
  },
});
