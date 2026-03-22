import { Button } from '@/components/ui/Button'
import { useTransitionEscalation } from '@/hooks/useEscalations'
import type { Escalation, EscalationStatus, StatusTransition } from '@/types'

// ─── Valid Transitions ────────────────────────────────────────────────────────

interface TransitionConfig {
  transition: StatusTransition
  label: string
  variant: 'primary' | 'secondary' | 'danger' | 'outline'
  fromStatuses: EscalationStatus[]
}

const TRANSITIONS: TransitionConfig[] = [
  {
    transition: 'acknowledge',
    label: 'Acknowledge',
    variant: 'primary',
    fromStatuses: ['NEW'],
  },
  {
    transition: 'start_working',
    label: 'Start Working',
    variant: 'primary',
    fromStatuses: ['ACK'],
  },
  {
    transition: 'resolve',
    label: 'Mark Resolved',
    variant: 'primary',
    fromStatuses: ['IN_PROGRESS'],
  },
  {
    transition: 'close_no_action',
    label: 'Close – No Action',
    variant: 'outline',
    fromStatuses: ['NEW', 'ACK'],
  },
]

const TERMINAL_STATUSES: EscalationStatus[] = ['RESOLVED', 'CLOSED_NO_ACTION']

// ─── StatusTransitionButtons ──────────────────────────────────────────────────

interface StatusTransitionButtonsProps {
  escalation: Escalation
  onTransitioned?: () => void
}

export function StatusTransitionButtons({
  escalation,
  onTransitioned,
}: StatusTransitionButtonsProps) {
  const transition = useTransitionEscalation()

  // Terminal states — no actions
  if (TERMINAL_STATUSES.includes(escalation.status)) {
    return null
  }

  const validTransitions = TRANSITIONS.filter((t) =>
    t.fromStatuses.includes(escalation.status),
  )

  if (validTransitions.length === 0) return null

  const handleTransition = (t: StatusTransition) => {
    transition.mutate(
      { id: escalation.id, body: { transition: t } },
      { onSuccess: () => onTransitioned?.() },
    )
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Status actions">
      {validTransitions.map((t) => (
        <Button
          key={t.transition}
          variant={t.variant}
          size="sm"
          isLoading={
            transition.isPending &&
            transition.variables?.body.transition === t.transition
          }
          loadingText={t.label + '…'}
          onClick={() => handleTransition(t.transition)}
          disabled={transition.isPending}
        >
          {t.label}
        </Button>
      ))}
    </div>
  )
}
