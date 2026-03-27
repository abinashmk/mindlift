import apiClient from './client'
import type {
  SupportUser,
  PaginatedResponse,
  CreateSupportUserRequest,
  LoginRequest,
  LoginResponse,
  MfaVerifyRequest,
  MfaVerifyResponse,
  SystemHealth,
} from '@/types'

// ─── Auth API ─────────────────────────────────────────────────────────────────

export async function login(body: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>(
    '/v1/support/auth/login',
    body,
  )
  return response.data
}

export async function verifyMfa(
  body: MfaVerifyRequest,
): Promise<MfaVerifyResponse> {
  const response = await apiClient.post<MfaVerifyResponse>(
    '/v1/support/auth/mfa/verify',
    body,
  )
  return response.data
}

export async function logoutRequest(): Promise<void> {
  await apiClient.post('/v1/support/auth/logout')
}

// ─── Support Users API ────────────────────────────────────────────────────────

export async function fetchSupportUsers(params?: {
  page?: number
  per_page?: number
}): Promise<PaginatedResponse<SupportUser>> {
  const response = await apiClient.get<PaginatedResponse<SupportUser>>(
    '/v1/support/users',
    { params },
  )
  return response.data
}

export async function createSupportUser(
  body: CreateSupportUserRequest,
): Promise<SupportUser> {
  const response = await apiClient.post<SupportUser>(
    '/v1/support/users',
    body,
  )
  return response.data
}

export async function deactivateSupportUser(userId: string): Promise<SupportUser> {
  const response = await apiClient.patch<SupportUser>(
    `/v1/support/users/${userId}/deactivate`,
  )
  return response.data
}

// ─── System Health API ────────────────────────────────────────────────────────

export async function fetchSystemHealth(): Promise<SystemHealth> {
  const response = await apiClient.get<SystemHealth>(
    '/v1/support/system-health',
  )
  return response.data
}
