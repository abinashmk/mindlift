import clsx from 'clsx'
import type { RiskLevel } from '@/types'
import { RISK_COLORS } from '@/utils/formatters'
import { RISK_LABELS } from '@/utils/constants'

// ─── Risk Level Badge ─────────────────────────────────────────────────────────

interface BadgeProps {
  level: RiskLevel
  showDot?: boolean
  className?: string
}

export function Badge({ level, showDot = true, className }: BadgeProps) {
  const colors = RISK_COLORS[level]
  const label = RISK_LABELS[level]

  return (
    <span
      role="status"
      aria-label={`Risk level: ${label}`}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        colors.bg,
        colors.text,
        colors.border,
        'border',
        className,
      )}
    >
      {showDot && (
        <span
          aria-hidden="true"
          className={clsx('h-1.5 w-1.5 rounded-full', colors.dot)}
        />
      )}
      {label}
    </span>
  )
}
