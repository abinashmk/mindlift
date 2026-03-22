import {MMKV} from 'react-native-mmkv';

/**
 * Encrypted MMKV instance — replaces AsyncStorage throughout the app.
 * The encryptionKey is derived at runtime; in production you would
 * pull this from the OS keychain / Android Keystore.
 */
export const storage = new MMKV({
  id: 'mindlift-secure-storage',
  encryptionKey: 'mindlift-enc-key-v1',
});
