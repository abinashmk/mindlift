import {configureStore} from '@reduxjs/toolkit';
import {TypedUseSelectorHook, useDispatch, useSelector} from 'react-redux';
import authReducer from './authSlice';
import metricsReducer from './metricsSlice';
import chatReducer from './chatSlice';
import consentsReducer from './consentsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    metrics: metricsReducer,
    chat: chatReducer,
    consents: consentsReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        // Allow non-serializable values only in specific paths if needed
        ignoredActions: [],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
