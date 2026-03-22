import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { SupportUser, AuthTokens } from '@/types'

// ─── Auth State ───────────────────────────────────────────────────────────────

interface AuthState {
  currentUser: SupportUser | null
  tokens: AuthTokens | null
  mfaToken: string | null

  // Actions
  setMfaToken: (token: string) => void
  setAuth: (user: SupportUser, tokens: AuthTokens) => void
  setTokens: (tokens: AuthTokens) => void
  logout: () => void

  // Derived helpers
  isAuthenticated: () => boolean
  hasRole: (roles: SupportUser['role'][]) => boolean
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      tokens: null,
      mfaToken: null,

      setMfaToken: (token: string) => {
        set({ mfaToken: token })
      },

      setAuth: (user: SupportUser, tokens: AuthTokens) => {
        set({ currentUser: user, tokens, mfaToken: null })
      },

      setTokens: (tokens: AuthTokens) => {
        set({ tokens })
      },

      logout: () => {
        set({ currentUser: null, tokens: null, mfaToken: null })
      },

      isAuthenticated: () => {
        const state = get()
        return state.currentUser !== null && state.tokens !== null
      },

      hasRole: (roles: SupportUser['role'][]) => {
        const state = get()
        if (!state.currentUser) return false
        return roles.includes(state.currentUser.role)
      },
    }),
    {
      name: 'mindlift-auth',
      storage: createJSONStorage(() => sessionStorage),
      // Only persist tokens and user — not the mfaToken (ephemeral)
      partialize: (state) => ({
        currentUser: state.currentUser,
        tokens: state.tokens,
      }),
    },
  ),
)

// ─── Selectors (for performance — avoid re-renders) ───────────────────────────

export const selectCurrentUser = (s: AuthState) => s.currentUser
export const selectTokens = (s: AuthState) => s.tokens
export const selectMfaToken = (s: AuthState) => s.mfaToken
export const selectIsAuthenticated = (s: AuthState) => s.isAuthenticated()
export const selectRole = (s: AuthState) => s.currentUser?.role ?? null
