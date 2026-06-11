'use client'

// ** core
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ** shared components
import { MobileNav } from '@/components/dashboard/mobile-nav'
import { DashboardNav } from '@/components/dashboard/nav'
import { TanstackQueryProvider } from '@/components/query-provider-tanstack'
import { NotificationProvider } from '@/components/NotificationProvider'

// ** config / utils / types / hooks
import { useAuth } from '@/lib/auth-context'
import { HRMProvider } from '@/lib/hrm-context'

export function DashboardLayoutShell({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, isLoading, router])

  return (
    <TanstackQueryProvider>
      <HRMProvider>
        {/* 🌟 2. ເອົາ NotificationProvider ມາຄອບໄວ້ບ່ອນນີ້ */}
        <NotificationProvider>
          <div className="min-h-screen bg-background">
            <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
              <DashboardNav />
            </aside>

            <main className="lg:pl-64 pb-20 lg:pb-0">
              <div className="p-4 lg:p-8 mx-auto">{children}</div>
            </main>

            <MobileNav />
          </div>
        </NotificationProvider>
      </HRMProvider>
    </TanstackQueryProvider>
  )
}