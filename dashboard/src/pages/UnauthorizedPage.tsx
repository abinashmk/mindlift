import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useCurrentUser } from '@/hooks/useCurrentUser'

// ─── UnauthorizedPage ─────────────────────────────────────────────────────────

export function UnauthorizedPage() {
  const navigate = useNavigate()
  const { canViewQueue, canViewAudit } = useCurrentUser()

  const defaultRoute = canViewQueue
    ? '/queue'
    : canViewAudit
    ? '/audit'
    : '/login'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100">
        <svg
          className="h-8 w-8 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-neutral-900">Access Denied</h1>
      <p className="mt-2 max-w-sm text-sm text-neutral-500">
        You don't have permission to access this page.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Button variant="primary" onClick={() => navigate(defaultRoute)}>
          Go to Dashboard
        </Button>
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    </div>
  )
}
