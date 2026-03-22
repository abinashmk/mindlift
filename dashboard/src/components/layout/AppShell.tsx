import { type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

// ─── AppShell ─────────────────────────────────────────────────────────────────

interface AppShellProps {
  children: ReactNode
  pageTitle?: string
}

export function AppShell({ children, pageTitle }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      {/* Desktop Sidebar */}
      <aside
        className="hidden w-56 flex-shrink-0 border-r border-neutral-200 lg:flex lg:flex-col"
        aria-label="Sidebar navigation"
      >
        <Sidebar />
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title={pageTitle} />

        <main
          id="main-content"
          className="flex-1 overflow-y-auto px-4 py-6 lg:px-6 lg:py-8"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
