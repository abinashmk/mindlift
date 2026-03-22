import {apiClient} from './client';
import {ChatMessage, ChatMessageResponse, ChatSession} from '@/types';

export interface SendMessagePayload {
  session_id: string | null;
  message_text: string;
}

export const chatApi = {
  startSession: () => apiClient.post<ChatSession>('/chat/sessions'),

  getSession: (sessionId: string) =>
    apiClient.get<ChatSession>(`/chat/sessions/${sessionId}`),

  getMessages: (sessionId: string) =>
    apiClient.get<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`),

  sendMessage: (payload: SendMessagePayload) =>
    apiClient.post<ChatMessageResponse>('/chat/message', payload),

  endSession: (sessionId: string) =>
    apiClient.post(`/chat/sessions/${sessionId}/end`),

  manualEscalation: (sessionId: string | null, note?: string) =>
    apiClient.post('/escalations/manual', {session_id: sessionId, note}),
};
