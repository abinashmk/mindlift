import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { login } from '@/api/support'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import type { AxiosError } from 'axios'
import type { ApiError } from '@/types'

// ─── Schema ───────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
})

type LoginFormValues = z.infer<typeof loginSchema>

// ─── LoginPage ────────────────────────────────────────────────────────────────

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setMfaToken = useAuthStore((s) => s.setMfaToken)
  const [serverError, setServerError] = useState<string | null>(null)

  const from = (location.state as { from?: string } | null)?.from ?? '/queue'

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      setMfaToken(data.mfa_token)
      navigate('/mfa', { state: { from } })
    },
    onError: (error: AxiosError<ApiError>) => {
      if (error.response?.status === 401) {
        setServerError('Invalid email or password. Please try again.')
      } else {
        setServerError('An unexpected error occurred. Please try again.')
      }
    },
  })

  const onSubmit = (values: LoginFormValues) => {
    setServerError(null)
    loginMutation.mutate(values)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4">
      {/* Skip link for accessibility */}
      <a
        href="#login-form"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to form
      </a>

      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">MindLift</h1>
          <p className="mt-1 text-sm text-neutral-500">Support Team Portal</p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-neutral-100">
          <h2 className="mb-6 text-lg font-semibold text-neutral-800">
            Sign in to your account
          </h2>

          {/* Server error */}
          {serverError && (
            <div
              role="alert"
              className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
            >
              {serverError}
            </div>
          )}

          <form
            id="login-form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
          >
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-neutral-700"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                aria-describedby={errors.email ? 'email-error' : undefined}
                aria-invalid={errors.email ? 'true' : 'false'}
                className="block w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-red-200"
                placeholder="you@example.com"
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" role="alert" className="mt-1.5 text-xs text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-neutral-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-describedby={errors.password ? 'password-error' : undefined}
                aria-invalid={errors.password ? 'true' : 'false'}
                className="block w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-red-200"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password && (
                <p id="password-error" role="alert" className="mt-1.5 text-xs text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="mt-2 w-full"
              isLoading={loginMutation.isPending}
              loadingText="Signing in…"
            >
              Sign in
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-400">
          MindLift Support Portal — authorized access only
        </p>
      </div>
    </div>
  )
}
