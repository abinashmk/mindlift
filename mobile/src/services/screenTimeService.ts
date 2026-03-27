/**
 * Screen time collection service.
 *
 * Android: uses UsageStatsManager via the MindLiftScreenTime native module.
 *          Requires the user to grant "Usage Access" in Settings → Apps →
 *          Special App Access → Usage Access. Returns null if not granted.
 *
 * iOS: Apple's Screen Time API (FamilyControls / DeviceActivity framework)
 *      requires the `com.apple.developer.family-controls` entitlement, which
 *      requires separate Apple approval and is not available to standard apps.
 *      Always returns null on iOS per spec §18.5 ("if unavailable, send null").
 */
import {Platform, NativeModules} from 'react-native';
import {validateRange} from '@/utils/validators';

interface ScreenTimeModule {
  getTodayScreenMinutes(): Promise<number | null>;
}

function getNativeModule(): ScreenTimeModule | null {
  if (Platform.OS !== 'android') return null;
  const mod = NativeModules.MindLiftScreenTime as ScreenTimeModule | undefined;
  return mod ?? null;
}

/**
 * Return the total device screen-on time for today in minutes, or null when
 * unavailable (iOS, permission not granted, or unsupported device).
 */
export async function getTodayScreenTimeMinutes(): Promise<number | null> {
  const mod = getNativeModule();
  if (!mod) return null;

  try {
    const minutes = await mod.getTodayScreenMinutes();
    if (minutes === null) return null;
    return validateRange(minutes, 0, 1440);
  } catch (err) {
    console.warn('[screenTimeService] Failed to read screen time:', err);
    return null;
  }
}
