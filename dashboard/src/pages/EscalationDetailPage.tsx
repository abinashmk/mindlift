import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Badge } from '@/components/ui/Badge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { EscalationDetail } from '@/components/escalations/EscalationDetail'
import { useEscalation } from '@/hooks/useEscalations'
import { truncateId } from '@/utils/formatters'

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 rounded-lg bg-neutral-100" />
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-100">
        <div className="h-4 w-32 rounded bg-neutral-100" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex justify-between">
              <div className="h-3 w-32 rounded bg-neutral-100" />
              <div className="h-3 w-20 rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── EscalationDetailPage ─────────────────────────────────────────────────────

export function EscalationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: escalation, isLoading, isError } = useEscalation(id ?? '')

  return (
    <AppShell pageTitle="Escalation Detail">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Top bar: back + IDs + badges */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              aria-label="Back to queue"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </Button>

            {escalation && (
              <h1 className="text-base font-semibold text-neutral-800">
                Escalation{' '}
                <span
                  className="font-mono text-sm text-neutral-500"
                  title={escalation.id}
                >
                  #{truncateId(escalation.id, 12)}
                </span>
              </h1>
            )}
          </div>

          {escalation && (
            <div className="flex items-center gap-2">
              <Badge level={escalation.risk_level} />
              <StatusBadge status={escalation.status} />
            </div>
          )}
        </div>

        {/* Loading */}
        {isLoading && <DetailSkeleton />}

        {/* Error */}
        {isError && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-4 text-sm text-red-700 ring-1 ring-red-200"
          >
            Failed to load escalation details. Please go back and try again.
          </div>
        )}

        {/* Detail content */}
        {escalation && <EscalationDetail escalation={escalation} />}
      </div>
    </AppShell>
  )
}
