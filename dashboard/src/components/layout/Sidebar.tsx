import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useAuthStore } from '@/store/auth'
import { formatRole } from '@/utils/formatters'

// ─── Nav Icons ────────────────────────────────────────────────────────────────

function QueueIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}

function AuditIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function HealthIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
}

// ─── Nav Link Item ────────────────────────────────────────────────────────────

interface NavItemProps {
  to: string
  label: string
  icon: React.ReactNode
}

function NavItem({ to, label, icon }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-100',
          isActive
            ? 'bg-brand-50 text-brand-700'
            : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const { currentUser, canViewQueue, canViewAudit, canManageUsers, canViewSystemHealth } =
    useCurrentUser()
  const logout = useAuthStore((s) => s.logout)

  return (
    <nav
      aria-label="Main navigation"
      className="flex h-full flex-col bg-white px-3 py-4"
    >
      {/* Brand */}
      <div className="mb-6 flex items-center gap-3 px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-neutral-900">MindLift</p>
          <p className="text-xs text-neutral-500">Support Dashboard</p>
        </div>
      </div>

      {/* Nav Items */}
      <div className="flex-1 space-y-1" onClick={onClose}>
        {canViewQueue && (
          <NavItem to="/queue" label="Escalation Queue" icon={<QueueIcon />} />
        )}
        {canViewAudit && (
          <NavItem to="/audit" label="Audit Logs" icon={<AuditIcon />} />
        )}
        {canViewSystemHealth && (
          <NavItem to="/system-health" label="System Health" icon={<HealthIcon />} />
        )}
        {canManageUsers && (
          <NavItem to="/users" label="User Management" icon={<UsersIcon />} />
        )}
      </div>

      {/* User info + logout */}
      <div className="border-t border-neutral-100 pt-4">
        {currentUser && (
          <div className="mb-3 px-3">
            <p className="truncate text-sm font-medium text-neutral-800">
              {currentUser.email}
            </p>
            <p className="text-xs text-neutral-500">
              {formatRole(currentUser.role)}
            </p>
          </div>
        )}
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogoutIcon />
          Sign Out
        </button>
      </div>
    </nav>
  )
}
