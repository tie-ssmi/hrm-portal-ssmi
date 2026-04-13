'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { HRMProvider } from '@/lib/hrm-context'
import { TanstackQueryProvider } from '@/components/query-provider-tanstack'
import { DashboardNav } from '@/components/dashboard/nav'
import { MobileNav } from '@/components/dashboard/mobile-nav'

export default function DashboardLayout({
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

  // if (isLoading || !isAuthenticated) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center bg-background">
  //       <div className="loader"></div>
  //     </div>
  //   )
  // }

  return (
    <TanstackQueryProvider>
      <HRMProvider>
        <div className="min-h-screen bg-background">
          {/* Desktop sidebar */}
          <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
            <DashboardNav />
          </aside>
          
          {/* Main content */}
          <main className="lg:pl-64 pb-20 lg:pb-0">
            <div className="p-4 lg:p-8  mx-auto">
              {children}
            </div>
          </main>
          
          {/* Mobile bottom navigation */}
          <MobileNav />
        </div>
      </HRMProvider>
    </TanstackQueryProvider>
  )
}
