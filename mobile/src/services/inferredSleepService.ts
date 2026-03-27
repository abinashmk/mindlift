/**
 * Inferred sleep service (spec §18.5 — fallback sleep logic).
 *
 * Used only when the health framework returns sleep_hours = null.
 *
 * Algorithm (per spec):
 *   - Find the longest contiguous period where:
 *       - Screen was off (no foreground app activity)
 *       - No meaningful motion (step count = 0 for that period)
 *   - If that contiguous inactive period is >= 4 hours:
 *       inferred sleep_hours = duration of that period, capped at 12 hours
 *   - If conditions not met: sleep_hours = null
 *
 * Implementation approach:
 *   We cannot directly observe screen-off/on events from JS across a background
 *   sleep period. Instead we use the gap between the last AppState 'inactive'
 *   event and the first 'active' event as a proxy for device-inactive time, then
 *   cross-check with the pedometer to confirm no meaningful motion occurred.
 *
 *   Screen-off times are persisted to MMKV on each AppState change so the
 *   service can reconstruct the gap even after the app was killed and restarted.
 */

import {AppState, AppStateStatus} from 'react-native';
import {MMKV} from 'react-native-mmkv';
import {getDailyStepCount} from './motionService';

const storage = new MMKV({id: 'mindlift-sleep-infer'});

const LAST_INACTIVE_KEY = 'sleep.last_inactive_ts';
const LAST_ACTIVE_KEY = 'sleep.last_active_ts';
const MIN_SLEEP_HOURS = 4;
const MAX_SLEEP_HOURS = 12;

// ─── AppState listener (call once at app startup) ─────────────────────────────

let _listenerRegistered = false;

export function registerSleepInferenceListener(): void {
  if (_listenerRegistered) return;
  _listenerRegistered = true;

  AppState.addEventListener('change', (state: AppStateStatus) => {
    const now = Date.now();
    if (state === 'inactive' || state === 'background') {
      storage.set(LAST_INACTIVE_KEY, now.toString());
    } else if (state === 'active') {
      storage.set(LAST_ACTIVE_KEY, now.toString());
    }
  });
}

// ─── Inference ────────────────────────────────────────────────────────────────

/**
 * Attempt to infer sleep hours for `date` from device inactivity signals.
 *
 * Returns `{ sleep_hours, sleep_source }` where sleep_source is 'inferred'
 * on success, or `{ sleep_hours: null, sleep_source: 'unknown' }` when the
 * heuristic conditions are not met.
 */
export async function inferSleepHours(date: Date): Promise<{
  sleep_hours: number | null;
  sleep_source: 'inferred' | 'unknown';
}> {
  const lastInactiveStr = storage.getString(LAST_INACTIVE_KEY);
  const lastActiveStr = storage.getString(LAST_ACTIVE_KEY);

  if (!lastInactiveStr || !lastActiveStr) {
    return {sleep_hours: null, sleep_source: 'unknown'};
  }

  const inactiveAt = parseInt(lastInactiveStr, 10);
  const activeAt = parseInt(lastActiveStr, 10);

  // The inactive period must have started before the active timestamp.
  if (inactiveAt >= activeAt) {
    return {sleep_hours: null, sleep_source: 'unknown'};
  }

  const durationHours = (activeAt - inactiveAt) / (1000 * 60 * 60);

  // Condition 1: inactive duration must be >= 4 hours
  if (durationHours < MIN_SLEEP_HOURS) {
    return {sleep_hours: null, sleep_source: 'unknown'};
  }

  // Condition 2: no meaningful motion during the inferred sleep window.
  // We use the step count for the day as a proxy; if steps are available
  // and > 100, we consider there was meaningful motion and reject the heuristic.
  try {
    const steps = await getDailyStepCount(date);
    if (steps !== null && steps > 100) {
      // Too many steps recorded — can't reliably attribute to sleep.
      return {sleep_hours: null, sleep_source: 'unknown'};
    }
  } catch {
    // Pedometer unavailable — proceed without motion check.
  }

  const cappedHours = Math.min(durationHours, MAX_SLEEP_HOURS);
  return {
    sleep_hours: parseFloat(cappedHours.toFixed(2)),
    sleep_source: 'inferred',
  };
}
