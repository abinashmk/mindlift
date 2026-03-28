import {apiClient} from './client';
import {ChatMessage, ChatMessageResponse, ChatSession} from '@/types';

export interface SendMessagePayload {
  session_id: string | null;
  message_text: string;
}

export interface SessionSummary {
  session_id: string;
  state: string;
  crisis_flag: boolean;
}

export interface SendMessageResponse {
  // null when crisis is detected — no LLM reply is generated (spec §24.4)
  assistant_message: ChatMessageResponse | null;
  session: SessionSummary;
}

export const chatApi = {
  startSession: () => apiClient.post<ChatSession>('/chat/sessions', {}),

  getSession: (sessionId: string) =>
    apiClient.get<ChatSession>(`/chat/sessions/${sessionId}`),

  getMessages: (sessionId: string) =>
    apiClient.get<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`),

  sendMessage: (payload: SendMessagePayload) =>
    apiClient.post<SendMessageResponse>(
      `/chat/sessions/${payload.session_id}/messages`,
      {message_text: payload.message_text},
    ),

  endSession: (sessionId: string) =>
    apiClient.post(`/chat/sessions/${sessionId}/end`, {}),

  manualEscalation: (sessionId: string | null, note?: string) =>
    apiClient.post('/escalations', {session_id: sessionId, note, source: 'manual', risk_level: 'ORANGE'}),
};
