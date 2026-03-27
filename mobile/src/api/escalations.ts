import {apiClient} from './client';
import {
  ConsentPayload,
  DeviceRegistrationPayload,
  EscalationContact,
  EscalationContactPayload,
} from '@/types';

export const escalationsApi = {
  createEscalationContact: (payload: EscalationContactPayload) =>
    apiClient.post<EscalationContact>('/escalation-contacts', payload),

  getEscalationContacts: () =>
    apiClient.get<EscalationContact[]>('/escalation-contacts'),

  deleteEscalationContact: (contactId: string) =>
    apiClient.delete(`/escalation-contacts/${contactId}`),
};

export const consentsApi = {
  submitConsents: (payload: {consent_key: string; consent_value: boolean; policy_version: string}) =>
    apiClient.post('/users/me/consents', payload),

  getConsents: () => apiClient.get('/users/me/consents'),

  updateConsents: (payload: {consent_key: string; consent_value: boolean; policy_version: string}) =>
    apiClient.put('/users/me/consents', payload),
};

export const devicesApi = {
  registerDevice: (payload: DeviceRegistrationPayload) =>
    apiClient.post('/devices/register', payload),
};

export const accountApi = {
  requestExport: () =>
    apiClient.post<{task_id: string}>('/account/export'),

  getExportStatus: (taskId: string) =>
    apiClient.get<{status: 'pending' | 'ready' | 'failed'; download_url?: string}>(
      `/account/export/status`,
      {params: {task_id: taskId}},
    ),

  deleteAccount: () => apiClient.delete('/account'),
};
