import {apiClient} from './client';
import {DailyMetrics, HomeData, RiskHistoryItem} from '@/types';

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
};
