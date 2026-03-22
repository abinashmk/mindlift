import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Tr, Td } from '@/components/ui/Table'
import { formatDateTime, formatSource, truncateId } from '@/utils/formatters'
import type { Escalation } from '@/types'

// ─── EscalationRow ────────────────────────────────────────────────────────────

interface EscalationRowProps {
  escalation: Escalation
}

export function EscalationRow({ escalation }: EscalationRowProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate(`/escalations/${escalation.id}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <Tr
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      isClickable
      role="row"
      tabIndex={0}
      aria-label={`Escalation ${truncateId(escalation.id)}, risk level ${escalation.risk_level}, status ${escalation.status}`}
    >
      <Td className="whitespace-nowrap text-xs text-neutral-500">
        {formatDateTime(escalation.created_at)}
      </Td>
      <Td>
        <Badge level={escalation.risk_level} />
      </Td>
      <Td>
        <StatusBadge status={escalation.status} />
      </Td>
      <Td className="font-mono text-xs text-neutral-600">
        <span title={escalation.user_id}>
          {truncateId(escalation.user_id)}
        </span>
      </Td>
      <Td className="text-neutral-600">
        {formatSource(escalation.source)}
      </Td>
      <Td className="text-neutral-500">
        {escalation.assigned_agent_id ? (
          <span
            className="font-mono text-xs"
            title={escalation.assigned_agent_id}
          >
            {truncateId(escalation.assigned_agent_id)}
          </span>
        ) : (
          <span className="text-xs italic text-neutral-400">Unassigned</span>
        )}
      </Td>
    </Tr>
  )
}
