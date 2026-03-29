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

import {AppState} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import DeviceInfo from 'react-native-device-info';

// Polling mode base intervals in ms
const HIGH_MS = 60 * 1000;
const MEDIUM_MS = 300 * 1000;
const LOW_MS = 900 * 1000;
export const OFFLINE_RETRY_MS = 10 * 60 * 1000; // 10 minutes

type PollingMode = 'HIGH' | 'MEDIUM' | 'LOW';

// ─── Battery / Power mode detection ──────────────────────────────────────────

async function getBatteryInfo(): Promise<{level: number; powerSave: boolean}> {
  try {
    const [level, powerSave] = await Promise.all([
      DeviceInfo.getBatteryLevel(),
      DeviceInfo.isPowerSaveMode(),
    ]);
    return {
      // getBatteryLevel() returns -1 on simulators / devices without a battery
      level: level < 0 ? 1.0 : level,
      powerSave,
    };
  } catch {
    // Native module unavailable — safe fallback: assume full battery, no power save
    return {level: 1.0, powerSave: false};
  }
}

// ─── Current app visibility ───────────────────────────────────────────────────

function isBackgrounded(): boolean {
  return AppState.currentState !== 'active';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Return the current recommended collection interval in milliseconds.
 *
 * When offline: always returns OFFLINE_RETRY_MS (10 min) per spec §18.3.
 * When online: evaluates battery level, power-save mode, and app visibility.
 */
export async function getCollectionIntervalMs(): Promise<number> {
  // Offline → fixed 10-minute retry regardless of battery or visibility
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    return OFFLINE_RETRY_MS;
  }

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
