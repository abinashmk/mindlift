import {createSlice, PayloadAction} from '@reduxjs/toolkit';

interface CalendarState {
  connected: boolean;
  userEmail: string | null;
  todayMeetingHours: number | null;
  lastSyncedDate: string | null; // ISO date string YYYY-MM-DD
}

const initialState: CalendarState = {
  connected: false,
  userEmail: null,
  todayMeetingHours: null,
  lastSyncedDate: null,
};

const calendarSlice = createSlice({
  name: 'calendar',
  initialState,
  reducers: {
    setCalendarConnected(
      state,
      action: PayloadAction<{userEmail: string}>,
    ) {
      state.connected = true;
      state.userEmail = action.payload.userEmail;
    },
    setCalendarDisconnected(state) {
      state.connected = false;
      state.userEmail = null;
      state.todayMeetingHours = null;
      state.lastSyncedDate = null;
    },
    setTodayMeetingHours(
      state,
      action: PayloadAction<{hours: number; date: string}>,
    ) {
      state.todayMeetingHours = action.payload.hours;
      state.lastSyncedDate = action.payload.date;
    },
  },
});

export const {
  setCalendarConnected,
  setCalendarDisconnected,
  setTodayMeetingHours,
} = calendarSlice.actions;

export default calendarSlice.reducer;
