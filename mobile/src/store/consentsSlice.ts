/**
 * Consents slice — tracks the user's current optional data-collection consents.
 *
 * When an optional consent is revoked, collection for that signal stops
 * immediately (the metric sync hook reads from this slice before collecting).
 * Previously stored data is kept until export or deletion (spec §10.4).
 */
import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {storage} from './storage';

const STORAGE_KEY = 'consents.optional';

export interface ConsentsState {
  health_data_accepted: boolean;
  location_category_accepted: boolean;
  noise_level_accepted: boolean;
  chat_logging_accepted: boolean;
}

function loadFromStorage(): ConsentsState {
  try {
    const raw = storage.getString(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    health_data_accepted: false,
    location_category_accepted: false,
    noise_level_accepted: false,
    chat_logging_accepted: true,
  };
}

function persist(state: ConsentsState): void {
  storage.set(STORAGE_KEY, JSON.stringify(state));
}

const consentsSlice = createSlice({
  name: 'consents',
  initialState: loadFromStorage(),
  reducers: {
    /**
     * Bulk-set all consent flags after onboarding or a consent update.
     * Persists to MMKV immediately.
     */
    setConsents(state, action: PayloadAction<Partial<ConsentsState>>) {
      Object.assign(state, action.payload);
      persist({...state});
    },
    /**
     * Revoke a single optional consent key.
     * Collection for that signal stops on the next sync cycle.
     */
    revokeConsent(
      state,
      action: PayloadAction<keyof ConsentsState>,
    ) {
      state[action.payload] = false;
      persist({...state});
    },
  },
});

export const {setConsents, revokeConsent} = consentsSlice.actions;
export default consentsSlice.reducer;
