import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
  RefreshControl,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';

import {metricsApi} from '@/api/metrics';
import {useAppDispatch, useAppSelector} from '@/store';
import {setRiskHistory} from '@/store/metricsSlice';
import {RiskHistoryItem} from '@/types';
import {Card} from '@/components/ui/Card';
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
import {formatDateShort} from '@/utils/formatters';

export function InsightsScreen() {
  const dispatch = useAppDispatch();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const {riskHistory} = useAppSelector(state => state.metrics);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const res = await metricsApi.getRiskHistory(30);
      dispatch(setRiskHistory(res.data));
    } catch {
      // Keep stale data
    }
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  }

  // ─── Simple bar chart built from Views ──────────────────────────────────────
  const chartData: RiskHistoryItem[] = [...riskHistory]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  const maxScore = Math.max(...chartData.map(d => d.risk_score || 0), 1);

  return (
    <ScrollView
      style={[styles.screen, {backgroundColor: colors.background}]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }>
      <Text style={[styles.pageTitle, {color: colors.textPrimary}]}>
        Insights
      </Text>
      <Text style={[styles.pageSubtitle, {color: colors.textSecondary}]}>
        Your last 30 days
      </Text>

      {/* 30-day risk chart */}
      <Card style={styles.chartCard}>
        <Text style={[styles.cardTitle, {color: colors.textSecondary}]}>
          Risk Score Trend
        </Text>
        {chartData.length === 0 ? (
          <Text style={[styles.emptyText, {color: colors.textTertiary}]}>
            No data yet. Check back after a few days of usage.
          </Text>
        ) : (
          <View style={styles.chartContainer}>
            <View style={styles.barsRow}>
              {chartData.map(item => {
                const barHeight = Math.max(
                  ((item.risk_score ?? 0) / maxScore) * 80,
                  4,
                );
                return (
                  <View key={item.date} style={styles.barWrapper}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: barHeight,
                          backgroundColor: RISK_COLORS[item.risk_level],
                        },
                      ]}
                    />
                  </View>
                );
              })}
            </View>
            <View
              style={[styles.chartAxis, {borderTopColor: colors.border}]}
            />
            {/* First and last date labels */}
            {chartData.length > 0 && (
              <View style={styles.axisLabels}>
                <Text style={[styles.axisLabel, {color: colors.textTertiary}]}>
                  {formatDateShort(chartData[0].date)}
                </Text>
                <Text style={[styles.axisLabel, {color: colors.textTertiary}]}>
                  Today
                </Text>
              </View>
            )}
          </View>
        )}
      </Card>

      <View style={{height: CARD_VERTICAL_GAP}} />

      {/* Risk level legend */}
      <Card>
        <Text style={[styles.cardTitle, {color: colors.textSecondary}]}>
          Risk Levels
        </Text>
        <View style={styles.legend}>
          {(
            ['GREEN', 'YELLOW', 'ORANGE', 'RED', 'UNDEFINED'] as const
          ).map(level => (
            <View key={level} style={styles.legendRow}>
              <View
                style={[
                  styles.legendDot,
                  {backgroundColor: RISK_COLORS[level]},
                ]}
              />
              <Text
                style={[styles.legendLabel, {color: colors.textSecondary}]}>
                {level.charAt(0) + level.slice(1).toLowerCase()}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <View style={{height: SECTION_GAP}} />

      {/* Recent daily items */}
      <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>
        Recent Days
      </Text>
      {chartData.length === 0 ? (
        <Text style={[styles.emptyText, {color: colors.textTertiary}]}>
          No history available.
        </Text>
      ) : (
        [...chartData]
          .reverse()
          .slice(0, 14)
          .map(item => (
            <View key={item.date} style={styles.historyRow}>
              <View
                style={[
                  styles.historyDot,
                  {backgroundColor: RISK_COLORS[item.risk_level]},
                ]}
              />
              <View style={styles.historyText}>
                <Text style={[styles.historyDate, {color: colors.textPrimary}]}>
                  {formatDateShort(item.date)}
                </Text>
                <Text
                  style={[styles.historyLevel, {color: colors.textSecondary}]}>
                  {item.risk_level.charAt(0) +
                    item.risk_level.slice(1).toLowerCase()}
                  {item.risk_score != null
                    ? ` · ${Math.round(item.risk_score * 100)}%`
                    : ''}
                </Text>
              </View>
            </View>
          ))
      )}
      <View style={{height: 24}} />
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
  pageTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: FONT_SIZE.sm,
    marginBottom: SECTION_GAP,
  },
  chartCard: {},
  cardTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  chartContainer: {
    marginTop: SPACING.xs,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 88,
    gap: 2,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 2,
    minHeight: 4,
  },
  chartAxis: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  axisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  axisLabel: {
    fontSize: FONT_SIZE.xs,
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  legend: {
    gap: SPACING.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: FONT_SIZE.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  historyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  historyText: {
    flex: 1,
  },
  historyDate: {
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },
  historyLevel: {
    fontSize: FONT_SIZE.sm,
  },
});
