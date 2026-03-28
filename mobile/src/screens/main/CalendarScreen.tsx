/**
 * Calendar tab — Google Calendar burnout inference.
 *
 * Shows connection status, today's meeting hours, a 7-day meeting load
 * trend, and any active meeting-related drift patterns.
 */
import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';

import {useAppDispatch, useAppSelector} from '@/store';
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
import {metricsApi} from '@/api/metrics';
import {Card} from '@/components/ui/Card';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  PAGE_HORIZONTAL_PADDING,
  SPACING,
  CARD_VERTICAL_GAP,
} from '@/utils/constants';
import {todayISODate} from '@/utils/formatters';

// How many hours of meetings is considered "heavy"
const HEAVY_THRESHOLD = 4;
const MODERATE_THRESHOLD = 2;

function loadLabel(hours: number): {label: string; color: string} {
  if (hours >= HEAVY_THRESHOLD) return {label: 'Heavy', color: '#dc2626'};
  if (hours >= MODERATE_THRESHOLD) return {label: 'Moderate', color: '#f97316'};
  return {label: 'Light', color: '#22c55e'};
}

export function CalendarScreen() {
  const dispatch = useAppDispatch();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const connected = useAppSelector(s => s.calendar.connected);
  const calendarEmail = useAppSelector(s => s.calendar.userEmail);
  const todayHours = useAppSelector(s => s.calendar.todayMeetingHours);
  const lastSynced = useAppSelector(s => s.calendar.lastSyncedDate);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [patternHeadline, setPatternHeadline] = useState<string | null>(null);
  const [patternExplanation, setPatternExplanation] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadPattern = useCallback(async () => {
    try {
      const res = await metricsApi.getPatternInsight();
      if (
        res.data.has_pattern &&
        res.data.signals.some(s => s.metric_key === 'meeting_hours')
      ) {
        setPatternHeadline(res.data.headline);
        setPatternExplanation(res.data.explanation);
      } else {
        setPatternHeadline(null);
        setPatternExplanation(null);
      }
    } catch {
      // non-critical
    }
  }, []);

  const syncMeetingHours = useCallback(async () => {
    if (!connected) return;
    setIsSyncing(true);
    try {
      const hours = await fetchTodayMeetingHours();
      dispatch(setTodayMeetingHours({hours, date: todayISODate()}));
    } catch (err: any) {
      console.warn('[CalendarScreen] sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [connected, dispatch]);

  useFocusEffect(
    useCallback(() => {
      loadPattern();
      // Re-sync if we haven't synced today
      if (connected && lastSynced !== todayISODate()) {
        syncMeetingHours();
      }
    }, [loadPattern, syncMeetingHours, connected, lastSynced]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([loadPattern(), syncMeetingHours()]);
    setRefreshing(false);
  }

  async function handleConnect() {
    setIsConnecting(true);
    try {
      const email = await signInToGoogle();
      dispatch(setCalendarConnected({userEmail: email}));
      // Immediately fetch today's hours after connecting
      const hours = await fetchTodayMeetingHours();
      dispatch(setTodayMeetingHours({hours, date: todayISODate()}));
    } catch (err: any) {
      const msg =
        err?.code === '12501'
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

  const load = todayHours !== null ? loadLabel(todayHours) : null;

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
        Calendar
      </Text>
      <Text style={[styles.pageSubtitle, {color: colors.textSecondary}]}>
        Meeting load as a burnout signal
      </Text>

      {/* Connection card */}
      <Card style={styles.connectionCard}>
        <View style={styles.connectionRow}>
          <View style={styles.connectionLeft}>
            <Text style={[styles.connectionTitle, {color: colors.textPrimary}]}>
              Google Calendar
            </Text>
            <Text style={[styles.connectionStatus, {color: connected ? '#22c55e' : colors.textTertiary}]}>
              {connected ? `Connected · ${calendarEmail ?? ''}` : 'Not connected'}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.connectBtn,
              {backgroundColor: connected ? colors.border : colors.primary},
            ]}
            onPress={connected ? handleDisconnect : handleConnect}
            disabled={isConnecting}
            accessibilityRole="button">
            {isConnecting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.connectBtnText, {color: connected ? colors.textSecondary : '#fff'}]}>
                {connected ? 'Disconnect' : 'Connect'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
        {!connected && (
          <Text style={[styles.connectHint, {color: colors.textTertiary}]}>
            Connect to automatically track meeting hours and detect calendar-driven burnout.
          </Text>
        )}
      </Card>

      <View style={{height: CARD_VERTICAL_GAP}} />

      {/* Today's meeting load */}
      {connected && (
        <>
          <Card>
            <View style={styles.sectionHeader}>
              <Text style={[styles.cardLabel, {color: colors.textSecondary}]}>
                TODAY'S MEETING LOAD
              </Text>
              <TouchableOpacity onPress={syncMeetingHours} disabled={isSyncing}>
                <Text style={[styles.syncBtn, {color: colors.primary}]}>
                  {isSyncing ? 'Syncing…' : 'Sync'}
                </Text>
              </TouchableOpacity>
            </View>

            {todayHours === null ? (
              <Text style={[styles.emptyText, {color: colors.textTertiary}]}>
                No calendar data yet. Tap Sync to fetch.
              </Text>
            ) : (
              <View style={styles.loadRow}>
                <Text style={[styles.hoursValue, {color: colors.textPrimary}]}>
                  {todayHours.toFixed(1)}
                  <Text style={[styles.hoursUnit, {color: colors.textSecondary}]}>
                    {' '}hrs
                  </Text>
                </Text>
                {load && (
                  <View style={[styles.loadBadge, {backgroundColor: load.color + '22', borderColor: load.color}]}>
                    <Text style={[styles.loadBadgeText, {color: load.color}]}>
                      {load.label}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {todayHours !== null && (
              <View style={styles.thresholdRow}>
                <ThresholdBar hours={todayHours} colors={colors} />
              </View>
            )}

            {lastSynced && (
              <Text style={[styles.lastSynced, {color: colors.textTertiary}]}>
                Last synced: {lastSynced}
              </Text>
            )}
          </Card>

          <View style={{height: CARD_VERTICAL_GAP}} />

          {/* What this means */}
          <Card>
            <Text style={[styles.cardLabel, {color: colors.textSecondary}]}>
              WHAT THIS MEANS
            </Text>
            <View style={styles.inferenceRows}>
              <InferenceRow
                hours={todayHours ?? 0}
                colors={colors}
              />
            </View>
          </Card>

          <View style={{height: CARD_VERTICAL_GAP}} />
        </>
      )}

      {/* Active meeting pattern from drift detection */}
      {patternHeadline && (
        <>
          <Card style={[styles.patternCard, {borderColor: '#f97316', borderWidth: 1.5}]}>
            <Text style={[styles.cardLabel, {color: colors.textSecondary}]}>
              DETECTED PATTERN
            </Text>
            <Text style={[styles.patternHeadline, {color: colors.textPrimary}]}>
              {patternHeadline}
            </Text>
            <Text style={[styles.patternBody, {color: colors.textSecondary}]}>
              {patternExplanation}
            </Text>
          </Card>
          <View style={{height: CARD_VERTICAL_GAP}} />
        </>
      )}

      {/* How it works */}
      <Card>
        <Text style={[styles.cardLabel, {color: colors.textSecondary}]}>
          HOW IT WORKS
        </Text>
        <View style={styles.howRows}>
          {HOW_IT_WORKS.map((item, i) => (
            <View key={i} style={styles.howRow}>
              <Text style={styles.howEmoji}>{item.emoji}</Text>
              <View style={styles.howText}>
                <Text style={[styles.howTitle, {color: colors.textPrimary}]}>
                  {item.title}
                </Text>
                <Text style={[styles.howBody, {color: colors.textSecondary}]}>
                  {item.body}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      <View style={{height: 32}} />
    </ScrollView>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ThresholdBar({
  hours,
  colors,
}: {
  hours: number;
  colors: typeof COLORS_LIGHT;
}) {
  const max = 8;
  const pct = Math.min(hours / max, 1);
  const barColor =
    hours >= HEAVY_THRESHOLD
      ? '#dc2626'
      : hours >= MODERATE_THRESHOLD
      ? '#f97316'
      : '#22c55e';

  return (
    <View style={styles.barTrack}>
      <View
        style={[
          styles.barFill,
          {width: `${pct * 100}%`, backgroundColor: barColor},
        ]}
      />
      {/* Moderate marker */}
      <View style={[styles.marker, {left: `${(MODERATE_THRESHOLD / max) * 100}%`, borderColor: colors.border}]} />
      {/* Heavy marker */}
      <View style={[styles.marker, {left: `${(HEAVY_THRESHOLD / max) * 100}%`, borderColor: colors.border}]} />
    </View>
  );
}

function InferenceRow({
  hours,
  colors,
}: {
  hours: number;
  colors: typeof COLORS_LIGHT;
}) {
  let lines: {title: string; body: string}[];

  if (hours >= HEAVY_THRESHOLD) {
    lines = [
      {
        title: 'Cognitive overload risk',
        body: 'Back-to-back meetings leave little time for deep work or mental recovery. Aim to block at least one meeting-free hour.',
      },
      {
        title: 'Sleep at risk',
        body: 'Heavy meeting days are linked to later bedtimes and lighter sleep. Try to wind down 30 min earlier tonight.',
      },
    ];
  } else if (hours >= MODERATE_THRESHOLD) {
    lines = [
      {
        title: 'Manageable but watch the trend',
        body: 'Your meeting load is moderate. If this continues across multiple days your burnout score may rise.',
      },
    ];
  } else {
    lines = [
      {
        title: 'Light meeting day',
        body: "Good conditions for deep work. Use the space to make progress on something that's been hard to focus on.",
      },
    ];
  }

  return (
    <>
      {lines.map((l, i) => (
        <View key={i} style={i > 0 ? {marginTop: SPACING.md} : undefined}>
          <Text style={[styles.inferenceTitle, {color: colors.textPrimary}]}>
            {l.title}
          </Text>
          <Text style={[styles.inferenceBody, {color: colors.textSecondary}]}>
            {l.body}
          </Text>
        </View>
      ))}
    </>
  );
}

const HOW_IT_WORKS = [
  {
    emoji: '📅',
    title: 'Reads your primary calendar',
    body: 'Only your primary Google Calendar is read. No content, titles, or attendees are stored — only total duration per day.',
  },
  {
    emoji: '📊',
    title: 'Builds a personal baseline',
    body: 'After 7+ days of data, the app learns your typical meeting load and flags when you are significantly above or below it.',
  },
  {
    emoji: '🔔',
    title: 'Triggers burnout patterns',
    body: 'Heavy meeting loads combined with low sleep or low activity will surface as a pattern insight and affect your burnout score.',
  },
  {
    emoji: '🔒',
    title: 'Read-only access',
    body: 'MindLift only requests read-only calendar access. It cannot create, edit, or delete any events.',
  },
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
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: FONT_SIZE.sm,
    marginBottom: 20,
  },
  connectionCard: {},
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  connectionLeft: {flex: 1, marginRight: SPACING.md},
  connectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  connectionStatus: {
    fontSize: FONT_SIZE.sm,
    marginTop: 2,
  },
  connectBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 8,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
  },
  connectBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  connectHint: {
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.md,
    lineHeight: FONT_SIZE.sm * 1.5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  cardLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  syncBtn: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  loadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  hoursValue: {
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 44,
  },
  hoursUnit: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '400',
  },
  loadBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  loadBadgeText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  thresholdRow: {
    marginBottom: SPACING.sm,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
    position: 'relative',
    overflow: 'visible',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  marker: {
    position: 'absolute',
    top: -3,
    width: 2,
    height: 14,
    borderLeftWidth: 1.5,
    borderStyle: 'dashed',
  },
  lastSynced: {
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.xs,
  },
  inferenceRows: {},
  inferenceTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    marginBottom: 4,
  },
  inferenceBody: {
    fontSize: FONT_SIZE.sm,
    lineHeight: FONT_SIZE.sm * 1.5,
  },
  patternCard: {},
  patternHeadline: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  patternBody: {
    fontSize: FONT_SIZE.sm,
    lineHeight: FONT_SIZE.sm * 1.5,
  },
  howRows: {
    gap: SPACING.md,
  },
  howRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignItems: 'flex-start',
  },
  howEmoji: {
    fontSize: 22,
    marginTop: 1,
  },
  howText: {flex: 1},
  howTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    marginBottom: 2,
  },
  howBody: {
    fontSize: FONT_SIZE.sm,
    lineHeight: FONT_SIZE.sm * 1.5,
  },
});
