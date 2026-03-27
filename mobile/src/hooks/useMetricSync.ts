import {useEffect, useRef, useCallback} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import {useAppDispatch, useAppSelector} from '@/store';
import {setStaleQueueWarning} from '@/store/metricsSlice';
import {metricsApi} from '@/api/metrics';
import {localQueue} from '@/services/localQueue';
import {readDailyHealthData, isHealthDataAvailable} from '@/services/healthService';
import {getDailyStepCount} from '@/services/motionService';
import {getTodayScreenTimeMinutes} from '@/services/screenTimeService';
import {sampleLocationAndAggregate} from '@/services/locationService';
import {getAmbientNoiseLevel} from '@/services/ambientNoiseService';
import {inferSleepHours} from '@/services/inferredSleepService';
import {getCollectionIntervalMs, getRetryIntervalMs} from '@/services/pollingService';
import {DailyMetrics} from '@/types';
import {todayISODate} from '@/utils/formatters';


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
  consents: {health: boolean; location: boolean; noise: boolean},
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
    const available = consents.health && await isHealthDataAvailable();
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

  // ── Inferred sleep fallback (spec §18.5) ──────────────────────────────────
  // Only run when the health framework returned no sleep data.
  if (sleepHours === null) {
    try {
      const inferred = await inferSleepHours(today);
      sleepHours = inferred.sleep_hours;
      sleepSource = inferred.sleep_source;
    } catch (err) {
      console.warn('[useMetricSync] Sleep inference failed:', err);
    }
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

  // ── Screen time (Android UsageStatsManager; null on iOS) ──────────────────
  let screenTimeMinutes: number | null = null;
  try {
    screenTimeMinutes = await getTodayScreenTimeMinutes();
  } catch (err) {
    console.warn('[useMetricSync] Screen time read failed:', err);
  }

  // ── Location category aggregates (consent-gated) ──────────────────────────
  let locationHomeRatio: number | null = null;
  let locationTransitions: number | null = null;
  if (consents.location) {
    try {
      const loc = await sampleLocationAndAggregate();
      locationHomeRatio = loc.location_home_ratio;
      locationTransitions = loc.location_transitions;
    } catch (err) {
      console.warn('[useMetricSync] Location sample failed:', err);
    }
  }

  // ── Ambient noise (consent-gated) ─────────────────────────────────────────
  let noiseLevelDb: number | null = null;
  if (consents.noise) {
    try {
      noiseLevelDb = await getAmbientNoiseLevel();
    } catch (err) {
      console.warn('[useMetricSync] Ambient noise read failed:', err);
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
    screen_time_minutes: screenTimeMinutes,
    location_home_ratio: locationHomeRatio,
    location_transitions: locationTransitions,
    noise_level_db_avg: noiseLevelDb,
    // Fields not collected by sensors — provided from Redux (manual entry)
    mood_score: moodScore,
    communication_count: communicationCount,
  };

  return metrics;
}

export function useMetricSync() {
  const dispatch = useAppDispatch();
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read manually entered metrics from Redux so they can be merged into the
  // health-framework payload before upload.
  const moodScore = useAppSelector(
    state => state.metrics.todayMetrics?.mood_score ?? null,
  );
  const communicationCount = useAppSelector(
    state => state.metrics.todayMetrics?.communication_count ?? null,
  );

  // Consent flags — collection stops immediately when a consent is revoked (spec §10.4).
  const consentHealth = useAppSelector(state => state.consents.health_data_accepted);
  const consentLocation = useAppSelector(state => state.consents.location_category_accepted);
  const consentNoise = useAppSelector(state => state.consents.noise_level_accepted);

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
      const todayMetrics = await collectDailyMetrics(moodScore, communicationCount, {
        health: consentHealth,
        location: consentLocation,
        noise: consentNoise,
      });
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

  // Retry on adaptive interval (battery / background / offline aware, spec §18.3)
  useEffect(() => {
    let active = true;

    async function scheduleNext() {
      if (!active) return;
      const intervalMs = await getCollectionIntervalMs();
      intervalRef.current = setTimeout(async () => {
        if (!active) return;
        await syncQueue();
        scheduleNext();
      }, intervalMs);
    }

    scheduleNext();

    return () => {
      active = false;
      if (intervalRef.current) clearTimeout(intervalRef.current);
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
