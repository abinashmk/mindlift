import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import {
  fetchEscalations,
  fetchEscalation,
  transitionEscalation,
  assignEscalation,
  sendTemplateMessage,
  fetchAgents,
  type FetchEscalationsParams,
} from '@/api/escalations'
import type {
  Escalation,
  PaginatedResponse,
  TransitionEscalationRequest,
  AssignEscalationRequest,
  SendTemplateMessageRequest,
} from '@/types'

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const escalationKeys = {
  all: ['escalations'] as const,
  lists: () => [...escalationKeys.all, 'list'] as const,
  list: (params: FetchEscalationsParams) =>
    [...escalationKeys.lists(), params] as const,
  details: () => [...escalationKeys.all, 'detail'] as const,
  detail: (id: string) => [...escalationKeys.details(), id] as const,
  agents: ['agents'] as const,
}

// ─── useEscalations (queue) ───────────────────────────────────────────────────

export function useEscalations(
  params: FetchEscalationsParams = {},
): UseQueryResult<PaginatedResponse<Escalation>> {
  return useQuery({
    queryKey: escalationKeys.list(params),
    queryFn: () => fetchEscalations(params),
    staleTime: 30_000,
  })
}

// ─── useEscalation (single) ───────────────────────────────────────────────────

export function useEscalation(id: string): UseQueryResult<Escalation> {
  return useQuery({
    queryKey: escalationKeys.detail(id),
    queryFn: () => fetchEscalation(id),
    enabled: Boolean(id),
    staleTime: 15_000,
  })
}

// ─── useTransitionEscalation ──────────────────────────────────────────────────

export function useTransitionEscalation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: TransitionEscalationRequest
    }) => transitionEscalation(id, body),
    onSuccess: (updated) => {
      // Update single escalation cache
      queryClient.setQueryData(escalationKeys.detail(updated.id), updated)
      // Invalidate list queries so queue reflects new status
      void queryClient.invalidateQueries({ queryKey: escalationKeys.lists() })
    },
  })
}

// ─── useAssignEscalation ──────────────────────────────────────────────────────

export function useAssignEscalation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: AssignEscalationRequest
    }) => assignEscalation(id, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(escalationKeys.detail(updated.id), updated)
      void queryClient.invalidateQueries({ queryKey: escalationKeys.lists() })
    },
  })
}

// ─── useSendTemplateMessage ───────────────────────────────────────────────────

export function useSendTemplateMessage() {
  return useMutation({
    mutationFn: (body: SendTemplateMessageRequest) => sendTemplateMessage(body),
  })
}

// ─── useAgents ────────────────────────────────────────────────────────────────

export function useAgents() {
  return useQuery({
    queryKey: escalationKeys.agents,
    queryFn: fetchAgents,
    staleTime: 5 * 60_000, // 5 minutes
  })
}
