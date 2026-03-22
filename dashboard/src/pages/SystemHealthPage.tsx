import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { AppShell } from '@/components/layout/AppShell'
import { Card, CardHeader } from '@/components/ui/Card'
import { fetchSystemHealth } from '@/api/support'
import { formatDateTime } from '@/utils/formatters'
import { SYSTEM_HEALTH_REFRESH_MS } from '@/utils/constants'
import type { ServiceStatus } from '@/types'

// ─── Status Indicator ─────────────────────────────────────────────────────────

interface StatusIndicatorProps {
  status: ServiceStatus
}

const STATUS_CONFIG: Record<
  ServiceStatus,
  { dot: string; label: string; text: string }
> = {
  healthy: { dot: 'bg-green-500', label: 'Healthy', text: 'text-green-700' },
  degraded: { dot: 'bg-yellow-400', label: 'Degraded', text: 'text-yellow-700' },
  down: { dot: 'bg-red-500', label: 'Down', text: 'text-red-700' },
  unknown: { dot: 'bg-gray-400', label: 'Unknown', text: 'text-gray-500' },
}

function StatusIndicator({ status }: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status]
  return (
    <span
      className={clsx('flex items-center gap-2', config.text)}
      role="status"
      aria-label={config.label}
    >
      <span
        aria-hidden="true"
        className={clsx(
          'h-2.5 w-2.5 flex-shrink-0 rounded-full',
          config.dot,
          status === 'healthy' && 'animate-pulse',
        )}
      />
      <span className="text-sm font-medium">{config.label}</span>
    </span>
  )
}

// ─── Health Card ──────────────────────────────────────────────────────────────

interface HealthCardProps {
  label: string
  status: ServiceStatus
}

function HealthCard({ label, status }: HealthCardProps) {
  return (
    <Card className="flex items-center justify-between">
      <p className="text-sm font-medium text-neutral-700">{label}</p>
      <StatusIndicator status={status} />
    </Card>
  )
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string
  value: number | string
  subtitle?: string
  colorClass?: string
}

function MetricCard({ label, value, subtitle, colorClass = 'text-neutral-900' }: MetricCardProps) {
  return (
    <Card>
      <p className="text-sm font-medium text-neutral-500">{label}</p>
      <p className={clsx('mt-2 text-3xl font-bold tabular-nums', colorClass)}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-neutral-400">{subtitle}</p>
      )}
    </Card>
  )
}

// ─── SystemHealthPage ─────────────────────────────────────────────────────────

export function SystemHealthPage() {
  const {
    data: health,
    isLoading,
    isError,
    dataUpdatedAt,
    isFetching,
  } = useQuery({
    queryKey: ['system-health'],
    queryFn: fetchSystemHealth,
    refetchInterval: SYSTEM_HEALTH_REFRESH_MS,
    staleTime: SYSTEM_HEALTH_REFRESH_MS,
  })

  const lastRefreshed = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null

  return (
    <AppShell pageTitle="System Health">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">System Health</h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              Auto-refreshes every 30 seconds
              {lastRefreshed && ` · Last updated at ${lastRefreshed}`}
            </p>
          </div>
          {isFetching && (
            <span className="flex items-center gap-1.5 text-xs text-neutral-400">
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Refreshing…
            </span>
          )}
        </div>

        {/* Error */}
        {isError && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
          >
            Failed to load system health data.
          </div>
        )}

        {/* Service status */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-neutral-600 uppercase tracking-wide">
            Service Status
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-2xl bg-neutral-100"
                />
              ))}
            </div>
          ) : health ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <HealthCard label="API" status={health.api_status} />
              <HealthCard label="Database" status={health.database_status} />
              <HealthCard label="Redis" status={health.redis_status} />
              <HealthCard label="Celery Workers" status={health.celery_status} />
            </div>
          ) : null}
        </div>

        {/* Metrics */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-neutral-600 uppercase tracking-wide">
            Platform Metrics
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-2xl bg-neutral-100"
                />
              ))}
            </div>
          ) : health ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricCard
                label="Active Users"
                value={health.total_active_users}
                subtitle="App users with active accounts"
              />
              <MetricCard
                label="Open Escalations"
                value={health.open_escalations_count}
                subtitle="Not resolved or closed"
                colorClass={
                  health.open_escalations_count > 10
                    ? 'text-orange-600'
                    : 'text-neutral-900'
                }
              />
              <MetricCard
                label="New Escalations"
                value={health.new_escalations_count}
                subtitle="Awaiting acknowledgment"
                colorClass={
                  health.new_escalations_count > 5
                    ? 'text-red-600'
                    : 'text-neutral-900'
                }
              />
            </div>
          ) : null}
        </div>

        {/* Last checked timestamp from API */}
        {health && (
          <p className="text-xs text-neutral-400">
            Health check recorded at: {formatDateTime(health.checked_at)}
          </p>
        )}
      </div>
    </AppShell>
  )
}
