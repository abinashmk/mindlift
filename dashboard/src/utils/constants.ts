import type { SupportRole, EscalationStatus, RiskLevel } from '@/types'

// ─── Route Constants ──────────────────────────────────────────────────────────

export const ROUTES = {
  LOGIN: '/login',
  MFA: '/mfa',
  QUEUE: '/queue',
  ESCALATION_DETAIL: '/escalations/:id',
  AUDIT_LOG: '/audit',
  SYSTEM_HEALTH: '/system-health',
  USER_MANAGEMENT: '/users',
  UNAUTHORIZED: '/unauthorized',
} as const

// ─── Role Permissions ─────────────────────────────────────────────────────────

export const ROLE_ROUTE_MAP: Record<string, SupportRole[]> = {
  '/queue': ['support_agent', 'support_manager'],
  '/escalations': ['support_agent', 'support_manager'],
  '/audit': ['admin', 'read_only_auditor'],
  '/system-health': ['admin'],
  '/users': ['admin'],
}

export const ALL_ROLES: SupportRole[] = [
  'support_agent',
  'support_manager',
  'admin',
  'read_only_auditor',
]

// ─── Escalation Status Labels ─────────────────────────────────────────────────

export const STATUS_LABELS: Record<EscalationStatus, string> = {
  NEW: 'New',
  ACK: 'Acknowledged',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED_NO_ACTION: 'Closed – No Action',
}

// ─── Risk Level Labels ────────────────────────────────────────────────────────

export const RISK_LABELS: Record<RiskLevel, string> = {
  UNDEFINED: 'Undefined',
  GREEN: 'Green',
  YELLOW: 'Yellow',
  ORANGE: 'Orange',
  RED: 'Red',
}

// ─── Message Templates ────────────────────────────────────────────────────────

export interface MessageTemplate {
  key: string
  label: string
  text: string
}

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    key: 'received_reviewing',
    label: 'Received & Reviewing',
    text: 'We have received your escalation and are reviewing it.',
  },
  {
    key: 'team_contact_soon',
    label: 'Team Will Contact You',
    text: 'A support team member will contact you shortly.',
  },
  {
    key: 'emergency_services',
    label: 'Emergency Services',
    text: 'Please reach out to emergency services if you are in immediate danger.',
  },
]

// ─── Pagination ───────────────────────────────────────────────────────────────

export const AUDIT_LOG_PER_PAGE = 50

// ─── System Health Refresh Interval ──────────────────────────────────────────

export const SYSTEM_HEALTH_REFRESH_MS = 30_000

// ─── Escalation Sort Priority ─────────────────────────────────────────────────

export const RISK_SORT_ORDER: Record<RiskLevel, number> = {
  RED: 0,
  ORANGE: 1,
  YELLOW: 2,
  GREEN: 3,
  UNDEFINED: 4,
}
