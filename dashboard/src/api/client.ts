import axios, {
  type AxiosInstance,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios'
import { useAuthStore } from '@/store/auth'
import type { AuthTokens } from '@/types'

// ─── Axios Instance ───────────────────────────────────────────────────────────

const BASE_URL = import.meta.env['VITE_API_BASE_URL'] ?? 'http://localhost:8000'

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
})

// ─── Token Refresh State ──────────────────────────────────────────────────────

let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []

function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback)
}

function onRefreshSuccess(newToken: string) {
  refreshSubscribers.forEach((cb) => cb(newToken))
  refreshSubscribers = []
}

async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  const response = await axios.post<AuthTokens>(
    `${BASE_URL}/v1/support/auth/refresh`,
    { refresh_token: refreshToken },
    { headers: { 'Content-Type': 'application/json' } },
  )
  return response.data
}

// ─── Request Interceptor: Attach Bearer Token ─────────────────────────────────

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const tokens = useAuthStore.getState().tokens
    if (tokens?.access_token) {
      config.headers.set('Authorization', `Bearer ${tokens.access_token}`)
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error),
)

// ─── Response Interceptor: Handle 401 + Token Refresh ─────────────────────────

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    const { tokens, setTokens, logout } = useAuthStore.getState()

    // No refresh token available — log out immediately
    if (!tokens?.refresh_token) {
      logout()
      return Promise.reject(error)
    }

    // If a refresh is already in flight, queue this request
    if (isRefreshing) {
      return new Promise<unknown>((resolve) => {
        subscribeTokenRefresh((newToken: string) => {
          originalRequest.headers.set('Authorization', `Bearer ${newToken}`)
          resolve(apiClient(originalRequest))
        })
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      const newTokens = await refreshAccessToken(tokens.refresh_token)
      setTokens(newTokens)
      onRefreshSuccess(newTokens.access_token)
      originalRequest.headers.set(
        'Authorization',
        `Bearer ${newTokens.access_token}`,
      )
      return apiClient(originalRequest)
    } catch (refreshError) {
      logout()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

export default apiClient
