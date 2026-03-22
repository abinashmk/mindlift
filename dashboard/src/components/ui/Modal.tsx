import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'

// ─── Modal Component ──────────────────────────────────────────────────────────

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  footer?: ReactNode
}

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousActiveEl = useRef<Element | null>(null)

  // Trap focus and manage body scroll
  useEffect(() => {
    if (isOpen) {
      previousActiveEl.current = document.activeElement
      document.body.style.overflow = 'hidden'
      // Focus the dialog on open
      setTimeout(() => dialogRef.current?.focus(), 10)
    } else {
      document.body.style.overflow = ''
      // Restore focus on close
      if (previousActiveEl.current instanceof HTMLElement) {
        previousActiveEl.current.focus()
      }
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={clsx(
          'relative z-10 w-full rounded-2xl bg-white shadow-xl ring-1 ring-neutral-100',
          'focus:outline-none',
          sizeStyles[size],
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
          <h2
            id="modal-title"
            className="text-base font-semibold text-neutral-900"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex justify-end gap-3 border-t border-neutral-100 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
