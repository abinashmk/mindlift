import { useAuthStore } from '@/store/auth'
import type { SupportUser } from '@/types'

// ─── useCurrentUser ───────────────────────────────────────────────────────────

interface UseCurrentUserReturn {
  currentUser: SupportUser | null
  role: SupportUser['role'] | null
  isAgent: boolean
  isManager: boolean
  isAdmin: boolean
  isAuditor: boolean
  isAuthenticated: boolean
  canViewQueue: boolean
  canViewAudit: boolean
  canManageUsers: boolean
  canViewSystemHealth: boolean
  canAssignEscalations: boolean
  canExportCsv: boolean
}

export function useCurrentUser(): UseCurrentUserReturn {
  const currentUser = useAuthStore((s) => s.currentUser)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())

  const role = currentUser?.role ?? null

  const isAgent = role === 'support_agent'
  const isManager = role === 'support_manager'
  const isAdmin = role === 'admin'
  const isAuditor = role === 'read_only_auditor'

  return {
    currentUser,
    role,
    isAgent,
    isManager,
    isAdmin,
    isAuditor,
    isAuthenticated,
    canViewQueue: isAgent || isManager,
    canViewAudit: isAdmin || isAuditor,
    canManageUsers: isAdmin,
    canViewSystemHealth: isAdmin,
    canAssignEscalations: isManager,
    canExportCsv: isManager,
  }
}
