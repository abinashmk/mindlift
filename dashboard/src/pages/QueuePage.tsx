import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Table, TableHead, TableBody, Th, TableEmpty, TableSkeleton } from '@/components/ui/Table'
import { EscalationRow } from '@/components/escalations/EscalationRow'
import { useEscalations } from '@/hooks/useEscalations'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { RISK_SORT_ORDER } from '@/utils/constants'
import { arrayToCsv, downloadCsv, formatDateTime, formatSource } from '@/utils/formatters'
import type { Escalation } from '@/types'

// ─── Sort escalations: RED newest first, then ORANGE newest first, etc. ───────

function sortEscalations(items: Escalation[]): Escalation[] {
  return [...items].sort((a, b) => {
    const riskDiff =
      (RISK_SORT_ORDER[a.risk_level] ?? 99) -
      (RISK_SORT_ORDER[b.risk_level] ?? 99)
    if (riskDiff !== 0) return riskDiff
    // Within same risk level: newest first
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportToCsv(items: Escalation[]) {
  const headers = [
    'ID',
    'User ID',
    'Risk Level',
    'Status',
    'Source',
    'Assigned Agent',
    'Created At',
    'Updated At',
  ]
  const rows = items.map((e) => [
    e.id,
    e.user_id,
    e.risk_level,
    e.status,
    formatSource(e.source),
    e.assigned_agent_id ?? '',
    formatDateTime(e.created_at),
    formatDateTime(e.updated_at),
  ])
  const csv = arrayToCsv(headers, rows)
  downloadCsv(`escalations-${new Date().toISOString().slice(0, 10)}.csv`, csv)
}

// ─── QueuePage ────────────────────────────────────────────────────────────────

export function QueuePage() {
  const { isManager, canExportCsv } = useCurrentUser()
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false)

  const { data, isLoading, isError, refetch } = useEscalations({
    per_page: 100,
    ...(isManager && showUnassignedOnly ? { unassigned_only: true } : {}),
  })

  const escalations = data?.items ?? []
  const sorted = sortEscalations(escalations)

  return (
    <AppShell pageTitle="Escalation Queue">
      <div className="space-y-5">
        {/* Page header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">
              Escalation Queue
            </h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              {isLoading
                ? 'Loading…'
                : `${sorted.length} escalation${sorted.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Unassigned filter (manager only) */}
            {isManager && (
              <button
                onClick={() => setShowUnassignedOnly((prev) => !prev)}
                aria-pressed={showUnassignedOnly}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  showUnassignedOnly
                    ? 'border-brand-300 bg-brand-50 text-brand-700'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${showUnassignedOnly ? 'bg-brand-500' : 'bg-neutral-300'}`}
                />
                Unassigned only
              </button>
            )}

            {/* Export CSV (manager only) */}
            {canExportCsv && escalations.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCsv(sorted)}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </Button>
            )}

            {/* Refresh */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refetch()}
              aria-label="Refresh queue"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </Button>
          </div>
        </div>

        {/* Error state */}
        {isError && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
          >
            Failed to load escalations. Please refresh the page or try again.
          </div>
        )}

        {/* Table */}
        <Card padding="none">
          <Table aria-label="Escalation queue">
            <TableHead>
              <tr>
                <Th>Created At</Th>
                <Th>Risk Level</Th>
                <Th>Status</Th>
                <Th>User ID</Th>
                <Th>Source</Th>
                <Th>Assigned Agent</Th>
              </tr>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableSkeleton rows={8} cols={6} />
              ) : sorted.length === 0 ? (
                <TableEmpty
                  message={
                    showUnassignedOnly
                      ? 'No unassigned escalations.'
                      : 'No escalations in queue.'
                  }
                  colSpan={6}
                />
              ) : (
                sorted.map((escalation) => (
                  <EscalationRow key={escalation.id} escalation={escalation} />
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppShell>
  )
}
