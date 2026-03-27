/**
 * Auth slice tests — onboarding routing and LIMITED state — spec §37.3
 *
 * Tests that:
 *  - loginSuccess sets isAuthenticated and userState
 *  - ONBOARDING state is reflected in userState
 *  - LIMITED state is reflected correctly
 *  - logout clears all auth state
 */

// Mock MMKV storage
jest.mock('@/store/storage', () => ({
  storage: {
    getString: jest.fn(() => null),
    set: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('@/utils/constants', () => ({
  STORAGE_KEYS: {
    ACCESS_TOKEN: 'access_token',
    REFRESH_TOKEN: 'refresh_token',
    USER_ID: 'user_id',
    USER_STATE: 'user_state',
    FIRST_NAME: 'first_name',
    METRIC_QUEUE: 'metric_queue',
  },
}));

import authReducer, {
  loginSuccess,
  logout,
  updateUserState,
} from '@/store/authSlice';
import type {AuthState} from '@/store/authSlice';

const emptyState: AuthState = {
  accessToken: null,
  refreshToken: null,
  userId: null,
  userState: null,
  firstName: null,
  email: null,
  mfaTempToken: null,
  isAuthenticated: false,
  isLoading: false,
};

describe('authSlice — onboarding flow', () => {
  it('loginSuccess sets isAuthenticated true and ONBOARDING state', () => {
    const next = authReducer(
      emptyState,
      loginSuccess({
        accessToken: 'token123',
        refreshToken: 'refresh123',
        userId: 'u-1',
        userState: 'ONBOARDING',
        firstName: 'Alice',
      }),
    );
    expect(next.isAuthenticated).toBe(true);
    expect(next.userState).toBe('ONBOARDING');
    expect(next.firstName).toBe('Alice');
  });

  it('transitions from ONBOARDING to ACTIVE via updateUserState', () => {
    const onboardingState: AuthState = {
      ...emptyState,
      isAuthenticated: true,
      userState: 'ONBOARDING',
    };
    const next = authReducer(onboardingState, updateUserState('ACTIVE'));
    expect(next.userState).toBe('ACTIVE');
  });
});

describe('authSlice — LIMITED state', () => {
  it('reflects LIMITED state after login with LIMITED userState', () => {
    const next = authReducer(
      emptyState,
      loginSuccess({
        accessToken: 'tok',
        refreshToken: 'ref',
        userId: 'u-2',
        userState: 'LIMITED',
        firstName: 'Bob',
      }),
    );
    expect(next.userState).toBe('LIMITED');
    expect(next.isAuthenticated).toBe(true);
  });

  it('can transition from LIMITED back to ACTIVE', () => {
    const limitedState: AuthState = {
      ...emptyState,
      isAuthenticated: true,
      userState: 'LIMITED',
    };
    const next = authReducer(limitedState, updateUserState('ACTIVE'));
    expect(next.userState).toBe('ACTIVE');
  });
});

describe('authSlice — logout', () => {
  it('logout clears all auth state', () => {
    const loggedIn: AuthState = {
      ...emptyState,
      accessToken: 'tok',
      refreshToken: 'ref',
      userId: 'u-3',
      userState: 'ACTIVE',
      firstName: 'Carol',
      isAuthenticated: true,
    };
    const next = authReducer(loggedIn, logout());
    expect(next.isAuthenticated).toBe(false);
    expect(next.accessToken).toBeNull();
    expect(next.userId).toBeNull();
    expect(next.userState).toBeNull();
  });
});
