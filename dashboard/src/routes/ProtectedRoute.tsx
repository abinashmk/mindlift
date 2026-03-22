import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'

// ─── ProtectedRoute ───────────────────────────────────────────────────────────
// Redirects to /login if user is not authenticated.

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const location = useLocation()

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname }}
        replace
      />
    )
  }

  return <Outlet />
}
