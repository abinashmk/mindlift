import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AppShell } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import {
  Table,
  TableHead,
  TableBody,
  Th,
  Td,
  Tr,
  TableEmpty,
  TableSkeleton,
} from '@/components/ui/Table'
import { fetchSupportUsers, createSupportUser, deactivateSupportUser } from '@/api/support'
import { formatDateTime, formatRole } from '@/utils/formatters'
import type { SupportRole } from '@/types'

// ─── Create User Form Schema ──────────────────────────────────────────────────

const createUserSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  role: z.enum(
    ['support_agent', 'support_manager', 'admin', 'read_only_auditor'],
    { required_error: 'Please select a role.' },
  ),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters.')
    .regex(/[A-Z]/, 'Must contain an uppercase letter.')
    .regex(/[0-9]/, 'Must contain a number.'),
})

type CreateUserFormValues = z.infer<typeof createUserSchema>

const ROLE_OPTIONS: { value: SupportRole; label: string }[] = [
  { value: 'support_agent', label: 'Support Agent' },
  { value: 'support_manager', label: 'Support Manager' },
  { value: 'admin', label: 'Administrator' },
  { value: 'read_only_auditor', label: 'Read-Only Auditor' },
]

// ─── Create User Modal ────────────────────────────────────────────────────────

interface CreateUserModalProps {
  isOpen: boolean
  onClose: () => void
}

function CreateUserModal({ isOpen, onClose }: CreateUserModalProps) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
  })

  const createMutation = useMutation({
    mutationFn: createSupportUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['support-users'] })
      reset()
      onClose()
    },
  })

  const handleClose = () => {
    reset()
    createMutation.reset()
    onClose()
  }

  const onSubmit = (values: CreateUserFormValues) => {
    createMutation.mutate(values)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Support User"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            form="create-user-form"
            type="submit"
            isLoading={createMutation.isPending}
            loadingText="Creating…"
          >
            Create User
          </Button>
        </>
      }
    >
      {createMutation.isError && (
        <div
          role="alert"
          className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-200"
        >
          Failed to create user. Email may already be in use.
        </div>
      )}
      <form
        id="create-user-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="space-y-4"
      >
        {/* Email */}
        <div>
          <label
            htmlFor="new-email"
            className="mb-1.5 block text-sm font-medium text-neutral-700"
          >
            Email address
          </label>
          <input
            id="new-email"
            type="email"
            autoComplete="off"
            aria-describedby={errors.email ? 'new-email-error' : undefined}
            aria-invalid={errors.email ? 'true' : 'false'}
            className="block w-full rounded-lg border border-neutral-200 px-3.5 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 aria-[invalid=true]:border-red-400"
            placeholder="agent@mindlift.com"
            {...register('email')}
          />
          {errors.email && (
            <p id="new-email-error" role="alert" className="mt-1 text-xs text-red-600">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Role */}
        <div>
          <label
            htmlFor="new-role"
            className="mb-1.5 block text-sm font-medium text-neutral-700"
          >
            Role
          </label>
          <select
            id="new-role"
            aria-describedby={errors.role ? 'new-role-error' : undefined}
            aria-invalid={errors.role ? 'true' : 'false'}
            className="block w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 aria-[invalid=true]:border-red-400"
            {...register('role')}
          >
            <option value="">— Select a role —</option>
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {errors.role && (
            <p id="new-role-error" role="alert" className="mt-1 text-xs text-red-600">
              {errors.role.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="new-password"
            className="mb-1.5 block text-sm font-medium text-neutral-700"
          >
            Temporary password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            aria-describedby="password-help"
            aria-invalid={errors.password ? 'true' : 'false'}
            className="block w-full rounded-lg border border-neutral-200 px-3.5 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 aria-[invalid=true]:border-red-400"
            placeholder="Minimum 12 characters"
            {...register('password')}
          />
          <p id="password-help" className="mt-1 text-xs text-neutral-400">
            Min 12 chars, one uppercase, one number. User must change on first login.
          </p>
          {errors.password && (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {errors.password.message}
            </p>
          )}
        </div>
      </form>
    </Modal>
  )
}

// ─── UserManagementPage ───────────────────────────────────────────────────────

export function UserManagementPage() {
  const [isCreateModalOpen, setCreateModalOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['support-users'],
    queryFn: () => fetchSupportUsers({ per_page: 100 }),
  })

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => deactivateSupportUser(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['support-users'] })
    },
  })

  const users = data?.items ?? []

  return (
    <AppShell pageTitle="User Management">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">
              User Management
            </h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              {isLoading ? 'Loading…' : `${users.length} support user${users.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setCreateModalOpen(true)}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create User
          </Button>
        </div>

        {/* Error */}
        {isError && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
          >
            Failed to load users. Please refresh the page.
          </div>
        )}

        {/* Table */}
        <Card padding="none">
          <Table aria-label="Support users">
            <TableHead>
              <tr>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>MFA</Th>
                <Th>Created At</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableSkeleton rows={6} cols={6} />
              ) : users.length === 0 ? (
                <TableEmpty message="No support users found." colSpan={6} />
              ) : (
                users.map((user) => (
                  <Tr key={user.id}>
                    <Td className="font-medium text-neutral-800">
                      {user.email}
                    </Td>
                    <Td className="text-neutral-600">
                      {formatRole(user.role)}
                    </Td>
                    <Td>
                      {user.is_active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                          Deactivated
                        </span>
                      )}
                    </Td>
                    <Td>
                      {user.mfa_enabled ? (
                        <span className="text-sm text-green-600" aria-label="MFA enabled">
                          ✓ Enabled
                        </span>
                      ) : (
                        <span className="text-sm text-neutral-400" aria-label="MFA not enabled">
                          Not set
                        </span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-neutral-500">
                      {formatDateTime(user.created_at)}
                    </Td>
                    <Td>
                      {user.is_active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deactivateMutation.mutate(user.id)}
                          isLoading={
                            deactivateMutation.isPending &&
                            deactivateMutation.variables === user.id
                          }
                          loadingText="…"
                          className="text-red-500 hover:bg-red-50 hover:text-red-700"
                          aria-label={`Deactivate ${user.email}`}
                        >
                          Deactivate
                        </Button>
                      )}
                    </Td>
                  </Tr>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </AppShell>
  )
}
