'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { MobileNav } from '@/components/dashboard/mobile-nav'
import { DashboardNav } from '@/components/dashboard/nav'
import { TanstackQueryProvider } from '@/components/query-provider-tanstack'
import { NotificationProvider } from '@/components/NotificationProvider'
import { useAuth } from '@/lib/auth-context'
import { HRMProvider } from '@/lib/hrm-context'
import { NavigationProgressProvider, useNavProgress } from '@/lib/navigation-context'
import { cn } from '@/lib/utils'

function NavProgressBar() {
  const { isNavigating } = useNavProgress()
  return (
    <div
      aria-hidden
      className={cn(
        'fixed top-0 left-0 right-0 z-[200] h-[2px] overflow-hidden pointer-events-none',
        'transition-opacity duration-500',
        isNavigating ? 'opacity-100' : 'opacity-0',
      )}
    >
      {isNavigating && (
        <div
          className="h-full w-1/3 bg-primary rounded-full"
          style={{ animation: 'nav-shimmer 1.2s ease-in-out infinite' }}
        />
      )}
    </div>
  )
}

function ShellContent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, isLoading, router])

  return (
    <div className="min-h-screen bg-background">
      <NavProgressBar />

      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <DashboardNav />
      </aside>

      <main className="lg:pl-64 pb-20 lg:pb-0">
        <div className="p-4 lg:p-8 mx-auto">{children}</div>
      </main>

      <MobileNav />
    </div>
  )
}

export function DashboardLayoutShell({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TanstackQueryProvider>
      <HRMProvider>
        <NotificationProvider>
          <NavigationProgressProvider>
            <ShellContent>{children}</ShellContent>
          </NavigationProgressProvider>
        </NotificationProvider>
      </HRMProvider>
    </TanstackQueryProvider>
  )
}
