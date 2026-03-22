import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import type { SupportRole } from '@/types'

// ─── RoleRoute ────────────────────────────────────────────────────────────────
// Redirects to /unauthorized if the current user's role is not in allowedRoles.

interface RoleRouteProps {
  allowedRoles: SupportRole[]
}

export function RoleRoute({ allowedRoles }: RoleRouteProps) {
  const currentUser = useAuthStore((s) => s.currentUser)

  if (!currentUser || !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}
