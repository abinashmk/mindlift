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
  submitConsents: (payload: ConsentPayload) =>
    apiClient.post('/consents', payload),

  getConsents: () => apiClient.get<ConsentPayload>('/consents'),

  updateConsents: (payload: Partial<ConsentPayload>) =>
    apiClient.put('/consents', payload),
};

export const devicesApi = {
  registerDevice: (payload: DeviceRegistrationPayload) =>
    apiClient.post('/devices/register', payload),
};

export const accountApi = {
  requestExport: () => apiClient.post('/account/export'),

  deleteAccount: () => apiClient.delete('/account'),
};
