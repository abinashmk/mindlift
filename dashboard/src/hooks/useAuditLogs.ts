import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { fetchAuditLogs, type FetchAuditLogsParams } from '@/api/audit'
import type { AuditLog, PaginatedResponse } from '@/types'

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const auditKeys = {
  all: ['audit'] as const,
  lists: () => [...auditKeys.all, 'list'] as const,
  list: (params: FetchAuditLogsParams) =>
    [...auditKeys.lists(), params] as const,
}

// ─── useAuditLogs ─────────────────────────────────────────────────────────────

export function useAuditLogs(
  params: FetchAuditLogsParams = {},
): UseQueryResult<PaginatedResponse<AuditLog>> {
  return useQuery({
    queryKey: auditKeys.list(params),
    queryFn: () => fetchAuditLogs(params),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })
}
