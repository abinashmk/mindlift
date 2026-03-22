import clsx from 'clsx'
import type { EscalationStatus } from '@/types'
import { STATUS_COLORS } from '@/utils/formatters'
import { STATUS_LABELS } from '@/utils/constants'

// ─── Escalation Status Badge ──────────────────────────────────────────────────

interface StatusBadgeProps {
  status: EscalationStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colors = STATUS_COLORS[status]
  const label = STATUS_LABELS[status]

  return (
    <span
      role="status"
      aria-label={`Status: ${label}`}
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        colors.bg,
        colors.text,
        colors.border,
        'border',
        className,
      )}
    >
      {label}
    </span>
  )
}
