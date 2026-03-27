import apiClient from './client'
import type {
  Escalation,
  PaginatedResponse,
  TransitionEscalationRequest,
  AssignEscalationRequest,
  SendTemplateMessageRequest,
} from '@/types'

// ─── Escalation API ───────────────────────────────────────────────────────────

export interface FetchEscalationsParams {
  page?: number
  per_page?: number
  assigned_only?: boolean
  unassigned_only?: boolean
  status?: string
  risk_level?: string
}

/**
 * Fetch paginated escalations for the queue.
 * - support_agent: backend enforces assigned_only filtering server-side
 * - support_manager: can request unassigned_only
 */
export async function fetchEscalations(
  params: FetchEscalationsParams = {},
): Promise<PaginatedResponse<Escalation>> {
  const response = await apiClient.get<PaginatedResponse<Escalation>>(
    '/v1/support/escalations',
    { params },
  )
  return response.data
}

/**
 * Fetch a single escalation by ID.
 */
export async function fetchEscalation(id: string): Promise<Escalation> {
  const response = await apiClient.get<Escalation>(
    `/v1/support/escalations/${id}`,
  )
  return response.data
}

/**
 * Transition an escalation status.
 */
export async function transitionEscalation(
  id: string,
  body: TransitionEscalationRequest,
): Promise<Escalation> {
  const response = await apiClient.post<Escalation>(
    `/v1/support/escalations/${id}/status`,
    body,
  )
  return response.data
}

/**
 * Assign an escalation to an agent (manager only).
 */
export async function assignEscalation(
  id: string,
  body: AssignEscalationRequest,
): Promise<Escalation> {
  const response = await apiClient.post<Escalation>(
    `/v1/support/escalations/${id}/assign`,
    body,
  )
  return response.data
}

/**
 * Send a predefined template message to the escalation's user.
 */
export async function sendTemplateMessage(
  body: SendTemplateMessageRequest,
): Promise<void> {
  await apiClient.post(
    `/v1/support/escalations/${body.escalation_id}/message`,
    { template_key: body.template_key },
  )
}

/**
 * Fetch all agents for assignment dropdown (manager only).
 */
export async function fetchAgents(): Promise<
  Array<{ id: string; email: string }>
> {
  const response = await apiClient.get<Array<{ id: string; email: string }>>(
    '/v1/support/agents',
  )
  return response.data
}
