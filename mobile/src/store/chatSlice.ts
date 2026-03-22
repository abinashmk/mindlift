import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {ChatMessage, ChatSessionState} from '@/types';

export interface ChatState {
  sessionId: string | null;
  messages: ChatMessage[];
  sessionState: ChatSessionState;
  crisisFlag: boolean;
  disclosureShown: boolean;
  isLoading: boolean;
  isSending: boolean;
}

const initialState: ChatState = {
  sessionId: null,
  messages: [],
  sessionState: 'IDLE',
  crisisFlag: false,
  disclosureShown: false,
  isLoading: false,
  isSending: false,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setSession(
      state,
      action: PayloadAction<{
        sessionId: string;
        sessionState: ChatSessionState;
        crisisFlag: boolean;
      }>,
    ) {
      state.sessionId = action.payload.sessionId;
      state.sessionState = action.payload.sessionState;
      state.crisisFlag = action.payload.crisisFlag;
    },
    addMessage(state, action: PayloadAction<ChatMessage>) {
      state.messages.push(action.payload);
    },
    addMessages(state, action: PayloadAction<ChatMessage[]>) {
      state.messages.push(...action.payload);
    },
    setMessages(state, action: PayloadAction<ChatMessage[]>) {
      state.messages = action.payload;
    },
    setCrisisFlag(state, action: PayloadAction<boolean>) {
      state.crisisFlag = action.payload;
      if (action.payload) {
        state.sessionState = 'CRISIS';
      }
    },
    setDisclosureShown(state, action: PayloadAction<boolean>) {
      state.disclosureShown = action.payload;
    },
    setIsLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setIsSending(state, action: PayloadAction<boolean>) {
      state.isSending = action.payload;
    },
    clearSession(state) {
      state.sessionId = null;
      state.messages = [];
      state.sessionState = 'IDLE';
      state.crisisFlag = false;
      state.isSending = false;
      state.isLoading = false;
      // disclosureShown persists across session resets (once per app session)
    },
  },
});

export const {
  setSession,
  addMessage,
  addMessages,
  setMessages,
  setCrisisFlag,
  setDisclosureShown,
  setIsLoading,
  setIsSending,
  clearSession,
} = chatSlice.actions;

export default chatSlice.reducer;
