import {apiClient} from './client';
import {DailyMetrics, HomeData, RiskHistoryItem} from '@/types';

export interface PatternSignal {
  metric_key: string;
  direction: 'decline' | 'improvement';
  label: string;
  delta_pct: number;
}

export interface PatternInsight {
  has_pattern: boolean;
  headline: string;
  explanation: string;
  signals: PatternSignal[];
}

export type StressSource =
  | 'workload'
  | 'deadlines'
  | 'career'
  | 'finances'
  | 'relationships'
  | 'other';

export const metricsApi = {
  uploadMetrics: (metrics: DailyMetrics) =>
    apiClient.post<{uploaded: boolean}>('/metrics/daily', metrics),

  getTodayMetrics: () =>
    apiClient.get<Partial<DailyMetrics>>('/metrics/daily/today'),

  getHomeData: () => apiClient.get<HomeData>('/home'),

  getRiskHistory: (days = 30) =>
    apiClient.get<RiskHistoryItem[]>('/risk/history', {params: {days}}),

  logMood: (mood_score: number, metric_date: string) =>
    apiClient.post('/metrics/mood', {mood_score, metric_date}),

  logStressSource: (stress_source: StressSource, metric_date: string) =>
    apiClient.post('/metrics/daily', {metric_date, stress_source}),

  getPatternInsight: () =>
    apiClient.get<PatternInsight>('/insights/pattern'),
};
