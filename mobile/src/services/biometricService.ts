/**
 * Biometric unlock service (spec §11.5).
 *
 * Biometrics are used ONLY for local device session unlock after a successful
 * prior login. They do NOT bypass backend authentication on first login.
 *
 * Uses react-native-biometrics which wraps:
 *   iOS  — Touch ID / Face ID (LocalAuthentication framework)
 *   Android — BiometricPrompt API
 */
import ReactNativeBiometrics, {BiometryTypes} from 'react-native-biometrics';
import {MMKV} from 'react-native-mmkv';

const rnBiometrics = new ReactNativeBiometrics({allowDeviceCredentials: false});
const storage = new MMKV({id: 'mindlift-biometric'});

const BIOMETRIC_ENABLED_KEY = 'biometric.enabled';

/**
 * Check whether the device has biometric hardware and enrolled credentials.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const {available} = await rnBiometrics.isSensorAvailable();
    return available;
  } catch {
    return false;
  }
}

/**
 * Return the biometric type label for display purposes (e.g. "Face ID").
 */
export async function getBiometricLabel(): Promise<string> {
  try {
    const {biometryType} = await rnBiometrics.isSensorAvailable();
    if (biometryType === BiometryTypes.FaceID) return 'Face ID';
    if (biometryType === BiometryTypes.TouchID) return 'Touch ID';
    if (biometryType === BiometryTypes.Biometrics) return 'Fingerprint';
  } catch {}
  return 'Biometrics';
}

/**
 * Return whether the user has opted in to biometric unlock.
 */
export function isBiometricEnabled(): boolean {
  return storage.getBoolean(BIOMETRIC_ENABLED_KEY) ?? false;
}

/**
 * Persist the user's biometric unlock preference.
 */
export function setBiometricEnabled(enabled: boolean): void {
  storage.set(BIOMETRIC_ENABLED_KEY, enabled);
}

/**
 * Prompt the user for biometric authentication to unlock the local session.
 *
 * Returns true if authentication succeeded, false if the user cancelled or
 * the sensor failed. Throws only on unexpected errors.
 *
 * Per spec §11.5: this must NOT replace the backend login on a first login or
 * new device. It is only used after an idle timeout to re-verify local identity.
 */
export async function promptBiometricUnlock(): Promise<boolean> {
  try {
    const {success} = await rnBiometrics.simplePrompt({
      promptMessage: 'Unlock MindLift',
      cancelButtonText: 'Use password instead',
    });
    return success;
  } catch {
    return false;
  }
}
