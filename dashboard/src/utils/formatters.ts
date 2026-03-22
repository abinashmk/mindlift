import { format, formatDistanceToNow, parseISO } from 'date-fns'
import type { RiskLevel, EscalationStatus } from '@/types'

// ─── Date Formatters ──────────────────────────────────────────────────────────

export function formatDateTime(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d, yyyy · h:mm a')
  } catch {
    return iso
  }
}

export function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d, yyyy')
  } catch {
    return iso
  }
}

export function formatTimeAgo(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true })
  } catch {
    return iso
  }
}

export function formatTime(iso: string): string {
  try {
    return format(parseISO(iso), 'h:mm a')
  } catch {
    return iso
  }
}

// ─── Risk Level Styling ───────────────────────────────────────────────────────

export interface RiskColorConfig {
  bg: string
  text: string
  border: string
  dot: string
}

export const RISK_COLORS: Record<RiskLevel, RiskColorConfig> = {
  GREEN: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
  YELLOW: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-200',
    dot: 'bg-yellow-400',
  },
  ORANGE: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
  },
  RED: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-200',
    dot: 'bg-red-600',
  },
  UNDEFINED: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-200',
    dot: 'bg-gray-400',
  },
}

// ─── Status Styling ───────────────────────────────────────────────────────────

export interface StatusColorConfig {
  bg: string
  text: string
  border: string
}

export const STATUS_COLORS: Record<EscalationStatus, StatusColorConfig> = {
  NEW: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-200',
  },
  ACK: {
    bg: 'bg-indigo-100',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
  },
  IN_PROGRESS: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-200',
  },
  RESOLVED: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-200',
  },
  CLOSED_NO_ACTION: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-200',
  },
}

// ─── Source Formatters ────────────────────────────────────────────────────────

export function formatSource(source: string): string {
  const map: Record<string, string> = {
    risk_engine: 'Risk Engine',
    crisis_classifier: 'Crisis Classifier',
    manual_user_request: 'User Request',
    support_agent: 'Support Agent',
  }
  return map[source] ?? source
}

// ─── Role Formatters ──────────────────────────────────────────────────────────

export function formatRole(role: string): string {
  const map: Record<string, string> = {
    support_agent: 'Support Agent',
    support_manager: 'Support Manager',
    admin: 'Administrator',
    read_only_auditor: 'Auditor',
  }
  return map[role] ?? role
}

// ─── Numeric Formatters ───────────────────────────────────────────────────────

export function formatDecimal(value: number | null, decimals = 1): string {
  if (value === null) return '—'
  return value.toFixed(decimals)
}

export function formatPercent(value: number | null): string {
  if (value === null) return '—'
  return `${(value * 100).toFixed(0)}%`
}

// ─── String Formatters ────────────────────────────────────────────────────────

export function truncateId(id: string, length = 8): string {
  if (id.length <= length) return id
  return `${id.slice(0, length)}…`
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

export function arrayToCsv(headers: string[], rows: string[][]): string {
  const escape = (cell: string) => {
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`
    }
    return cell
  }
  const headerLine = headers.map(escape).join(',')
  const dataLines = rows.map((row) => row.map(escape).join(','))
  return [headerLine, ...dataLines].join('\n')
}

export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
