import {apiClient} from './client';
import {InterventionEvent} from '@/types';

export interface UpdateInterventionPayload {
  status: 'VIEWED' | 'COMPLETED' | 'DISMISSED';
  helpful_rating?: number;
}

export const interventionsApi = {
  getTodayInterventions: () =>
    apiClient.get<InterventionEvent[]>('/interventions/today'),

  getIntervention: (eventId: string) =>
    apiClient.get<InterventionEvent>(`/interventions/${eventId}`),

  updateIntervention: (eventId: string, payload: UpdateInterventionPayload) =>
    apiClient.patch<InterventionEvent>(`/interventions/${eventId}`, payload),
};
