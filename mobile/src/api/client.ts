import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';
import {store} from '@/store';
import {logout, refreshTokenSuccess} from '@/store/authSlice';
import {storage} from '@/store/storage';
import {STORAGE_KEYS} from '@/utils/constants';

const API_BASE_URL =
  (process.env.API_BASE_URL as string | undefined) ??
  'http://localhost:8000';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/v1`,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─── Request interceptor: inject Bearer token ─────────────────────────────────

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token =
      store.getState().auth.accessToken ??
      storage.getString(STORAGE_KEYS.ACCESS_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error),
);

// ─── Response interceptor: token refresh on 401 ───────────────────────────────

apiClient.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              resolve(apiClient(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken =
        store.getState().auth.refreshToken ??
        storage.getString(STORAGE_KEYS.REFRESH_TOKEN);

      if (!refreshToken) {
        processQueue(error, null);
        isRefreshing = false;
        store.dispatch(logout());
        return Promise.reject(error);
      }

      try {
        const response = await axios.post<{
          access_token: string;
          refresh_token: string;
        }>(`${API_BASE_URL}/v1/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const {access_token, refresh_token} = response.data;

        store.dispatch(
          refreshTokenSuccess({
            accessToken: access_token,
            refreshToken: refresh_token,
          }),
        );

        processQueue(null, access_token);
        isRefreshing = false;

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        store.dispatch(logout());
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);
