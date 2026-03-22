import {apiClient} from './client';
import {
  AuthTokens,
  LoginResponse,
  MfaResponse,
  UserProfile,
} from '@/types';

export interface RegisterPayload {
  email: string;
  password: string;
  age_confirmed_18_plus: boolean;
  timezone: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface MfaPayload {
  temp_session_token: string;
  otp_code: string;
}

export interface RefreshPayload {
  refresh_token: string;
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    apiClient.post<{user_id: string; email: string}>('/auth/register', payload),

  login: (payload: LoginPayload) =>
    apiClient.post<LoginResponse>('/auth/login', payload),

  verifyMfa: (payload: MfaPayload) =>
    apiClient.post<MfaResponse>('/auth/mfa/verify', payload),

  refreshToken: (payload: RefreshPayload) =>
    apiClient.post<AuthTokens>('/auth/refresh', payload),

  resendVerificationEmail: (email: string) =>
    apiClient.post('/auth/resend-verification', {email}),

  checkVerificationStatus: (email: string) =>
    apiClient.get<{verified: boolean}>('/auth/verification-status', {
      params: {email},
    }),

  getProfile: () => apiClient.get<UserProfile>('/users/me'),

  changePassword: (payload: {current_password: string; new_password: string}) =>
    apiClient.post('/auth/change-password', payload),

  requestPasswordReset: (email: string) =>
    apiClient.post('/auth/forgot-password', {email}),
};
