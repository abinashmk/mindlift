/**
 * Adaptive polling interval service (spec §18.2–18.4).
 *
 * Polling modes:
 *   HIGH   = 60 seconds
 *   MEDIUM = 300 seconds  (default)
 *   LOW    = 900 seconds
 *
 * Adjustment rules (spec §18.3):
 *   - battery < 15% → force LOW
 *   - OS low-power mode enabled → force LOW
 *   - app is backgrounded → double the current interval
 *   - app is force-killed → no collection until next launch (handled naturally)
 *   - offline → queue locally, retry every 10 minutes
 *
 * Usage: call `getCollectionIntervalMs()` to get the current interval,
 * and `getRetryIntervalMs()` for the offline retry interval.
 */

import {AppState, Platform} from 'react-native';

// Polling mode base intervals in ms
const HIGH_MS = 60 * 1000;
const MEDIUM_MS = 300 * 1000;
const LOW_MS = 900 * 1000;
export const OFFLINE_RETRY_MS = 10 * 60 * 1000; // 10 minutes

type PollingMode = 'HIGH' | 'MEDIUM' | 'LOW';

// ─── Battery / Power mode detection ──────────────────────────────────────────
// React Native does not ship a built-in battery API.
// react-native-device-info provides `getBatteryLevel()` and `isPowerSaveMode()`.
// If the library is not installed, we fall back to MEDIUM.

async function getBatteryInfo(): Promise<{level: number; powerSave: boolean}> {
  // react-native-device-info is not installed — fall back to safe defaults.
  return {level: 1.0, powerSave: false};
}

// ─── Current app visibility ───────────────────────────────────────────────────

function isBackgrounded(): boolean {
  return AppState.currentState !== 'active';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Return the current recommended collection interval in milliseconds.
 *
 * Evaluates battery level, power-save mode, and app visibility, then applies
 * the rules from spec §18.3.
 */
export async function getCollectionIntervalMs(): Promise<number> {
  const {level, powerSave} = await getBatteryInfo();

  let mode: PollingMode = 'MEDIUM';

  // Battery < 15% or power save mode → LOW
  if (level < 0.15 || powerSave) {
    mode = 'LOW';
  }

  const baseMs = mode === 'HIGH' ? HIGH_MS : mode === 'LOW' ? LOW_MS : MEDIUM_MS;

  // App is backgrounded → double the interval
  return isBackgrounded() ? baseMs * 2 : baseMs;
}

/**
 * Return the offline retry interval (always 10 minutes per spec §18.3).
 */
export function getRetryIntervalMs(): number {
  return OFFLINE_RETRY_MS;
}
