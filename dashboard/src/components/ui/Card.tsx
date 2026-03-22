import clsx from 'clsx'
import type { HTMLAttributes, ReactNode } from 'react'

// ─── Card Component ───────────────────────────────────────────────────────────

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export function Card({ children, padding = 'md', className, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-2xl bg-white shadow-sm ring-1 ring-neutral-100',
        paddingStyles[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// ─── Card Header ──────────────────────────────────────────────────────────────

interface CardHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
