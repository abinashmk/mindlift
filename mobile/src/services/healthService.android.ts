/**
 * Android Health Connect implementation of the health service.
 *
 * Uses the `@kingstinct/react-native-healthconnect` package which bridges
 * Google Health Connect. Metro automatically selects this file over
 * healthService.ts on Android.
 *
 * Native setup required:
 *   1. npm install @kingstinct/react-native-healthconnect
 *   2. Add permission declarations to AndroidManifest.xml (see healthService.ts)
 *   3. Health Connect must be installed on device (Android 13) or built-in
 *      (Android 14+). Add a <queries> entry for the Health Connect package.
 *
 * See healthService.ts header for full setup instructions.
 */

import {
  initialize,
  requestPermission,
  readRecords,
  RecordResult,
} from '@kingstinct/react-native-healthconnect';
import {validateRange} from '@/utils/validators';
import type {HealthData} from './healthService';

// ─── Permission descriptors ───────────────────────────────────────────────────

const PERMISSIONS = [
  {accessType: 'read' as const, recordType: 'Steps' as const},
  {accessType: 'read' as const, recordType: 'HeartRate' as const},
  {accessType: 'read' as const, recordType: 'RestingHeartRate' as const},
  {accessType: 'read' as const, recordType: 'HeartRateVariability' as const},
  {accessType: 'read' as const, recordType: 'SleepSession' as const},
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Return an ISO-8601 string accepted by Health Connect (no ms component). */
function toHCDate(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Return the start of the calendar day (00:00:00Z in local wall-clock). */
function dayStart(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

/** Return the end of the calendar day (23:59:59 in local wall-clock). */
function dayEnd(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 0);
  return e;
}

// ─── Metric readers ───────────────────────────────────────────────────────────

async function readSteps(date: Date): Promise<number | null> {
  try {
    const result = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: toHCDate(dayStart(date)),
        endTime: toHCDate(dayEnd(date)),
      },
    });

    if (!result?.records || result.records.length === 0) return null;

    const total = (result.records as RecordResult<'Steps'>[]).reduce(
      (sum, r) => sum + (r.count ?? 0),
      0,
    );
    return validateRange(total, 0, 100000);
  } catch {
    return null;
  }
}

async function readRestingHeartRate(date: Date): Promise<number | null> {
  try {
    const result = await readRecords('RestingHeartRate', {
      timeRangeFilter: {
        operator: 'between',
        startTime: toHCDate(dayStart(date)),
        endTime: toHCDate(dayEnd(date)),
      },
    });

    if (!result?.records || result.records.length === 0) return null;

    const records = result.records as RecordResult<'RestingHeartRate'>[];
    // Use the last sample of the day
    const last = records[records.length - 1];
    const bpm = last?.beatsPerMinute ?? null;
    return validateRange(bpm, 20, 220);
  } catch {
    return null;
  }
}

async function readAverageHeartRate(date: Date): Promise<number | null> {
  try {
    const result = await readRecords('HeartRate', {
      timeRangeFilter: {
        operator: 'between',
        startTime: toHCDate(dayStart(date)),
        endTime: toHCDate(dayEnd(date)),
      },
    });

    if (!result?.records || result.records.length === 0) return null;

    const records = result.records as RecordResult<'HeartRate'>[];

    // HeartRate records contain a samples array with individual bpm readings
    const allBpm: number[] = [];
    for (const record of records) {
      if (Array.isArray(record.samples)) {
        for (const sample of record.samples) {
          const bpm = sample.beatsPerMinute;
          if (typeof bpm === 'number' && Number.isFinite(bpm)) {
            allBpm.push(bpm);
          }
        }
      }
    }

    if (allBpm.length === 0) return null;

    const mean = allBpm.reduce((sum, v) => sum + v, 0) / allBpm.length;
    return validateRange(mean, 20, 220);
  } catch {
    return null;
  }
}

async function readHrv(date: Date): Promise<number | null> {
  try {
    const result = await readRecords('HeartRateVariability', {
      timeRangeFilter: {
        operator: 'between',
        startTime: toHCDate(dayStart(date)),
        endTime: toHCDate(dayEnd(date)),
      },
    });

    if (!result?.records || result.records.length === 0) return null;

    const records = result.records as RecordResult<'HeartRateVariability'>[];
    // Use the last sample of the day; Health Connect stores RMSSD in ms
    const last = records[records.length - 1];
    const rmssd = last?.rmssd ?? null;
    return validateRange(rmssd, 0, 500);
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

    const result = await readRecords('SleepSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: toHCDate(windowStart),
        endTime: toHCDate(windowEnd),
      },
    });

    if (!result?.records || result.records.length === 0) {
      return {sleep_hours: null, sleep_source: 'unknown'};
    }

    const records = result.records as RecordResult<'SleepSession'>[];

    // Stage type constants used by Health Connect:
    //   0 = UNKNOWN, 1 = AWAKE, 2 = SLEEPING, 3 = OUT_OF_BED,
    //   4 = LIGHT, 5 = DEEP, 6 = REM
    // Treat stages 2, 4, 5, 6 as "asleep" time. Stage 1 (AWAKE) and
    // 3 (OUT_OF_BED) are excluded.
    const SLEEPING_STAGES = new Set([2, 4, 5, 6]);

    let totalMs = 0;

    for (const session of records) {
      if (Array.isArray(session.stages)) {
        for (const stage of session.stages) {
          if (!SLEEPING_STAGES.has(stage.stage)) continue;
          const start = new Date(stage.startTime).getTime();
          const end = new Date(stage.endTime).getTime();
          if (end > start) totalMs += end - start;
        }
      } else {
        // No stage breakdown — count the full session as sleeping time
        const start = new Date(session.startTime).getTime();
        const end = new Date(session.endTime).getTime();
        if (end > start) totalMs += end - start;
      }
    }

    if (totalMs === 0) return {sleep_hours: null, sleep_source: 'unknown'};

    // Cap raw sum at 12 hours before range validation
    const cappedMs = Math.min(totalMs, 12 * 60 * 60 * 1000);
    const hours = cappedMs / (60 * 60 * 1000);
    const validated = validateRange(hours, 0, 24);

    // Health Connect data always comes from a wearable or the Health Connect
    // aggregation layer (backed by wearable or phone pedometer).
    return {sleep_hours: validated, sleep_source: 'wearable'};
  } catch {
    return {sleep_hours: null, sleep_source: 'unknown'};
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check whether Health Connect is available and initialised on this device.
 */
export async function isHealthDataAvailable(): Promise<boolean> {
  try {
    const available = await initialize();
    return available;
  } catch {
    return false;
  }
}

/**
 * Request Health Connect read permissions for all metrics used by MindLift.
 * Returns true when all permissions were granted.
 */
export async function requestHealthPermissions(): Promise<boolean> {
  try {
    const granted = await requestPermission(PERMISSIONS);
    // requestPermission returns the list of actually-granted permissions
    return granted.length === PERMISSIONS.length;
  } catch {
    return false;
  }
}

/**
 * Read all health metrics for a single calendar day from Health Connect.
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
