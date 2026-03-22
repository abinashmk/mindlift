import {Platform, PermissionsAndroid, Permission} from 'react-native';
import {PermissionResults} from '@/types';
import {requestHealthPermissions} from './healthService';

// On iOS these would use react-native-permissions in a real app.
// For this implementation we provide the full service interface
// and use PermissionsAndroid where available.

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

export const permissionService = {
  async requestMotion(): Promise<boolean> {
    if (Platform.OS === 'android') {
      // Activity recognition requires API 29+
      if (Platform.Version >= 29) {
        return requestAndroid(
          PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
        );
      }
      return true; // Granted by default on older Android
    }
    // iOS: CoreMotion — would use react-native-permissions in production
    // Returning true as placeholder (native module required)
    return true;
  },

  async requestNotifications(): Promise<boolean> {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      return requestAndroid(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
    }
    // iOS handled by notificationService
    return true;
  },

  async requestHealth(): Promise<boolean> {
    // Delegate to the platform-specific health service (HealthKit on iOS,
    // Health Connect on Android). The platform file is resolved by Metro.
    return requestHealthPermissions();
  },

  async requestLocation(): Promise<boolean> {
    if (Platform.OS === 'android') {
      return requestAndroid(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      );
    }
    // iOS: Core Location — native module required
    return false;
  },

  async requestMicrophone(): Promise<boolean> {
    if (Platform.OS === 'android') {
      return requestAndroid(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
    }
    // iOS: Microphone — native module required
    return false;
  },

  async checkMotion(): Promise<boolean> {
    if (Platform.OS === 'android' && Platform.Version >= 29) {
      return checkAndroid(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION);
    }
    return true;
  },

  /**
   * Request all required permissions and optionally health/location/microphone
   * based on consent choices.
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
