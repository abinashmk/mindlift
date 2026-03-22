import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { verifyMfa } from '@/api/support'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import type { AxiosError } from 'axios'
import type { ApiError } from '@/types'

// ─── MfaPage ──────────────────────────────────────────────────────────────────

const OTP_LENGTH = 6

export function MfaPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const mfaToken = useAuthStore((s) => s.mfaToken)
  const setAuth = useAuthStore((s) => s.setAuth)

  const from = (location.state as { from?: string } | null)?.from ?? '/queue'

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [serverError, setServerError] = useState<string | null>(null)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Redirect if no mfa token in store
  if (!mfaToken) {
    navigate('/login', { replace: true })
    return null
  }

  const otp = digits.join('')

  const verifyMutation = useMutation({
    mutationFn: verifyMfa,
    onSuccess: (data) => {
      setAuth(data.user, {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_type: data.token_type,
        expires_in: data.expires_in,
      })
      navigate(from, { replace: true })
    },
    onError: (error: AxiosError<ApiError>) => {
      if (error.response?.status === 401 || error.response?.status === 422) {
        setServerError('Invalid code. Please check your authenticator and try again.')
      } else {
        setServerError('Verification failed. Please try again.')
      }
      // Clear inputs
      setDigits(Array(OTP_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
    },
  })

  const handleChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(-1)
    const newDigits = [...digits]
    newDigits[index] = val
    setDigits(newDigits)
    setServerError(null)

    if (val && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all filled
    if (val && newDigits.every((d) => d !== '') && newDigits.join('').length === OTP_LENGTH) {
      handleVerify(newDigits.join(''))
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const newDigits = [...digits]
        newDigits[index] = ''
        setDigits(newDigits)
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (pasted.length === OTP_LENGTH) {
      const newDigits = pasted.split('')
      setDigits(newDigits)
      inputRefs.current[OTP_LENGTH - 1]?.focus()
      handleVerify(pasted)
    }
  }

  const handleVerify = (code: string = otp) => {
    if (code.length !== OTP_LENGTH) return
    setServerError(null)
    verifyMutation.mutate({ mfa_token: mfaToken, otp_code: code })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Two-Factor Auth</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-neutral-100">
          {/* Server error */}
          {serverError && (
            <div
              role="alert"
              className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
            >
              {serverError}
            </div>
          )}

          <div
            role="group"
            aria-label="One-time password input"
            className="mb-6 flex justify-center gap-2"
            onPaste={handlePaste}
          >
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                aria-label={`Digit ${i + 1}`}
                onChange={(e) => handleChange(i, e)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="h-12 w-10 rounded-xl border border-neutral-200 text-center text-lg font-semibold text-neutral-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            ))}
          </div>

          <Button
            variant="primary"
            size="md"
            className="w-full"
            onClick={() => handleVerify()}
            disabled={otp.length !== OTP_LENGTH || verifyMutation.isPending}
            isLoading={verifyMutation.isPending}
            loadingText="Verifying…"
          >
            Verify
          </Button>

          <p className="mt-4 text-center text-xs text-neutral-400">
            Code expires in a few minutes.{' '}
            <button
              className="text-brand-600 hover:underline focus:outline-none"
              onClick={() => navigate('/login')}
            >
              Back to login
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
