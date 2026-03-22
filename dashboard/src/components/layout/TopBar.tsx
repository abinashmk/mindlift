import { useState } from 'react'
import clsx from 'clsx'
import { Sidebar } from './Sidebar'
import { useCurrentUser } from '@/hooks/useCurrentUser'

// ─── TopBar ───────────────────────────────────────────────────────────────────

interface TopBarProps {
  title?: string
}

export function TopBar({ title }: TopBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { currentUser } = useCurrentUser()

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-4 lg:px-6">
        {/* Mobile menu toggle */}
        <button
          aria-label="Open navigation menu"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen(true)}
          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand-500 lg:hidden"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Page title (optional) */}
        {title && (
          <h1 className="hidden text-sm font-semibold text-neutral-800 lg:block">
            {title}
          </h1>
        )}

        {/* Right side: user avatar / info */}
        <div className="ml-auto flex items-center gap-3">
          {currentUser && (
            <div className="flex items-center gap-2">
              <div
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700"
              >
                {currentUser.email.charAt(0).toUpperCase()}
              </div>
              <span className="hidden text-sm text-neutral-600 sm:block">
                {currentUser.email}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-neutral-900/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            className={clsx(
              'absolute left-0 top-0 h-full w-64 shadow-xl',
              'transform transition-transform duration-200 ease-out',
            )}
          >
            <Sidebar onClose={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
