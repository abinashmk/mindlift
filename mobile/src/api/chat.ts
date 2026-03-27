import {apiClient} from './client';
import {ChatMessage, ChatMessageResponse, ChatSession} from '@/types';

export interface SendMessagePayload {
  session_id: string | null;
  message_text: string;
}

export const chatApi = {
  startSession: () => apiClient.post<ChatSession>('/chat/sessions', {}),

  getSession: (sessionId: string) =>
    apiClient.get<ChatSession>(`/chat/sessions/${sessionId}`),

  getMessages: (sessionId: string) =>
    apiClient.get<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`),

  sendMessage: (payload: SendMessagePayload) =>
    apiClient.post<ChatMessageResponse>(
      `/chat/sessions/${payload.session_id}/messages`,
      {message_text: payload.message_text},
    ),

  endSession: (sessionId: string) =>
    apiClient.post(`/chat/sessions/${sessionId}/end`, {}),

  manualEscalation: (sessionId: string | null, note?: string) =>
    apiClient.post('/escalations', {session_id: sessionId, note, source: 'manual', risk_level: 'ORANGE'}),
};
