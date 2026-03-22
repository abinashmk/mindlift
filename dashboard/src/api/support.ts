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
    '/api/v1/auth/login',
    body,
  )
  return response.data
}

export async function verifyMfa(
  body: MfaVerifyRequest,
): Promise<MfaVerifyResponse> {
  const response = await apiClient.post<MfaVerifyResponse>(
    '/api/v1/auth/mfa/verify',
    body,
  )
  return response.data
}

export async function logoutRequest(): Promise<void> {
  await apiClient.post('/api/v1/auth/logout')
}

// ─── Support Users API ────────────────────────────────────────────────────────

export async function fetchSupportUsers(params?: {
  page?: number
  per_page?: number
}): Promise<PaginatedResponse<SupportUser>> {
  const response = await apiClient.get<PaginatedResponse<SupportUser>>(
    '/api/v1/admin/users',
    { params },
  )
  return response.data
}

export async function createSupportUser(
  body: CreateSupportUserRequest,
): Promise<SupportUser> {
  const response = await apiClient.post<SupportUser>(
    '/api/v1/admin/users',
    body,
  )
  return response.data
}

export async function deactivateSupportUser(userId: string): Promise<SupportUser> {
  const response = await apiClient.patch<SupportUser>(
    `/api/v1/admin/users/${userId}/deactivate`,
  )
  return response.data
}

// ─── System Health API ────────────────────────────────────────────────────────

export async function fetchSystemHealth(): Promise<SystemHealth> {
  const response = await apiClient.get<SystemHealth>(
    '/api/v1/admin/system-health',
  )
  return response.data
}
