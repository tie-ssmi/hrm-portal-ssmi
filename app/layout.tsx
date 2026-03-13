import type { Metadata, Viewport } from 'next'
import { Noto_Sans_Lao } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/lib/auth-context'
import { HRMProvider } from '@/lib/hrm-context'
import { ThemeProvider } from '@/components/theme-provider'
import { QueryProvider } from '@/components/query-provider'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const notoSansLao = Noto_Sans_Lao({ 
  subsets: ["lao", "latin"], 
  variable: '--font-noto-sans-lao',
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900']
});

export const metadata: Metadata = {
  title: 'Employee HRM Portal',
  description: 'Human Resource Management System for Employees',
  generator: 'SSIM',
  icons: {
    icon: '/SSMI.svg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#3b5998',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="lo" suppressHydrationWarning>
      <body className={`${notoSansLao.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <AuthProvider>
              <HRMProvider>
                {children}
                <Toaster position="top-center" />
              </HRMProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
