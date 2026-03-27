import {Platform, PermissionsAndroid, Permission} from 'react-native';
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  openSettings,
} from 'react-native-permissions';
import {PermissionResults} from '@/types';
import {requestHealthPermissions} from './healthService';

// ─── Android helpers (PermissionsAndroid) ────────────────────────────────────

async function requestAndroid(permission: Permission): Promise<boolean> {
  try {
    const result = await PermissionsAndroid.request(permission);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

async function checkAndroid(permission: Permission): Promise<boolean> {
  try {
    return await PermissionsAndroid.check(permission);
  } catch {
    return false;
  }
}

// ─── iOS helpers (react-native-permissions) ──────────────────────────────────

async function requestIOS(permission: string): Promise<boolean> {
  try {
    const result = await request(permission as any);
    return result === RESULTS.GRANTED || result === RESULTS.LIMITED;
  } catch {
    return false;
  }
}

async function checkIOS(permission: string): Promise<boolean> {
  try {
    const result = await check(permission as any);
    return result === RESULTS.GRANTED || result === RESULTS.LIMITED;
  } catch {
    return false;
  }
}

// ─── Public service ──────────────────────────────────────────────────────────

export const permissionService = {
  async requestMotion(): Promise<boolean> {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 29) {
        return requestAndroid(
          PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
        );
      }
      return true; // Granted by default on Android < 10
    }
    // iOS: CoreMotion
    return requestIOS(PERMISSIONS.IOS.MOTION);
  },

  async requestNotifications(): Promise<boolean> {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      return requestAndroid(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
    }
    // iOS: handled by notificationService (uses requestPermissions from
    // @react-native-community/push-notification-ios or Expo Notifications).
    // react-native-permissions mirrors the same underlying call here.
    if (Platform.OS === 'ios') {
      return requestIOS(PERMISSIONS.IOS.NOTIFICATIONS);
    }
    return true;
  },

  async requestHealth(): Promise<boolean> {
    // Delegated to the platform-specific health service
    // (HealthKit on iOS, Health Connect on Android).
    return requestHealthPermissions();
  },

  async requestLocation(): Promise<boolean> {
    if (Platform.OS === 'android') {
      return requestAndroid(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      );
    }
    // iOS: Core Location — when-in-use is sufficient for category detection.
    return requestIOS(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
  },

  async requestMicrophone(): Promise<boolean> {
    if (Platform.OS === 'android') {
      return requestAndroid(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    }
    // iOS: Microphone for ambient noise level sampling.
    return requestIOS(PERMISSIONS.IOS.MICROPHONE);
  },

  async checkMotion(): Promise<boolean> {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 29) {
        return checkAndroid(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION);
      }
      return true;
    }
    return checkIOS(PERMISSIONS.IOS.MOTION);
  },

  /**
   * Open the app's system settings page so the user can manually grant a
   * previously denied permission.
   */
  openAppSettings(): void {
    openSettings().catch(() => {});
  },

  /**
   * Request all required permissions and optionally health/location/microphone
   * based on consent choices made during onboarding.
   */
  async requestAll(options: {
    healthAccepted: boolean;
    locationAccepted: boolean;
    noiseAccepted: boolean;
  }): Promise<PermissionResults> {
    const motion = await permissionService.requestMotion();
    const notifications = await permissionService.requestNotifications();
    const health = options.healthAccepted
      ? await permissionService.requestHealth()
      : false;
    const location = options.locationAccepted
      ? await permissionService.requestLocation()
      : false;
    const microphone = options.noiseAccepted
      ? await permissionService.requestMicrophone()
      : false;

    return {motion, notifications, health, location, microphone};
  },
};
