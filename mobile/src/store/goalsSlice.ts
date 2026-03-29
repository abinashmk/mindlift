import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {storage} from './storage';

export interface CustomGoal {
  id: string;
  label: string;
  done: boolean;
  date: string; // YYYY-MM-DD
}

interface GoalsState {
  customGoals: CustomGoal[];
  lastResetDate: string;
}

const STORAGE_KEY = 'goals_state';

function loadFromStorage(): GoalsState {
  try {
    const raw = storage.getString(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {customGoals: [], lastResetDate: ''};
}

function persist(state: GoalsState): void {
  try {
    storage.set(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

const initialState: GoalsState = loadFromStorage();

const goalsSlice = createSlice({
  name: 'goals',
  initialState,
  reducers: {
    addCustomGoal(
      state,
      action: PayloadAction<{id: string; label: string; date: string}>,
    ) {
      state.customGoals.push({
        id: action.payload.id,
        label: action.payload.label,
        done: false,
        date: action.payload.date,
      });
      state.lastResetDate = action.payload.date;
      persist({...state, customGoals: [...state.customGoals]});
    },
    toggleCustomGoal(state, action: PayloadAction<string>) {
      const goal = state.customGoals.find(g => g.id === action.payload);
      if (goal) {
        goal.done = !goal.done;
        persist({...state, customGoals: [...state.customGoals]});
      }
    },
    removeCustomGoal(state, action: PayloadAction<string>) {
      state.customGoals = state.customGoals.filter(g => g.id !== action.payload);
      persist({...state, customGoals: [...state.customGoals]});
    },
    pruneOldGoals(state, action: PayloadAction<string>) {
      state.customGoals = state.customGoals.filter(
        g => g.date === action.payload,
      );
      state.lastResetDate = action.payload;
      persist({...state, customGoals: [...state.customGoals]});
    },
  },
});

export const {addCustomGoal, toggleCustomGoal, removeCustomGoal, pruneOldGoals} =
  goalsSlice.actions;
export default goalsSlice.reducer;
