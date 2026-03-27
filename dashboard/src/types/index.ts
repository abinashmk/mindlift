// ─── Core Domain Types ────────────────────────────────────────────────────────

export type RiskLevel = 'UNDEFINED' | 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED'

export type EscalationStatus =
  | 'NEW'
  | 'ACK'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED_NO_ACTION'

export type EscalationSource =
  | 'risk_engine'
  | 'crisis_classifier'
  | 'manual_user_request'
  | 'support_agent'

export type SupportRole =
  | 'support_agent'
  | 'support_manager'
  | 'admin'
  | 'read_only_auditor'

// ─── Escalation Packet ────────────────────────────────────────────────────────

export interface Last7DaySummary {
  sleep_hours_avg: number | null
  steps_avg: number | null
  screen_time_avg: number | null
  mood_avg: number | null
  home_ratio_avg: number | null
}

export interface ChatMessage {
  sender_type: 'user' | 'assistant' | 'system'
  message_text: string | null
  created_at: string
}

export interface EscalationPacket {
  user_id: string
  timestamp: string
  source: EscalationSource
  risk_level: RiskLevel
  risk_score: number
  last_7_day_summary: Last7DaySummary
  last_5_messages: ChatMessage[]
}

// ─── Escalation ───────────────────────────────────────────────────────────────

export interface Escalation {
  id: string
  user_id: string
  source: EscalationSource
  status: EscalationStatus
  risk_level: RiskLevel
  packet: EscalationPacket
  assigned_agent_id: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
}

// ─── Support User ─────────────────────────────────────────────────────────────

export interface SupportUser {
  id: string
  email: string
  role: SupportRole
  mfa_enabled: boolean
  is_active: boolean
  must_change_password: boolean
  created_at: string
  updated_at: string
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string
  actor_type: string
  actor_id: string | null
  action_key: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  // Direct login (MFA disabled)
  access_token?: string
  token_type?: string
  expires_in?: number
  // MFA pending
  mfa_token?: string
  mfa_required?: boolean
}

export interface MfaVerifyRequest {
  mfa_token: string
  otp_code: string
}

export interface MfaVerifyResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  user: SupportUser
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface ApiError {
  detail: string
  code?: string
}

// ─── Escalation Actions ───────────────────────────────────────────────────────

export type StatusTransition =
  | 'acknowledge'
  | 'start_working'
  | 'resolve'
  | 'close_no_action'

export interface TransitionEscalationRequest {
  transition: StatusTransition
  note?: string
}

export interface AssignEscalationRequest {
  agent_id: string
}

export interface SendTemplateMessageRequest {
  template_key: string
  escalation_id: string
}

// ─── System Health ────────────────────────────────────────────────────────────

export type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'unknown'

export interface SystemHealth {
  api_status: ServiceStatus
  database_status: ServiceStatus
  redis_status: ServiceStatus
  celery_status: ServiceStatus
  total_active_users: number
  open_escalations_count: number
  new_escalations_count: number
  checked_at: string
}

// ─── User Management ─────────────────────────────────────────────────────────

export interface CreateSupportUserRequest {
  email: string
  role: SupportRole
  password: string
}

export interface DeactivateUserRequest {
  user_id: string
}
