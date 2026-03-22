/**
 * Unified health data abstraction layer.
 *
 * This module is the platform router: React Native's Metro bundler resolves
 * platform-specific variants automatically —
 *   healthService.ios.ts     → loaded on iOS
 *   healthService.android.ts → loaded on Android
 *
 * This file provides the shared TypeScript types and a fallback no-op
 * implementation for environments where neither platform file is resolved
 * (e.g. tests, web storybook).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Required native setup
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * iOS:
 *   1. npm install react-native-health
 *   2. cd ios && pod install
 *   3. Add the HealthKit capability to the Xcode project:
 *      Xcode → Target → Signing & Capabilities → + Capability → HealthKit
 *   4. Add usage descriptions to ios/<AppName>/Info.plist:
 *        <key>NSHealthShareUsageDescription</key>
 *        <string>MindLift reads steps, heart rate, HRV and sleep to track your wellbeing.</string>
 *        <key>NSHealthUpdateUsageDescription</key>
 *        <string>MindLift does not write health data.</string>
 *
 * Android:
 *   1. npm install @kingstinct/react-native-healthconnect
 *   2. Add permissions to android/app/src/main/AndroidManifest.xml:
 *        <uses-permission android:name="android.permission.health.READ_STEPS" />
 *        <uses-permission android:name="android.permission.health.READ_HEART_RATE" />
 *        <uses-permission android:name="android.permission.health.READ_RESTING_HEART_RATE" />
 *        <uses-permission android:name="android.permission.health.READ_HEART_RATE_VARIABILITY" />
 *        <uses-permission android:name="android.permission.health.READ_SLEEP" />
 *   3. Health Connect app must be installed on the device (Android 13) or is
 *      built-in (Android 14+). Add to AndroidManifest.xml inside <queries>:
 *        <package android:name="com.google.android.apps.healthdata" />
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * Normalised daily health snapshot returned by `readDailyHealthData`.
 * Any field that is unavailable, permission-denied, or out of the accepted
 * range is represented as `null` — never clamped to a boundary value.
 */
export interface HealthData {
  /** Total steps recorded for the calendar day. Valid range: 0–100 000. */
  steps: number | null;
  /** Most-recent resting heart rate sample for the day, in bpm. Range: 20–220. */
  resting_heart_rate_bpm: number | null;
  /** Arithmetic mean of waking-hours (07:00–22:00) heart-rate samples, in bpm. Range: 20–220. */
  average_heart_rate_bpm: number | null;
  /** Most-recent HRV (SDNN/RMSSD) sample for the day, in milliseconds. Range: 0–500. */
  hrv_ms: number | null;
  /** Total sleep duration for the night (18:00 prev day → 12:00 current day), in hours. Range: 0–24. */
  sleep_hours: number | null;
  /** Provenance of the sleep_hours value. */
  sleep_source: 'wearable' | 'inferred' | 'manual' | 'unknown';
}

// ─── Fallback no-op implementation ────────────────────────────────────────────
// The platform-specific files (healthService.ios.ts / healthService.android.ts)
// override every export below when bundled for their respective platforms.

/**
 * Check whether the health data framework is available on this device.
 * Returns false in the fallback/web environment.
 */
export async function isHealthDataAvailable(): Promise<boolean> {
  return false;
}

/**
 * Request OS-level permissions for the health data types that MindLift reads.
 * Returns true if all permissions were granted, false otherwise.
 *
 * Must be called before `readDailyHealthData` on first use, typically during
 * the onboarding permission-setup screen.
 */
export async function requestHealthPermissions(): Promise<boolean> {
  return false;
}

/**
 * Read all health metrics for a single calendar day.
 *
 * @param date  The day to read. Time components are ignored — the full
 *              calendar day (midnight to midnight, local time) is used.
 * @returns     A `HealthData` object where unavailable or out-of-range fields
 *              are `null`. Never throws — errors are caught internally.
 */
export async function readDailyHealthData(date: Date): Promise<HealthData> {
  void date; // unused in fallback
  return {
    steps: null,
    resting_heart_rate_bpm: null,
    average_heart_rate_bpm: null,
    hrv_ms: null,
    sleep_hours: null,
    sleep_source: 'unknown',
  };
}
