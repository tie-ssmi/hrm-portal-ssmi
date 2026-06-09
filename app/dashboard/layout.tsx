import type { Metadata } from 'next'

import { DashboardLayoutShell } from '@/components/dashboard/dashboard-layout-shell'
import { NotificationProvider } from "@/components/NotificationProvider"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <NotificationProvider>
      <DashboardLayoutShell>{children}</DashboardLayoutShell>
    </NotificationProvider>
  ) 
}
