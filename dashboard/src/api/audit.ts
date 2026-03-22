import apiClient from './client'
import type { AuditLog, PaginatedResponse } from '@/types'

// ─── Audit Log API ────────────────────────────────────────────────────────────

export interface FetchAuditLogsParams {
  page?: number
  per_page?: number
  action_key?: string
  entity_type?: string
  actor_id?: string
}

export async function fetchAuditLogs(
  params: FetchAuditLogsParams = {},
): Promise<PaginatedResponse<AuditLog>> {
  const response = await apiClient.get<PaginatedResponse<AuditLog>>(
    '/api/v1/audit/logs',
    { params },
  )
  return response.data
}
