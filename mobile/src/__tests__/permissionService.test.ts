/**
 * Permission service — denied permissions behavior — spec §37.3
 *
 * Tests that requestAll returns false for denied permissions and that
 * the service handles exceptions gracefully.
 */

import {Platform} from 'react-native';

// Mock react-native-permissions before importing permissionService
jest.mock('react-native-permissions', () => ({
  check: jest.fn(),
  request: jest.fn(),
  PERMISSIONS: {
    IOS: {
      MOTION: 'ios.permission.MOTION',
      MICROPHONE: 'ios.permission.MICROPHONE',
      LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE',
      NOTIFICATIONS: 'ios.permission.NOTIFICATIONS',
    },
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
    LIMITED: 'limited',
    UNAVAILABLE: 'unavailable',
  },
  openSettings: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/services/healthService', () => ({
  requestHealthPermissions: jest.fn(() => Promise.resolve(false)),
  isHealthDataAvailable: jest.fn(() => Promise.resolve(false)),
  readDailyHealthData: jest.fn(),
}));

import {permissionService} from '@/services/permissionService';
import {request, RESULTS} from 'react-native-permissions';

const mockRequest = request as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('permissionService — denied permissions', () => {
  it('requestAll returns false for denied motion on iOS', async () => {
    // Simulate iOS
    Object.defineProperty(Platform, 'OS', {value: 'ios', writable: true});

    mockRequest.mockResolvedValue(RESULTS.DENIED);

    const results = await permissionService.requestAll({
      healthAccepted: false,
      locationAccepted: false,
      noiseAccepted: false,
    });

    expect(results.motion).toBe(false);
    expect(results.notifications).toBe(false);
    expect(results.health).toBe(false);
    expect(results.location).toBe(false);
    expect(results.microphone).toBe(false);
  });

  it('requestAll skips optional permissions when consent not given', async () => {
    Object.defineProperty(Platform, 'OS', {value: 'ios', writable: true});
    mockRequest.mockResolvedValue(RESULTS.GRANTED);

    const results = await permissionService.requestAll({
      healthAccepted: false,
      locationAccepted: false,
      noiseAccepted: false,
    });

    // health, location, microphone should be false (not requested)
    expect(results.health).toBe(false);
    expect(results.location).toBe(false);
    expect(results.microphone).toBe(false);
  });

  it('requestMotion returns false on exception', async () => {
    Object.defineProperty(Platform, 'OS', {value: 'ios', writable: true});
    mockRequest.mockRejectedValue(new Error('permission denied'));

    const result = await permissionService.requestMotion();
    expect(result).toBe(false);
  });
});
