import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {DailyMetrics, InterventionEvent, RiskAssessment, RiskHistoryItem} from '@/types';

export interface MetricsState {
  todayMetrics: Partial<DailyMetrics> | null;
  riskAssessment: RiskAssessment | null;
  interventions: InterventionEvent[];
  riskHistory: RiskHistoryItem[];
  isLoadingHome: boolean;
  hasStaleQueueWarning: boolean;
}

const initialState: MetricsState = {
  todayMetrics: null,
  riskAssessment: null,
  interventions: [],
  riskHistory: [],
  isLoadingHome: false,
  hasStaleQueueWarning: false,
};

const metricsSlice = createSlice({
  name: 'metrics',
  initialState,
  reducers: {
    setHomeData(
      state,
      action: PayloadAction<{
        riskAssessment: RiskAssessment | null;
        todayMetrics: Partial<DailyMetrics> | null;
        suggestedIntervention: InterventionEvent | null;
        recentRiskHistory: RiskHistoryItem[];
      }>,
    ) {
      state.riskAssessment = action.payload.riskAssessment;
      state.todayMetrics = action.payload.todayMetrics;
      state.riskHistory = action.payload.recentRiskHistory;
      // merge suggested intervention into list
      if (action.payload.suggestedIntervention) {
        const exists = state.interventions.find(
          i => i.event_id === action.payload.suggestedIntervention?.event_id,
        );
        if (!exists && action.payload.suggestedIntervention) {
          state.interventions = [
            action.payload.suggestedIntervention,
            ...state.interventions,
          ];
        }
      }
      state.isLoadingHome = false;
    },
    setInterventions(state, action: PayloadAction<InterventionEvent[]>) {
      state.interventions = action.payload;
    },
    updateIntervention(state, action: PayloadAction<InterventionEvent>) {
      const idx = state.interventions.findIndex(
        i => i.event_id === action.payload.event_id,
      );
      if (idx >= 0) {
        state.interventions[idx] = action.payload;
      }
    },
    setMoodScore(state, action: PayloadAction<number>) {
      if (!state.todayMetrics) state.todayMetrics = {};
      state.todayMetrics.mood_score = action.payload;
    },
    setLoadingHome(state, action: PayloadAction<boolean>) {
      state.isLoadingHome = action.payload;
    },
    setStaleQueueWarning(state, action: PayloadAction<boolean>) {
      state.hasStaleQueueWarning = action.payload;
    },
    setRiskHistory(state, action: PayloadAction<RiskHistoryItem[]>) {
      state.riskHistory = action.payload;
    },
  },
});

export const {
  setHomeData,
  setInterventions,
  updateIntervention,
  setMoodScore,
  setLoadingHome,
  setStaleQueueWarning,
  setRiskHistory,
} = metricsSlice.actions;

export default metricsSlice.reducer;
