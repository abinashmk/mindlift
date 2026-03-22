import {useEffect, useRef, useCallback} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import {useAppDispatch, useAppSelector} from '@/store';
import {setStaleQueueWarning} from '@/store/metricsSlice';
import {metricsApi} from '@/api/metrics';
import {localQueue} from '@/services/localQueue';
import {readDailyHealthData, isHealthDataAvailable} from '@/services/healthService';
import {getDailyStepCount} from '@/services/motionService';
import {DailyMetrics} from '@/types';
import {todayISODate} from '@/utils/formatters';

const RETRY_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Collect today's sensor data, merge with any manually entered Redux state, and
 * enqueue the resulting `DailyMetrics` payload for upload.
 *
 * Step resolution order (first non-null wins):
 *   1. Health framework (HealthKit / Health Connect)
 *   2. Native pedometer fallback (motionService)
 *   3. null
 *
 * Sleep source inference:
 *   - If the health framework returns a sleep_hours value, its reported
 *     sleep_source ('wearable' or 'inferred') is used.
 *   - If sleep_hours is null we have no reliable signal, so sleep_source
 *     is set to 'unknown'.
 */
async function collectDailyMetrics(
  moodScore: number | null,
  communicationCount: number | null,
): Promise<DailyMetrics> {
  const today = new Date();
  const metricDate = todayISODate();

  // ── Health framework data ──────────────────────────────────────────────────
  let healthSteps: number | null = null;
  let restingHr: number | null = null;
  let avgHr: number | null = null;
  let hrv: number | null = null;
  let sleepHours: number | null = null;
  let sleepSource: DailyMetrics['sleep_source'] = 'unknown';

  try {
    const available = await isHealthDataAvailable();
    if (available) {
      const healthData = await readDailyHealthData(today);
      healthSteps = healthData.steps;
      restingHr = healthData.resting_heart_rate_bpm;
      avgHr = healthData.average_heart_rate_bpm;
      hrv = healthData.hrv_ms;
      sleepHours = healthData.sleep_hours;
      // Carry forward the source reported by the health framework, but if
      // sleep_hours came back null there is nothing to attribute.
      sleepSource = healthData.sleep_hours !== null
        ? healthData.sleep_source
        : 'unknown';
    }
  } catch (err) {
    console.warn('[useMetricSync] Health framework read failed:', err);
  }

  // ── Pedometer fallback for steps ──────────────────────────────────────────
  let steps = healthSteps;
  if (steps === null) {
    try {
      steps = await getDailyStepCount(today);
    } catch (err) {
      console.warn('[useMetricSync] Pedometer fallback failed:', err);
    }
  }

  // ── Assemble final payload ─────────────────────────────────────────────────
  const metrics: DailyMetrics = {
    metric_date: metricDate,
    steps,
    resting_heart_rate_bpm: restingHr,
    average_heart_rate_bpm: avgHr,
    hrv_ms: hrv,
    sleep_hours: sleepHours,
    sleep_source: sleepSource,
    // Fields not collected by sensors — provided from Redux (manual entry)
    mood_score: moodScore,
    communication_count: communicationCount,
    // Fields handled by other services (not collected here)
    screen_time_minutes: null,
    location_home_ratio: null,
    location_transitions: null,
    noise_level_db_avg: null,
  };

  return metrics;
}

export function useMetricSync() {
  const dispatch = useAppDispatch();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Read manually entered metrics from Redux so they can be merged into the
  // health-framework payload before upload.
  const moodScore = useAppSelector(
    state => state.metrics.todayMetrics?.mood_score ?? null,
  );
  const communicationCount = useAppSelector(
    state => state.metrics.todayMetrics?.communication_count ?? null,
  );

  const syncQueue = useCallback(async () => {
    // Prune stale entries and warn if any were dropped
    const dropped = localQueue.pruneStale();
    if (dropped.length > 0) {
      dispatch(setStaleQueueWarning(true));
      console.warn(
        `[MetricSync] Dropped ${dropped.length} stale metric entries: ${dropped.join(', ')}`,
      );
    }

    // ── Collect and enqueue today's metrics ──────────────────────────────────
    try {
      const todayMetrics = await collectDailyMetrics(moodScore, communicationCount);
      localQueue.enqueue(todayMetrics.metric_date, todayMetrics);
    } catch (err) {
      console.warn('[MetricSync] Failed to collect daily metrics:', err);
    }

    // ── Upload pending queue ──────────────────────────────────────────────────
    const pending = localQueue.getPending();
    if (pending.length === 0) return;

    for (const item of pending) {
      try {
        await metricsApi.uploadMetrics(item.metrics);
        localQueue.markUploaded(item.date);
      } catch (err) {
        localQueue.incrementAttempts(item.date);
        console.warn(`[MetricSync] Failed to upload metrics for ${item.date}:`, err);
      }
    }
  }, [dispatch, moodScore, communicationCount]);

  // Check for stale entries on mount
  useEffect(() => {
    if (localQueue.hasStaleEntries()) {
      dispatch(setStaleQueueWarning(true));
    }
    // Attempt initial sync
    syncQueue();
  }, [dispatch, syncQueue]);

  // Retry on interval
  useEffect(() => {
    intervalRef.current = setInterval(syncQueue, RETRY_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [syncQueue]);

  // Also sync when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'active') {
          syncQueue();
        }
      },
    );
    return () => subscription.remove();
  }, [syncQueue]);

  return {syncQueue};
}
