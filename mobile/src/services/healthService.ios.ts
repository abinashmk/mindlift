/**
 * iOS HealthKit implementation of the health service.
 *
 * Uses the `react-native-health` package which bridges Apple HealthKit.
 * Metro automatically selects this file over healthService.ts on iOS.
 *
 * Native setup required:
 *   1. npm install react-native-health
 *   2. cd ios && pod install
 *   3. Enable HealthKit capability in Xcode
 *   4. Add NSHealthShareUsageDescription to Info.plist
 *
 * See healthService.ts header for full setup instructions.
 */

import AppleHealthKit, {
  HealthInputOptions,
  HealthKitPermissions,
  HealthValue,
  SleepSample,
} from 'react-native-health';
import {validateRange} from '@/utils/validators';
import type {HealthData} from './healthService';

// ─── Permission descriptor ────────────────────────────────────────────────────

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Steps,
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.RestingHeartRate,
      AppleHealthKit.Constants.Permissions.HeartRateVariability,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
    ],
    write: [],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a Date as the ISO-8601 string that react-native-health expects. */
function toISO(d: Date): string {
  return d.toISOString();
}

/** Return the start of the calendar day (00:00:00.000) for a given Date. */
function dayStart(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

/** Return the end of the calendar day (23:59:59.999) for a given Date. */
function dayEnd(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

/**
 * Heuristic to decide whether a sample came from a wearable device.
 * Apple Watch records its name in sourceName. This covers the most common case;
 * other wearables writing to HealthKit are treated as 'wearable' too.
 */
function isWearableSource(sourceName: string | undefined): boolean {
  if (!sourceName) return false;
  const lower = sourceName.toLowerCase();
  return lower.includes('watch') || lower.includes('fitbit') ||
    lower.includes('garmin') || lower.includes('oura') ||
    lower.includes('polar') || lower.includes('withings');
}

// ─── Promisified HealthKit calls ──────────────────────────────────────────────

function initHealthKit(): Promise<void> {
  return new Promise((resolve, reject) => {
    AppleHealthKit.initHealthKit(PERMISSIONS, (err) => {
      if (err) reject(new Error(err));
      else resolve();
    });
  });
}

function getStepCount(options: HealthInputOptions): Promise<HealthValue> {
  return new Promise((resolve, reject) => {
    AppleHealthKit.getStepCount(options, (err, result) => {
      if (err) reject(new Error(String(err)));
      else resolve(result);
    });
  });
}

function getRestingHeartRateSamples(
  options: HealthInputOptions,
): Promise<HealthValue[]> {
  return new Promise((resolve, reject) => {
    AppleHealthKit.getRestingHeartRateSamples(options, (err, results) => {
      if (err) reject(new Error(String(err)));
      else resolve(results);
    });
  });
}

function getHeartRateSamples(
  options: HealthInputOptions,
): Promise<HealthValue[]> {
  return new Promise((resolve, reject) => {
    AppleHealthKit.getHeartRateSamples(options, (err, results) => {
      if (err) reject(new Error(String(err)));
      else resolve(results);
    });
  });
}

function getHeartRateVariabilitySamples(
  options: HealthInputOptions,
): Promise<HealthValue[]> {
  return new Promise((resolve, reject) => {
    AppleHealthKit.getHeartRateVariabilitySamples(options, (err, results) => {
      if (err) reject(new Error(String(err)));
      else resolve(results);
    });
  });
}

function getSleepSamples(options: HealthInputOptions): Promise<SleepSample[]> {
  return new Promise((resolve, reject) => {
    AppleHealthKit.getSleepSamples(options, (err, results) => {
      if (err) reject(new Error(String(err)));
      else resolve(results);
    });
  });
}

// ─── Metric readers ───────────────────────────────────────────────────────────

async function readSteps(date: Date): Promise<number | null> {
  try {
    const result = await getStepCount({
      date: toISO(dayStart(date)),
      includeManuallyAdded: false,
    });
    const steps = result?.value ?? null;
    return validateRange(steps, 0, 100000);
  } catch {
    return null;
  }
}

async function readRestingHeartRate(date: Date): Promise<number | null> {
  try {
    const samples = await getRestingHeartRateSamples({
      startDate: toISO(dayStart(date)),
      endDate: toISO(dayEnd(date)),
      ascending: false,
      limit: 1,
    });
    if (!samples || samples.length === 0) return null;
    const value = samples[0].value ?? null;
    return validateRange(value, 20, 220);
  } catch {
    return null;
  }
}

async function readAverageHeartRate(date: Date): Promise<number | null> {
  try {
    // Waking hours window: 07:00–22:00 local time
    const wakingStart = new Date(date);
    wakingStart.setHours(7, 0, 0, 0);
    const wakingEnd = new Date(date);
    wakingEnd.setHours(22, 0, 0, 0);

    const samples = await getHeartRateSamples({
      startDate: toISO(wakingStart),
      endDate: toISO(wakingEnd),
      ascending: true,
    });
    if (!samples || samples.length === 0) return null;

    const validValues = samples
      .map(s => s.value)
      .filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));

    if (validValues.length === 0) return null;

    const mean = validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
    return validateRange(mean, 20, 220);
  } catch {
    return null;
  }
}

async function readHrv(date: Date): Promise<number | null> {
  try {
    const samples = await getHeartRateVariabilitySamples({
      startDate: toISO(dayStart(date)),
      endDate: toISO(dayEnd(date)),
      ascending: false,
      limit: 1,
    });
    if (!samples || samples.length === 0) return null;
    // react-native-health returns HRV SDNN in milliseconds
    const value = samples[0].value ?? null;
    return validateRange(value, 0, 500);
  } catch {
    return null;
  }
}

interface SleepResult {
  sleep_hours: number | null;
  sleep_source: HealthData['sleep_source'];
}

async function readSleep(date: Date): Promise<SleepResult> {
  try {
    // Night window: 18:00 of the previous day → 12:00 of the current day
    const windowStart = new Date(date);
    windowStart.setDate(windowStart.getDate() - 1);
    windowStart.setHours(18, 0, 0, 0);

    const windowEnd = new Date(date);
    windowEnd.setHours(12, 0, 0, 0);

    const samples = await getSleepSamples({
      startDate: toISO(windowStart),
      endDate: toISO(windowEnd),
    });

    if (!samples || samples.length === 0) {
      return {sleep_hours: null, sleep_source: 'unknown'};
    }

    // Sum ASLEEP duration segments only (value === 'ASLEEP' or category 1)
    let totalMs = 0;
    let fromWearable = false;

    for (const sample of samples) {
      // react-native-health encodes the HealthKit sleep category:
      //   0 = InBed, 1 = Asleep, 2 = Awake, 3 = Core, 4 = Deep, 5 = REM
      // Treat category 1, 3, 4, 5 as "asleep" stages; skip InBed (0) and Awake (2)
      const category = typeof sample.value === 'number'
        ? sample.value
        : null;

      const isAsleepStage =
        category === 1 || category === 3 || category === 4 || category === 5;

      if (!isAsleepStage) continue;

      const start = new Date(sample.startDate).getTime();
      const end = new Date(sample.endDate).getTime();
      if (end > start) {
        totalMs += end - start;
      }

      if (!fromWearable && isWearableSource(sample.sourceName)) {
        fromWearable = true;
      }
    }

    if (totalMs === 0) return {sleep_hours: null, sleep_source: 'unknown'};

    // Cap raw sum at 12 hours before range validation
    const cappedMs = Math.min(totalMs, 12 * 60 * 60 * 1000);
    const hours = cappedMs / (60 * 60 * 1000);
    const validated = validateRange(hours, 0, 24);

    return {
      sleep_hours: validated,
      sleep_source: fromWearable ? 'wearable' : 'inferred',
    };
  } catch {
    return {sleep_hours: null, sleep_source: 'unknown'};
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check whether HealthKit is available on this device.
 */
export async function isHealthDataAvailable(): Promise<boolean> {
  return new Promise(resolve => {
    AppleHealthKit.isAvailable((err, available) => {
      resolve(!err && available);
    });
  });
}

/**
 * Request HealthKit read permissions for all metrics used by MindLift.
 * Returns true when all permissions were granted.
 */
export async function requestHealthPermissions(): Promise<boolean> {
  try {
    await initHealthKit();
    return true;
  } catch {
    return false;
  }
}

/**
 * Read all health metrics for a single calendar day from HealthKit.
 *
 * @param date  The day to read. Time components are ignored.
 * @returns     A `HealthData` object. Any unavailable or out-of-range field is
 *              null. Never throws.
 */
export async function readDailyHealthData(date: Date): Promise<HealthData> {
  const [steps, restingHr, avgHr, hrv, sleepResult] = await Promise.all([
    readSteps(date),
    readRestingHeartRate(date),
    readAverageHeartRate(date),
    readHrv(date),
    readSleep(date),
  ]);

  return {
    steps,
    resting_heart_rate_bpm: restingHr,
    average_heart_rate_bpm: avgHr,
    hrv_ms: hrv,
    sleep_hours: sleepResult.sleep_hours,
    sleep_source: sleepResult.sleep_source,
  };
}
