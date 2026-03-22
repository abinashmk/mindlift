import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {UserState} from '@/types';
import {STORAGE_KEYS} from '@/utils/constants';
import {storage} from './storage';

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  userState: UserState | null;
  firstName: string | null;
  email: string | null;
  mfaTempToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

function loadFromStorage(): Partial<AuthState> {
  try {
    const accessToken = storage.getString(STORAGE_KEYS.ACCESS_TOKEN) ?? null;
    const refreshToken = storage.getString(STORAGE_KEYS.REFRESH_TOKEN) ?? null;
    const userId = storage.getString(STORAGE_KEYS.USER_ID) ?? null;
    const userStateRaw = storage.getString(STORAGE_KEYS.USER_STATE) ?? null;
    const firstName = storage.getString(STORAGE_KEYS.FIRST_NAME) ?? null;
    const userState = userStateRaw as UserState | null;
    return {
      accessToken,
      refreshToken,
      userId,
      userState,
      firstName,
      isAuthenticated: !!accessToken,
    };
  } catch {
    return {};
  }
}

const persisted = loadFromStorage();

const initialState: AuthState = {
  accessToken: persisted.accessToken ?? null,
  refreshToken: persisted.refreshToken ?? null,
  userId: persisted.userId ?? null,
  userState: persisted.userState ?? null,
  firstName: persisted.firstName ?? null,
  email: null,
  mfaTempToken: null,
  isAuthenticated: persisted.isAuthenticated ?? false,
  isLoading: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setMfaTempToken(state, action: PayloadAction<string>) {
      state.mfaTempToken = action.payload;
    },
    setPendingEmail(state, action: PayloadAction<string>) {
      state.email = action.payload;
    },
    loginSuccess(
      state,
      action: PayloadAction<{
        accessToken: string;
        refreshToken: string;
        userId: string;
        userState: UserState;
        firstName: string;
      }>,
    ) {
      const {accessToken, refreshToken, userId, userState, firstName} =
        action.payload;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
      state.userId = userId;
      state.userState = userState;
      state.firstName = firstName;
      state.isAuthenticated = true;
      state.mfaTempToken = null;
      state.isLoading = false;

      // Persist to MMKV
      storage.set(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      storage.set(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      storage.set(STORAGE_KEYS.USER_ID, userId);
      storage.set(STORAGE_KEYS.USER_STATE, userState);
      storage.set(STORAGE_KEYS.FIRST_NAME, firstName);
    },
    refreshTokenSuccess(
      state,
      action: PayloadAction<{accessToken: string; refreshToken: string}>,
    ) {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      storage.set(STORAGE_KEYS.ACCESS_TOKEN, action.payload.accessToken);
      storage.set(STORAGE_KEYS.REFRESH_TOKEN, action.payload.refreshToken);
    },
    updateUserState(state, action: PayloadAction<UserState>) {
      state.userState = action.payload;
      storage.set(STORAGE_KEYS.USER_STATE, action.payload);
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    logout(state) {
      state.accessToken = null;
      state.refreshToken = null;
      state.userId = null;
      state.userState = null;
      state.firstName = null;
      state.email = null;
      state.mfaTempToken = null;
      state.isAuthenticated = false;
      state.isLoading = false;

      // Clear MMKV
      storage.delete(STORAGE_KEYS.ACCESS_TOKEN);
      storage.delete(STORAGE_KEYS.REFRESH_TOKEN);
      storage.delete(STORAGE_KEYS.USER_ID);
      storage.delete(STORAGE_KEYS.USER_STATE);
      storage.delete(STORAGE_KEYS.FIRST_NAME);
    },
  },
});

export const {
  setMfaTempToken,
  setPendingEmail,
  loginSuccess,
  refreshTokenSuccess,
  updateUserState,
  setLoading,
  logout,
} = authSlice.actions;

export default authSlice.reducer;
