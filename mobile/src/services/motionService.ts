/**
 * Step-count fallback service.
 *
 * Provides a `getDailyStepCount` function that reads steps directly from the
 * platform motion/pedometer APIs without going through HealthKit or Health
 * Connect. Useful when health permissions are denied but activity recognition
 * permission is granted.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Native setup required
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * iOS (CMPedometer via NativeModules):
 *   This file uses a lightweight NativeModule stub. For production use:
 *   1. Create ios/MindLiftPedometer.swift (or .m) that wraps CMPedometer:
 *        @objc(MindLiftPedometer)
 *        class MindLiftPedometer: NSObject {
 *          @objc func querySteps(_ startISO: String, endISO: String,
 *                                resolver: @escaping RCTPromiseResolveBlock,
 *                                rejecter: @escaping RCTPromiseRejectBlock) {
 *            let pedometer = CMPedometer()
 *            // ... parse dates, call queryPedometerData, resolve with steps
 *          }
 *        }
 *   2. Register the module in AppDelegate or a RCT_EXTERN_MODULE macro.
 *   3. Add NSMotionUsageDescription to Info.plist.
 *   4. Request motion permission via permissionService.requestMotion() first.
 *
 * Android (SensorManager TYPE_STEP_COUNTER via NativeModules):
 *   1. Create android/app/src/main/java/.../MindLiftPedometerModule.kt that
 *      registers a Sensor.TYPE_STEP_COUNTER listener and accumulates steps.
 *   2. Expose a getStepsSince(startEpoch: Double, promise: Promise) method.
 *   3. Register in a ReactPackage and add to MainApplication.
 *   4. Add android:name="android.permission.ACTIVITY_RECOGNITION" to manifest
 *      (already handled by permissionService.requestMotion()).
 *
 * Until those native modules exist, this service returns null gracefully.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {Platform, NativeModules} from 'react-native';
import {validateRange} from '@/utils/validators';

// Typed interface for the expected native module shape
interface MindLiftPedometerModule {
  querySteps(startISO: string, endISO: string): Promise<number>;
}

function getNativeModule(): MindLiftPedometerModule | null {
  const mod = NativeModules.MindLiftPedometer as MindLiftPedometerModule | undefined;
  return mod ?? null;
}

/**
 * Return the total step count for a calendar day using the platform's
 * built-in motion sensor (CMPedometer on iOS, SensorManager on Android).
 *
 * Returns null when:
 * - The native module has not been linked (see setup notes above)
 * - Motion permission is denied
 * - The platform does not support pedometer queries
 * - Any other error occurs
 *
 * @param date  The calendar day to query. Time components are ignored.
 */
export async function getDailyStepCount(date: Date): Promise<number | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return null;
  }

  const nativeModule = getNativeModule();
  if (!nativeModule) {
    return null;
  }

  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const steps = await nativeModule.querySteps(
      startOfDay.toISOString(),
      endOfDay.toISOString(),
    );

    return validateRange(steps, 0, 100000);
  } catch (err) {
    console.warn('[motionService] Failed to read step count:', err);
    return null;
  }
}
