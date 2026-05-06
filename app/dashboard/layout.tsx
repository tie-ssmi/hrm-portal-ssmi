import type { Metadata } from 'next'

import { DashboardLayoutShell } from '@/components/dashboard/dashboard-layout-shell'

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
  return <DashboardLayoutShell>{children}</DashboardLayoutShell>
}
