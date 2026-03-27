/**
 * Session guard hook (spec §11.3 + §11.5).
 *
 * Enforces:
 *   1. 30-minute idle timeout — if the app is inactive for 30 minutes,
 *      the user must re-authenticate before continuing.
 *   2. Biometric unlock — when biometrics are enabled, the idle timeout
 *      is resolved with a biometric prompt; otherwise the user is logged
 *      out and redirected to the login screen.
 *
 * Mount this hook in the root authenticated navigator so it runs whenever
 * the user is inside the main app.
 *
 * Note: the spec requires the 30-minute timeout to apply to "inactivity".
 * We track the last AppState transition to 'active' as the activity marker.
 * Background time counts toward the idle window.
 */
import {useEffect, useRef, useCallback} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import {useAppDispatch} from '@/store';
import {logout} from '@/store/authSlice';
import {
  isBiometricAvailable,
  isBiometricEnabled,
  promptBiometricUnlock,
} from '@/services/biometricService';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes (spec §11.3)

export function useSessionGuard() {
  const dispatch = useAppDispatch();
  const backgroundedAt = useRef<number | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const handleIdleExpiry = useCallback(async () => {
    // Try biometric unlock first; fall back to full logout.
    const biometricEnabled = isBiometricEnabled();
    const biometricAvailable = await isBiometricAvailable();

    if (biometricEnabled && biometricAvailable) {
      const unlocked = await promptBiometricUnlock();
      if (unlocked) {
        // User re-authenticated — reset the idle timer.
        resetIdleTimer();
        return;
      }
    }

    // Biometric not available / not enabled / failed — force full logout.
    dispatch(logout());
  }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetIdleTimer = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(handleIdleExpiry, IDLE_TIMEOUT_MS);
  }, [clearIdleTimer, handleIdleExpiry]);

  useEffect(() => {
    // Start the idle timer when the hook mounts (user just logged in / resumed).
    resetIdleTimer();

    const subscription = AppState.addEventListener(
      'change',
      async (nextState: AppStateStatus) => {
        if (nextState === 'background' || nextState === 'inactive') {
          backgroundedAt.current = Date.now();
          clearIdleTimer();
        } else if (nextState === 'active') {
          const backgroundedAtMs = backgroundedAt.current;
          backgroundedAt.current = null;

          if (backgroundedAtMs !== null) {
            const elapsed = Date.now() - backgroundedAtMs;
            if (elapsed >= IDLE_TIMEOUT_MS) {
              // App was in background for >= 30 minutes — treat as idle expiry.
              await handleIdleExpiry();
              return;
            }
          }

          // App returned to foreground before timeout — reset the timer.
          resetIdleTimer();
        }
      },
    );

    return () => {
      clearIdleTimer();
      subscription.remove();
    };
  }, [clearIdleTimer, handleIdleExpiry, resetIdleTimer]);
}
