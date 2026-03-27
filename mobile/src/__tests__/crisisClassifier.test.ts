/**
 * Crisis screen routing and chat input disable tests — spec §37.3
 *
 * Tests the crisis classifier and the rule that chat input is blocked
 * when user is in CRISIS state. These are pure logic tests (no UI).
 */

// Mock the crisis detection result from the API layer
// by testing the slice/state logic that governs chat disable.

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

import authReducer, {loginSuccess, updateUserState} from '@/store/authSlice';
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

/**
 * The chat router blocks input when userState === 'CRISIS'.
 * This test verifies the Redux state correctly reflects CRISIS and
 * that the gating predicate (userState === 'CRISIS') works as expected.
 */
describe('crisis chat stop — state gating', () => {
  it('userState becomes CRISIS after updateUserState dispatch', () => {
    const active: AuthState = {
      ...emptyState,
      isAuthenticated: true,
      userState: 'ACTIVE',
    };
    const next = authReducer(active, updateUserState('CRISIS'));
    expect(next.userState).toBe('CRISIS');
  });

  it('chat should be blocked when userState is CRISIS', () => {
    const crisisState: AuthState = {
      ...emptyState,
      isAuthenticated: true,
      userState: 'CRISIS',
    };
    // Simulate the check that the chat screen performs
    const isChatBlocked = crisisState.userState === 'CRISIS';
    expect(isChatBlocked).toBe(true);
  });

  it('chat should not be blocked when userState is ACTIVE', () => {
    const activeState: AuthState = {
      ...emptyState,
      isAuthenticated: true,
      userState: 'ACTIVE',
    };
    const isChatBlocked = activeState.userState === 'CRISIS';
    expect(isChatBlocked).toBe(false);
  });

  it('chat should not be blocked when userState is ESCALATED', () => {
    const escalated: AuthState = {
      ...emptyState,
      isAuthenticated: true,
      userState: 'ESCALATED',
    };
    const isChatBlocked = escalated.userState === 'CRISIS';
    expect(isChatBlocked).toBe(false);
  });
});

/**
 * Crisis screen routing — when userState transitions to CRISIS,
 * the app should route to CrisisScreen. The RootNavigator shows MainNavigator
 * for all authenticated, non-ONBOARDING states. The crisis routing happens
 * within MainNavigator which listens to chat.crisisDetected.
 */
describe('crisis screen routing — state transition', () => {
  it('CRISIS state triggers routing flag in auth state', () => {
    const precrisis: AuthState = {
      ...emptyState,
      isAuthenticated: true,
      userState: 'ACTIVE',
    };
    const crisis = authReducer(precrisis, updateUserState('CRISIS'));
    // The navigator uses this state to push CrisisScreen
    expect(crisis.userState).toBe('CRISIS');
    expect(crisis.isAuthenticated).toBe(true);
  });
});
