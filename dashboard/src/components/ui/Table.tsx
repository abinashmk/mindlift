import clsx from 'clsx'
import type { ReactNode } from 'react'

// ─── Table Components ─────────────────────────────────────────────────────────

interface TableProps {
  children: ReactNode
  className?: string
  'aria-label'?: string
}

export function Table({ children, className, 'aria-label': ariaLabel }: TableProps) {
  return (
    <div className={clsx('w-full overflow-x-auto', className)}>
      <table
        className="w-full border-collapse text-sm"
        aria-label={ariaLabel}
      >
        {children}
      </table>
    </div>
  )
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-neutral-200 bg-neutral-50">
      {children}
    </thead>
  )
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-neutral-100">{children}</tbody>
}

interface ThProps {
  children: ReactNode
  className?: string
  scope?: 'col' | 'row'
}

export function Th({ children, className, scope = 'col' }: ThProps) {
  return (
    <th
      scope={scope}
      className={clsx(
        'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500',
        className,
      )}
    >
      {children}
    </th>
  )
}

interface TdProps {
  children: ReactNode
  className?: string
}

export function Td({ children, className }: TdProps) {
  return (
    <td className={clsx('px-4 py-3 text-neutral-700', className)}>
      {children}
    </td>
  )
}

interface TrProps {
  children: ReactNode
  onClick?: () => void
  className?: string
  isClickable?: boolean
}

export function Tr({ children, onClick, className, isClickable }: TrProps) {
  return (
    <tr
      onClick={onClick}
      className={clsx(
        'transition-colors duration-100',
        isClickable &&
          'cursor-pointer hover:bg-brand-50 focus-within:bg-brand-50',
        className,
      )}
    >
      {children}
    </tr>
  )
}

// ─── Table Empty State ────────────────────────────────────────────────────────

interface TableEmptyProps {
  message?: string
  colSpan?: number
}

export function TableEmpty({
  message = 'No records found.',
  colSpan = 8,
}: TableEmptyProps) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-12 text-center text-sm text-neutral-500"
      >
        {message}
      </td>
    </tr>
  )
}

// ─── Table Loading State ──────────────────────────────────────────────────────

export function TableSkeleton({
  rows = 5,
  cols = 6,
}: {
  rows?: number
  cols?: number
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-neutral-100">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 rounded bg-neutral-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
