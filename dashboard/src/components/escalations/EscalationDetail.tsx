import clsx from 'clsx'
import { useState } from 'react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusTransitionButtons } from './StatusTransitionButtons'
import { useAssignEscalation, useSendTemplateMessage, useAgents } from '@/hooks/useEscalations'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { formatDateTime, formatTime, formatDecimal, formatPercent } from '@/utils/formatters'
import { MESSAGE_TEMPLATES } from '@/utils/constants'
import type { Escalation } from '@/types'

// ─── User Summary Section ─────────────────────────────────────────────────────

interface SummaryRowProps {
  label: string
  value: string
}

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <tr className="border-b border-neutral-100 last:border-0">
      <td className="py-2 pr-4 text-sm font-medium text-neutral-600">{label}</td>
      <td className="py-2 text-sm text-neutral-900">{value}</td>
    </tr>
  )
}

// ─── Chat Bubble ──────────────────────────────────────────────────────────────

interface ChatBubbleProps {
  senderType: 'user' | 'assistant' | 'system'
  messageText: string | null
  createdAt: string
}

function ChatBubble({ senderType, messageText, createdAt }: ChatBubbleProps) {
  const isUser = senderType === 'user'
  const isSystem = senderType === 'system'

  return (
    <div
      className={clsx(
        'flex',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={clsx(
          'max-w-[75%] rounded-2xl px-4 py-2.5',
          isUser && 'rounded-br-sm bg-brand-600 text-white',
          !isUser && !isSystem && 'rounded-bl-sm bg-neutral-100 text-neutral-800',
          isSystem && 'rounded-bl-sm bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200',
        )}
      >
        {isSystem && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-70">
            System
          </p>
        )}
        <p className="text-sm">
          {messageText ?? (
            <span className="italic opacity-60">(message not logged)</span>
          )}
        </p>
        <p
          className={clsx(
            'mt-1 text-right text-xs',
            isUser ? 'text-white/70' : 'text-neutral-400',
          )}
        >
          {formatTime(createdAt)}
        </p>
      </div>
    </div>
  )
}

// ─── EscalationDetail ─────────────────────────────────────────────────────────

interface EscalationDetailProps {
  escalation: Escalation
}

export function EscalationDetail({ escalation }: EscalationDetailProps) {
  const { isManager } = useCurrentUser()
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [selectedAgentId, setSelectedAgentId] = useState(
    escalation.assigned_agent_id ?? '',
  )
  const [messageSent, setMessageSent] = useState(false)

  const sendTemplate = useSendTemplateMessage()
  const assignEscalation = useAssignEscalation()
  const { data: agents } = useAgents()

  const summary = escalation.packet.last_7_day_summary
  const messages = escalation.packet.last_5_messages

  const handleSendTemplate = () => {
    if (!selectedTemplate) return
    sendTemplate.mutate(
      {
        template_key: selectedTemplate,
        escalation_id: escalation.id,
      },
      {
        onSuccess: () => {
          setMessageSent(true)
          setSelectedTemplate('')
          setTimeout(() => setMessageSent(false), 3000)
        },
      },
    )
  }

  const handleAssign = () => {
    if (!selectedAgentId) return
    assignEscalation.mutate({
      id: escalation.id,
      body: { agent_id: selectedAgentId },
    })
  }

  return (
    <div className="space-y-6">
      {/* User Summary */}
      <Card>
        <CardHeader
          title="7-Day User Summary"
          subtitle="Averaged wellness metrics from the past 7 days"
        />
        <table className="w-full" aria-label="7-day wellness summary">
          <tbody>
            <SummaryRow
              label="Avg Sleep (hours)"
              value={formatDecimal(summary.sleep_hours_avg)}
            />
            <SummaryRow
              label="Avg Steps"
              value={
                summary.steps_avg !== null
                  ? Math.round(summary.steps_avg).toLocaleString()
                  : '—'
              }
            />
            <SummaryRow
              label="Avg Screen Time (hours)"
              value={formatDecimal(summary.screen_time_avg)}
            />
            <SummaryRow
              label="Avg Mood Score"
              value={formatDecimal(summary.mood_avg)}
            />
            <SummaryRow
              label="Home Time Ratio"
              value={formatPercent(summary.home_ratio_avg)}
            />
          </tbody>
        </table>
      </Card>

      {/* Recent Chat */}
      <Card>
        <CardHeader
          title="Recent Chat"
          subtitle="Last 5 messages from this user's session"
        />
        {messages.length === 0 ? (
          <p className="text-sm italic text-neutral-400">
            No messages available.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <ChatBubble
                key={i}
                senderType={msg.sender_type}
                messageText={msg.message_text}
                createdAt={msg.created_at}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader title="Actions" />

        <div className="space-y-5">
          {/* Status Transitions */}
          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">
              Status Transition
            </p>
            <StatusTransitionButtons escalation={escalation} />
            {['RESOLVED', 'CLOSED_NO_ACTION'].includes(escalation.status) && (
              <p className="text-sm italic text-neutral-400">
                This escalation is closed. No further actions are available.
              </p>
            )}
          </div>

          {/* Assign to Agent (manager only) */}
          {isManager && (
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Assign to Agent
              </p>
              <div className="flex items-center gap-3">
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  aria-label="Select agent"
                  className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="">— Select an agent —</option>
                  {agents?.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.email}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAssign}
                  disabled={!selectedAgentId || assignEscalation.isPending}
                  isLoading={assignEscalation.isPending}
                  loadingText="Assigning…"
                >
                  Assign
                </Button>
              </div>
              {assignEscalation.isSuccess && (
                <p className="mt-1.5 text-xs text-green-600">
                  Agent assigned successfully.
                </p>
              )}
            </div>
          )}

          {/* Template Message */}
          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">
              Send Template Message
            </p>
            <div className="flex items-start gap-3">
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                aria-label="Select message template"
                className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="">— Select a template —</option>
                {MESSAGE_TEMPLATES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSendTemplate}
                disabled={!selectedTemplate || sendTemplate.isPending}
                isLoading={sendTemplate.isPending}
                loadingText="Sending…"
              >
                Send
              </Button>
            </div>
            {selectedTemplate && (
              <p className="mt-1.5 text-xs text-neutral-500">
                Preview:{' '}
                <em>
                  {MESSAGE_TEMPLATES.find((t) => t.key === selectedTemplate)?.text}
                </em>
              </p>
            )}
            {messageSent && (
              <p className="mt-1.5 text-xs font-medium text-green-600">
                Message sent successfully.
              </p>
            )}
            {sendTemplate.isError && (
              <p className="mt-1.5 text-xs text-red-600">
                Failed to send message. Please try again.
              </p>
            )}
          </div>

          {/* Timestamps */}
          <div className="border-t border-neutral-100 pt-4">
            <dl className="grid grid-cols-2 gap-3 text-xs text-neutral-500">
              <div>
                <dt className="font-medium">Created</dt>
                <dd className="mt-0.5">{formatDateTime(escalation.created_at)}</dd>
              </div>
              <div>
                <dt className="font-medium">Last Updated</dt>
                <dd className="mt-0.5">{formatDateTime(escalation.updated_at)}</dd>
              </div>
              {escalation.resolved_at && (
                <div>
                  <dt className="font-medium">Resolved</dt>
                  <dd className="mt-0.5">{formatDateTime(escalation.resolved_at)}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </Card>
    </div>
  )
}
