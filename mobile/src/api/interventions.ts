import {apiClient} from './client';
import {InterventionEvent} from '@/types';

export interface UpdateInterventionPayload {
  status: 'VIEWED' | 'COMPLETED' | 'DISMISSED';
  helpful_rating?: number;
}

export const interventionsApi = {
  getIntervention: (eventId: string) =>
    apiClient.get<InterventionEvent>(`/interventions/events/${eventId}`),

  updateIntervention: (eventId: string, payload: UpdateInterventionPayload) =>
    apiClient.patch<InterventionEvent>(`/interventions/events/${eventId}`, payload),
};
