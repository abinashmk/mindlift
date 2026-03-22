import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { RoleRoute } from '@/routes/RoleRoute'
import { LoginPage } from '@/pages/LoginPage'
import { MfaPage } from '@/pages/MfaPage'
import { QueuePage } from '@/pages/QueuePage'
import { EscalationDetailPage } from '@/pages/EscalationDetailPage'
import { AuditLogPage } from '@/pages/AuditLogPage'
import { SystemHealthPage } from '@/pages/SystemHealthPage'
import { UserManagementPage } from '@/pages/UserManagementPage'
import { UnauthorizedPage } from '@/pages/UnauthorizedPage'

// ─── App Router ───────────────────────────────────────────────────────────────

export function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/mfa" element={<MfaPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Protected routes (must be authenticated) */}
      <Route element={<ProtectedRoute />}>
        {/* Queue — support_agent, support_manager */}
        <Route element={<RoleRoute allowedRoles={['support_agent', 'support_manager']} />}>
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/escalations/:id" element={<EscalationDetailPage />} />
        </Route>

        {/* Audit logs — admin, read_only_auditor */}
        <Route element={<RoleRoute allowedRoles={['admin', 'read_only_auditor']} />}>
          <Route path="/audit" element={<AuditLogPage />} />
        </Route>

        {/* System health — admin only */}
        <Route element={<RoleRoute allowedRoles={['admin']} />}>
          <Route path="/system-health" element={<SystemHealthPage />} />
        </Route>

        {/* User management — admin only */}
        <Route element={<RoleRoute allowedRoles={['admin']} />}>
          <Route path="/users" element={<UserManagementPage />} />
        </Route>
      </Route>

      {/* Catch-all: redirect to /login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
