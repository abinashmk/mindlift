import {useEffect, useRef, useCallback} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import {useAppDispatch} from '@/store';
import {setStaleQueueWarning} from '@/store/metricsSlice';
import {metricsApi} from '@/api/metrics';
import {localQueue} from '@/services/localQueue';

const RETRY_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export function useMetricSync() {
  const dispatch = useAppDispatch();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncQueue = useCallback(async () => {
    // Prune stale entries and warn if any were dropped
    const dropped = localQueue.pruneStale();
    if (dropped.length > 0) {
      dispatch(setStaleQueueWarning(true));
      console.warn(
        `[MetricSync] Dropped ${dropped.length} stale metric entries: ${dropped.join(', ')}`,
      );
    }

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
  }, [dispatch]);

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
