import clsx from 'clsx'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

// ─── Button Component ─────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  loadingText?: string
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500 disabled:bg-brand-300',
  secondary:
    'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 focus:ring-neutral-400 disabled:bg-neutral-50 disabled:text-neutral-400',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300',
  ghost:
    'bg-transparent text-neutral-600 hover:bg-neutral-100 focus:ring-neutral-400 disabled:text-neutral-300',
  outline:
    'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 focus:ring-neutral-400 disabled:text-neutral-400 disabled:border-neutral-200',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loadingText,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        className={clsx(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
          'transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          'disabled:cursor-not-allowed',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        {isLoading && (
          <svg
            aria-hidden="true"
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {isLoading && loadingText ? loadingText : children}
      </button>
    )
  },
)

Button.displayName = 'Button'
