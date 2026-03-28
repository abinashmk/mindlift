import React, {useCallback, useRef, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
  RefreshControl,
  Pressable,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';

import {metricsApi, PatternInsight} from '@/api/metrics';
import {useAppDispatch, useAppSelector} from '@/store';
import {setRiskHistory} from '@/store/metricsSlice';
import {
  setCalendarConnected,
  setCalendarDisconnected,
  setTodayMeetingHours,
} from '@/store/calendarSlice';
import {
  signInToGoogle,
  signOutFromGoogle,
  fetchTodayMeetingHours,
} from '@/services/calendarService';
import {RiskHistoryItem} from '@/types';
import {Card} from '@/components/ui/Card';
import {PatternInsightCard} from '@/components/PatternInsightCard';
import {
  BORDER_RADIUS,
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
import {todayISODate} from '@/utils/formatters';

type Segment = 'trends' | 'calendar';

const HEAVY_THRESHOLD    = 4;
const MODERATE_THRESHOLD = 2;

function meetingLoadLabel(hours: number): {label: string; color: string} {
  if (hours >= HEAVY_THRESHOLD)    return {label: 'Heavy',    color: '#c94545'};
  if (hours >= MODERATE_THRESHOLD) return {label: 'Moderate', color: '#c47830'};
  return                                   {label: 'Light',    color: '#2daa78'};
}

export function InsightsScreen() {
  const dispatch = useAppDispatch();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const [segment, setSegment] = useState<Segment>('trends');
  const [refreshing, setRefreshing]       = useState(false);
  const [patternInsight, setPatternInsight] = useState<PatternInsight | null>(null);

  // Trends state
  const {riskHistory} = useAppSelector(state => state.metrics);
  const [tooltip, setTooltip] = useState<{index: number; item: RiskHistoryItem} | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calendar state
  const calendarConnected  = useAppSelector(s => s.calendar.connected);
  const calendarEmail      = useAppSelector(s => s.calendar.userEmail);
  const todayHours         = useAppSelector(s => s.calendar.todayMeetingHours);
  const calendarLastSynced = useAppSelector(s => s.calendar.lastSyncedDate);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing]       = useState(false);
  const [calPatternHeadline, setCalPatternHeadline]     = useState<string | null>(null);
  const [calPatternExplanation, setCalPatternExplanation] = useState<string | null>(null);

  // ─── Loaders ────────────────────────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    try {
      const res = await metricsApi.getRiskHistory(30);
      const mapped: RiskHistoryItem[] = (res.data as any[]).map(r => ({
        date: (r.date ?? r.assessment_time ?? '').slice(0, 10),
        risk_level: r.risk_level,
        risk_score: r.risk_score ?? 0,
      }));
      dispatch(setRiskHistory(mapped));
    } catch { /* keep stale */ }
  }, [dispatch]);

  const loadPatternInsight = useCallback(async () => {
    try {
      const res = await metricsApi.getPatternInsight();
      if (res.data.has_pattern) {
        setPatternInsight(res.data);
        if (res.data.signals.some(s => s.metric_key === 'meeting_hours')) {
          setCalPatternHeadline(res.data.headline);
          setCalPatternExplanation(res.data.explanation);
        }
      }
    } catch { /* non-critical */ }
  }, []);

  const syncMeetingHours = useCallback(async () => {
    if (!calendarConnected) return;
    setIsSyncing(true);
    try {
      const hours = await fetchTodayMeetingHours();
      dispatch(setTodayMeetingHours({hours, date: todayISODate()}));
    } catch (err) {
      console.warn('[InsightsScreen] calendar sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [calendarConnected, dispatch]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
      loadPatternInsight();
      if (calendarConnected && calendarLastSynced !== todayISODate()) {
        syncMeetingHours();
      }
    }, [loadHistory, loadPatternInsight, syncMeetingHours, calendarConnected, calendarLastSynced]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([loadHistory(), loadPatternInsight(), syncMeetingHours()]);
    setRefreshing(false);
  }

  // ─── Calendar actions ────────────────────────────────────────────────────────

  async function handleConnect() {
    setIsConnecting(true);
    try {
      const email = await signInToGoogle();
      dispatch(setCalendarConnected({userEmail: email}));
      const hours = await fetchTodayMeetingHours();
      dispatch(setTodayMeetingHours({hours, date: todayISODate()}));
    } catch (err: any) {
      const msg = err?.code === '12501'
        ? 'Sign-in was cancelled.'
        : `Could not connect Google Calendar.\n\n${err?.message ?? ''}`;
      Alert.alert('Google Calendar', msg);
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleDisconnect() {
    Alert.alert(
      'Disconnect Google Calendar',
      'Meeting hours will no longer be tracked.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await signOutFromGoogle();
            dispatch(setCalendarDisconnected());
          },
        },
      ],
    );
  }

  // ─── Chart data ──────────────────────────────────────────────────────────────

  const chartData: RiskHistoryItem[] = [...riskHistory]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);
  const maxScore = Math.max(...chartData.map(d => d.risk_score || 0), 1);

  const load = todayHours !== null ? meetingLoadLabel(todayHours) : null;

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

      {/* Segment control */}
      <View style={[styles.segmentTrack, {backgroundColor: colors.surfaceSecondary, borderColor: colors.border}]}>
        {(['trends', 'calendar'] as Segment[]).map(seg => (
          <TouchableOpacity
            key={seg}
            style={[
              styles.segmentBtn,
              segment === seg && {
                backgroundColor: colors.surface,
                shadowColor: '#3d2d6e',
                shadowOffset: {width: 0, height: 1},
                shadowOpacity: 0.1,
                shadowRadius: 3,
                elevation: 2,
              },
            ]}
            onPress={() => setSegment(seg)}
            activeOpacity={0.8}>
            <Text
              style={[
                styles.segmentLabel,
                {color: segment === seg ? colors.primary : colors.textTertiary},
              ]}>
              {seg === 'trends' ? 'Trends' : 'Calendar'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── TRENDS ── */}
      {segment === 'trends' && (
        <>
          {patternInsight && (
            <>
              <PatternInsightCard insight={patternInsight} />
              <View style={{height: CARD_VERTICAL_GAP}} />
            </>
          )}

          <Card>
            <Text style={[styles.cardTitle, {color: colors.textSecondary}]}>
              Burnout Load — 30 days
            </Text>
            {chartData.length === 0 ? (
              <Text style={[styles.emptyText, {color: colors.textTertiary}]}>
                No data yet. Check back after a few days of usage.
              </Text>
            ) : (
              <View style={styles.chartContainer}>
                {tooltip && (
                  <View
                    style={[
                      styles.tooltip,
                      {
                        backgroundColor: colors.surface,
                        borderColor: RISK_COLORS[tooltip.item.risk_level],
                        left: Math.min(Math.max((tooltip.index / chartData.length) * 100 - 10, 0), 70) + '%',
                      },
                    ]}>
                    <Text style={[styles.tooltipDate, {color: colors.textSecondary}]}>
                      {formatDateShort(tooltip.item.date)}
                    </Text>
                    <Text style={[styles.tooltipScore, {color: RISK_COLORS[tooltip.item.risk_level]}]}>
                      {Math.round((tooltip.item.risk_score ?? 0) * 100)}%
                    </Text>
                    <Text style={[styles.tooltipLevel, {color: colors.textTertiary}]}>
                      {tooltip.item.risk_level.charAt(0) + tooltip.item.risk_level.slice(1).toLowerCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.barsRow}>
                  {chartData.map((item, index) => {
                    const barHeight = Math.max(((item.risk_score ?? 0) / maxScore) * 80, 4);
                    const isSelected = tooltip?.index === index;
                    return (
                      <Pressable
                        key={item.date}
                        style={styles.barWrapper}
                        onPress={() => {
                          if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
                          if (isSelected) { setTooltip(null); }
                          else {
                            setTooltip({index, item});
                            tooltipTimer.current = setTimeout(() => setTooltip(null), 3000);
                          }
                        }}
                        accessibilityLabel={`${formatDateShort(item.date)}: ${Math.round((item.risk_score ?? 0) * 100)}%`}>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: barHeight,
                              backgroundColor: RISK_COLORS[item.risk_level],
                              opacity: tooltip && !isSelected ? 0.35 : 1,
                            },
                          ]}
                        />
                      </Pressable>
                    );
                  })}
                </View>
                <View style={[styles.chartAxis, {borderTopColor: colors.border}]} />
                {chartData.length > 0 && (
                  <View style={styles.axisLabels}>
                    <Text style={[styles.axisLabel, {color: colors.textTertiary}]}>
                      {formatDateShort(chartData[0].date)}
                    </Text>
                    <Text style={[styles.axisLabel, {color: colors.textTertiary}]}>Today</Text>
                  </View>
                )}
              </View>
            )}
          </Card>

          <View style={{height: CARD_VERTICAL_GAP}} />

          <Card>
            <Text style={[styles.cardTitle, {color: colors.textSecondary}]}>
              Level Guide
            </Text>
            <View style={styles.legend}>
              {(['GREEN', 'YELLOW', 'ORANGE', 'RED', 'UNDEFINED'] as const).map(level => (
                <View key={level} style={styles.legendRow}>
                  <View style={[styles.legendDot, {backgroundColor: RISK_COLORS[level]}]} />
                  <Text style={[styles.legendLabel, {color: colors.textSecondary}]}>
                    {level.charAt(0) + level.slice(1).toLowerCase()}
                  </Text>
                </View>
              ))}
            </View>
          </Card>

          <View style={{height: SECTION_GAP}} />

          <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>
            Recent Days
          </Text>
          {chartData.length === 0 ? (
            <Text style={[styles.emptyText, {color: colors.textTertiary}]}>No history available.</Text>
          ) : (
            [...chartData].reverse().slice(0, 14).map(item => (
              <View key={item.date} style={[styles.historyRow, {borderBottomColor: colors.divider}]}>
                <View style={[styles.historyDot, {backgroundColor: RISK_COLORS[item.risk_level]}]} />
                <View style={styles.historyText}>
                  <Text style={[styles.historyDate, {color: colors.textPrimary}]}>
                    {formatDateShort(item.date)}
                  </Text>
                  <Text style={[styles.historyLevel, {color: colors.textSecondary}]}>
                    {item.risk_level.charAt(0) + item.risk_level.slice(1).toLowerCase()}
                    {item.risk_score != null ? ` · ${Math.round(item.risk_score * 100)}%` : ''}
                  </Text>
                </View>
              </View>
            ))
          )}
        </>
      )}

      {/* ── CALENDAR ── */}
      {segment === 'calendar' && (
        <>
          {/* Connection card */}
          <Card>
            <View style={styles.connectionRow}>
              <View style={styles.connectionLeft}>
                <Text style={[styles.connectionTitle, {color: colors.textPrimary}]}>
                  Google Calendar
                </Text>
                <Text style={[styles.connectionStatus, {
                  color: calendarConnected ? colors.success : colors.textTertiary,
                }]}>
                  {calendarConnected ? `Connected · ${calendarEmail ?? ''}` : 'Not connected'}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.connectBtn,
                  {backgroundColor: calendarConnected ? colors.surfaceSecondary : colors.primary},
                ]}
                onPress={calendarConnected ? handleDisconnect : handleConnect}
                disabled={isConnecting}>
                {isConnecting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : (
                    <Text style={[
                      styles.connectBtnText,
                      {color: calendarConnected ? colors.textSecondary : '#fff'},
                    ]}>
                      {calendarConnected ? 'Disconnect' : 'Connect'}
                    </Text>
                  )}
              </TouchableOpacity>
            </View>
            {!calendarConnected && (
              <Text style={[styles.connectHint, {color: colors.textTertiary}]}>
                Connect to track meeting hours and detect calendar-driven burnout patterns.
              </Text>
            )}
          </Card>

          <View style={{height: CARD_VERTICAL_GAP}} />

          {calendarConnected && (
            <>
              {/* Today's load */}
              <Card>
                <View style={styles.calCardHeader}>
                  <Text style={[styles.cardTitle, {color: colors.textSecondary}]}>
                    Today's Meeting Load
                  </Text>
                  <TouchableOpacity onPress={syncMeetingHours} disabled={isSyncing}>
                    <Text style={[styles.syncBtn, {color: colors.primary}]}>
                      {isSyncing ? 'Syncing…' : 'Sync'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {todayHours === null ? (
                  <Text style={[styles.emptyText, {color: colors.textTertiary}]}>
                    Tap Sync to fetch today's calendar.
                  </Text>
                ) : (
                  <>
                    <View style={styles.loadRow}>
                      <Text style={[styles.hoursValue, {color: colors.textPrimary}]}>
                        {todayHours.toFixed(1)}
                        <Text style={[styles.hoursUnit, {color: colors.textSecondary}]}> hrs</Text>
                      </Text>
                      {load && (
                        <View style={[styles.loadBadge, {
                          backgroundColor: load.color + '18',
                          borderColor: load.color,
                        }]}>
                          <Text style={[styles.loadBadgeText, {color: load.color}]}>
                            {load.label}
                          </Text>
                        </View>
                      )}
                    </View>
                    <ThresholdBar hours={todayHours} colors={colors} />
                    <View style={styles.barLabels}>
                      <Text style={[styles.barLabel, {color: colors.textTertiary}]}>0h</Text>
                      <Text style={[styles.barLabel, {color: colors.textTertiary}]}>
                        {MODERATE_THRESHOLD}h moderate
                      </Text>
                      <Text style={[styles.barLabel, {color: colors.textTertiary}]}>
                        {HEAVY_THRESHOLD}h+ heavy
                      </Text>
                    </View>
                  </>
                )}
                {calendarLastSynced && (
                  <Text style={[styles.lastSynced, {color: colors.textTertiary}]}>
                    Last synced: {calendarLastSynced}
                  </Text>
                )}
              </Card>

              <View style={{height: CARD_VERTICAL_GAP}} />

              {/* Inference */}
              {todayHours !== null && (
                <>
                  <Card>
                    <Text style={[styles.cardTitle, {color: colors.textSecondary}]}>
                      What This Means
                    </Text>
                    <MeetingInference hours={todayHours} colors={colors} />
                  </Card>
                  <View style={{height: CARD_VERTICAL_GAP}} />
                </>
              )}

              {/* Active meeting pattern */}
              {calPatternHeadline && (
                <>
                  <Card style={{borderColor: colors.warning, borderWidth: 1.5}}>
                    <Text style={[styles.cardTitle, {color: colors.textSecondary}]}>
                      Detected Pattern
                    </Text>
                    <Text style={[styles.patternHeadline, {color: colors.textPrimary}]}>
                      {calPatternHeadline}
                    </Text>
                    <Text style={[styles.patternBody, {color: colors.textSecondary}]}>
                      {calPatternExplanation}
                    </Text>
                  </Card>
                  <View style={{height: CARD_VERTICAL_GAP}} />
                </>
              )}
            </>
          )}

          {/* How it works */}
          <Card>
            <Text style={[styles.cardTitle, {color: colors.textSecondary}]}>
              How It Works
            </Text>
            <View style={styles.howRows}>
              {HOW_IT_WORKS.map((item, i) => (
                <View key={i} style={[styles.howRow, i > 0 && {marginTop: SPACING.md}]}>
                  <View style={[styles.howIcon, {backgroundColor: colors.primaryLight}]}>
                    <Text style={styles.howIconText}>{item.icon}</Text>
                  </View>
                  <View style={styles.howText}>
                    <Text style={[styles.howTitle, {color: colors.textPrimary}]}>{item.title}</Text>
                    <Text style={[styles.howBody, {color: colors.textSecondary}]}>{item.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </>
      )}

      <View style={{height: 32}} />
    </ScrollView>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ThresholdBar({hours, colors}: {hours: number; colors: typeof COLORS_LIGHT}) {
  const max = 8;
  const pct = Math.min(hours / max, 1);
  const barColor = hours >= HEAVY_THRESHOLD ? '#c94545' : hours >= MODERATE_THRESHOLD ? '#c47830' : '#2daa78';
  return (
    <View style={[styles.barTrack, {backgroundColor: colors.surfaceSecondary}]}>
      <View style={[styles.barFill, {width: `${pct * 100}%`, backgroundColor: barColor}]} />
      <View style={[styles.marker, {left: `${(MODERATE_THRESHOLD / max) * 100}%`, backgroundColor: colors.border}]} />
      <View style={[styles.marker, {left: `${(HEAVY_THRESHOLD / max) * 100}%`, backgroundColor: colors.border}]} />
    </View>
  );
}

function MeetingInference({hours, colors}: {hours: number; colors: typeof COLORS_LIGHT}) {
  const lines =
    hours >= HEAVY_THRESHOLD
      ? [
          {title: 'Cognitive overload risk', body: 'Back-to-back meetings leave little mental recovery time. Try to protect at least one meeting-free hour.'},
          {title: 'Sleep may be affected', body: 'Heavy meeting days are linked to later bedtimes. Aim to wind down 30 min earlier tonight.'},
        ]
      : hours >= MODERATE_THRESHOLD
      ? [{title: 'Manageable — watch the trend', body: 'Your load is moderate. If this continues across several days your burnout score may rise.'}]
      : [{title: 'Light meeting day', body: 'Good conditions for deep work. Use the space to focus on something that needs uninterrupted attention.'}];

  return (
    <>
      {lines.map((l, i) => (
        <View key={i} style={i > 0 ? {marginTop: SPACING.md} : undefined}>
          <Text style={[styles.inferTitle, {color: colors.textPrimary}]}>{l.title}</Text>
          <Text style={[styles.inferBody, {color: colors.textSecondary}]}>{l.body}</Text>
        </View>
      ))}
    </>
  );
}

const HOW_IT_WORKS = [
  {icon: '📅', title: 'Reads your primary calendar', body: 'Only total event duration per day is stored — no titles, attendees, or content.'},
  {icon: '📊', title: 'Builds your baseline', body: 'After 7+ days, the app learns your typical meeting load and flags significant deviations.'},
  {icon: '🔔', title: 'Triggers burnout patterns', body: 'Heavy loads combined with low sleep or activity surface as pattern insights and affect your burnout score.'},
  {icon: '🔒', title: 'Read-only access', body: 'MindLift cannot create, edit, or delete any calendar events.'},
];

// ─── Styles ────────────────────────────────────────────────────────────────────

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
    marginBottom: SPACING.md,
  },
  // Segment
  segmentTrack: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    marginBottom: SECTION_GAP,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
  },
  segmentLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  // Chart
  cardTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: SPACING.md,
  },
  chartContainer: {
    marginTop: SPACING.xs,
    paddingTop: 56,
  },
  tooltip: {
    position: 'absolute',
    top: 0,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    minWidth: 72,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  tooltipDate:  {fontSize: 10, fontWeight: '500'},
  tooltipScore: {fontSize: FONT_SIZE.md, fontWeight: '700', marginTop: 1},
  tooltipLevel: {fontSize: 10, marginTop: 1},
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 88,
    gap: 2,
  },
  barWrapper: {flex: 1, alignItems: 'center', justifyContent: 'flex-end'},
  bar: {width: '100%', borderRadius: 3, minHeight: 4},
  chartAxis: {borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4},
  axisLabels: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 4},
  axisLabel: {fontSize: FONT_SIZE.xs},
  emptyText: {fontSize: FONT_SIZE.sm, textAlign: 'center', paddingVertical: SPACING.lg},
  // Legend
  legend: {gap: SPACING.sm},
  legendRow: {flexDirection: 'row', alignItems: 'center', gap: SPACING.sm},
  legendDot: {width: 10, height: 10, borderRadius: 5},
  legendLabel: {fontSize: FONT_SIZE.sm},
  // History
  sectionTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: SPACING.md,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyDot: {width: 12, height: 12, borderRadius: 6},
  historyText: {flex: 1},
  historyDate: {fontSize: FONT_SIZE.md, fontWeight: '500'},
  historyLevel: {fontSize: FONT_SIZE.sm},
  // Calendar
  connectionRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  connectionLeft: {flex: 1, marginRight: SPACING.md},
  connectionTitle: {fontSize: FONT_SIZE.md, fontWeight: '600'},
  connectionStatus: {fontSize: FONT_SIZE.sm, marginTop: 2},
  connectBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
  },
  connectBtnText: {fontSize: FONT_SIZE.sm, fontWeight: '600'},
  connectHint: {fontSize: FONT_SIZE.sm, marginTop: SPACING.md, lineHeight: FONT_SIZE.sm * 1.5},
  calCardHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  syncBtn: {fontSize: FONT_SIZE.sm, fontWeight: '600'},
  loadRow: {flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md},
  hoursValue: {fontSize: 40, fontWeight: '700', lineHeight: 44},
  hoursUnit: {fontSize: FONT_SIZE.lg, fontWeight: '400'},
  loadBadge: {paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: 20, borderWidth: 1.5},
  loadBadgeText: {fontSize: FONT_SIZE.sm, fontWeight: '700'},
  barTrack: {height: 8, borderRadius: 4, position: 'relative', overflow: 'hidden', marginBottom: 6},
  barFill: {position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4},
  marker: {position: 'absolute', top: 0, bottom: 0, width: 1.5},
  barLabels: {flexDirection: 'row', justifyContent: 'space-between'},
  barLabel: {fontSize: 10},
  lastSynced: {fontSize: FONT_SIZE.xs, marginTop: SPACING.sm},
  patternHeadline: {fontSize: FONT_SIZE.lg, fontWeight: '700', marginBottom: SPACING.sm},
  patternBody: {fontSize: FONT_SIZE.sm, lineHeight: FONT_SIZE.sm * 1.5},
  inferTitle: {fontSize: FONT_SIZE.md, fontWeight: '600', marginBottom: 3},
  inferBody: {fontSize: FONT_SIZE.sm, lineHeight: FONT_SIZE.sm * 1.5},
  howRows: {},
  howRow: {flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start'},
  howIcon: {width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center'},
  howIconText: {fontSize: 18},
  howText: {flex: 1},
  howTitle: {fontSize: FONT_SIZE.sm, fontWeight: '600', marginBottom: 2},
  howBody: {fontSize: FONT_SIZE.sm, lineHeight: FONT_SIZE.sm * 1.5},
});
