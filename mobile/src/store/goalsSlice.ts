import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export interface CustomGoal {
  id: string;
  label: string;
  done: boolean;
  date: string; // ISO date string YYYY-MM-DD
}

interface GoalsState {
  customGoals: CustomGoal[];
  lastResetDate: string; // custom goals are per-day; reset when date changes
}

const initialState: GoalsState = {
  customGoals: [],
  lastResetDate: '',
};

const goalsSlice = createSlice({
  name: 'goals',
  initialState,
  reducers: {
    addCustomGoal(state, action: PayloadAction<{id: string; label: string; date: string}>) {
      state.customGoals.push({
        id: action.payload.id,
        label: action.payload.label,
        done: false,
        date: action.payload.date,
      });
      state.lastResetDate = action.payload.date;
    },
    toggleCustomGoal(state, action: PayloadAction<string>) {
      const goal = state.customGoals.find(g => g.id === action.payload);
      if (goal) goal.done = !goal.done;
    },
    removeCustomGoal(state, action: PayloadAction<string>) {
      state.customGoals = state.customGoals.filter(g => g.id !== action.payload);
    },
    // Called on focus to clear goals from previous days
    pruneOldGoals(state, action: PayloadAction<string>) {
      state.customGoals = state.customGoals.filter(g => g.date === action.payload);
      state.lastResetDate = action.payload;
    },
  },
});

export const {addCustomGoal, toggleCustomGoal, removeCustomGoal, pruneOldGoals} =
  goalsSlice.actions;
export default goalsSlice.reducer;
