import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  Table,
  TableHead,
  TableBody,
  Th,
  Td,
  Tr,
  TableEmpty,
  TableSkeleton,
} from '@/components/ui/Table'
import { useAuditLogs } from '@/hooks/useAuditLogs'
import { formatDateTime, truncateId } from '@/utils/formatters'
import { AUDIT_LOG_PER_PAGE } from '@/utils/constants'

// ─── AuditLogPage ─────────────────────────────────────────────────────────────

export function AuditLogPage() {
  const [page, setPage] = useState(1)
  const [actionKeyFilter, setActionKeyFilter] = useState('')
  const [appliedFilter, setAppliedFilter] = useState('')

  const { data, isLoading, isError, isFetching } = useAuditLogs({
    page,
    per_page: AUDIT_LOG_PER_PAGE,
    action_key: appliedFilter || undefined,
  })

  const logs = data?.items ?? []
  const totalPages = data?.pages ?? 1
  const total = data?.total ?? 0

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setAppliedFilter(actionKeyFilter.trim())
  }

  const handleFilterClear = () => {
    setActionKeyFilter('')
    setAppliedFilter('')
    setPage(1)
  }

  return (
    <AppShell pageTitle="Audit Logs">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Audit Logs</h1>
            {!isLoading && (
              <p className="mt-0.5 text-sm text-neutral-500">
                {total.toLocaleString()} total record{total !== 1 ? 's' : ''}
                {appliedFilter && (
                  <span className="ml-1">
                    — filtered by{' '}
                    <code className="rounded bg-neutral-100 px-1 text-xs">
                      {appliedFilter}
                    </code>
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Filter form */}
          <form
            onSubmit={handleFilterSubmit}
            className="flex items-center gap-2"
            role="search"
          >
            <label htmlFor="action-key-filter" className="sr-only">
              Filter by action key
            </label>
            <input
              id="action-key-filter"
              type="text"
              value={actionKeyFilter}
              onChange={(e) => setActionKeyFilter(e.target.value)}
              placeholder="Filter by action key…"
              className="w-48 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 placeholder-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <Button type="submit" variant="outline" size="sm">
              Filter
            </Button>
            {appliedFilter && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleFilterClear}
                aria-label="Clear filter"
              >
                Clear
              </Button>
            )}
          </form>
        </div>

        {/* Error */}
        {isError && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
          >
            Failed to load audit logs. Please refresh the page.
          </div>
        )}

        {/* Table */}
        <Card padding="none">
          <Table aria-label="Audit log entries">
            <TableHead>
              <tr>
                <Th>Timestamp</Th>
                <Th>Actor Type</Th>
                <Th>Actor ID</Th>
                <Th>Action Key</Th>
                <Th>Entity Type</Th>
                <Th>Entity ID</Th>
              </tr>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableSkeleton rows={10} cols={6} />
              ) : logs.length === 0 ? (
                <TableEmpty
                  message={
                    appliedFilter
                      ? `No logs matching "${appliedFilter}".`
                      : 'No audit logs found.'
                  }
                  colSpan={6}
                />
              ) : (
                logs.map((log) => (
                  <Tr key={log.id} className={isFetching ? 'opacity-60' : ''}>
                    <Td className="whitespace-nowrap text-xs text-neutral-500">
                      {formatDateTime(log.created_at)}
                    </Td>
                    <Td className="capitalize text-neutral-600">
                      {log.actor_type}
                    </Td>
                    <Td className="font-mono text-xs text-neutral-600">
                      {log.actor_id ? (
                        <span title={log.actor_id}>
                          {truncateId(log.actor_id)}
                        </span>
                      ) : (
                        <span className="italic text-neutral-400">System</span>
                      )}
                    </Td>
                    <Td>
                      <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-mono text-neutral-700">
                        {log.action_key}
                      </code>
                    </Td>
                    <Td className="capitalize text-neutral-600">
                      {log.entity_type}
                    </Td>
                    <Td className="font-mono text-xs text-neutral-600">
                      {log.entity_id ? (
                        <span title={log.entity_id}>
                          {truncateId(log.entity_id)}
                        </span>
                      ) : (
                        <span className="italic text-neutral-400">—</span>
                      )}
                    </Td>
                  </Tr>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="flex items-center justify-between"
            aria-label="Pagination"
          >
            <p className="text-sm text-neutral-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isFetching}
                aria-label="Previous page"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || isFetching}
                aria-label="Next page"
              >
                Next
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
