import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/lib/auth-context'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import '@/app/globals.css'

export const metadata: Metadata = {
  title: 'ພະນັກງານສິນຊັບເມືອງເໜືອ | SSMI Laos HRM',
  description: 'ລະບົບການຄຸ້ມຄອງຊັບຍາກອນມະນຸດ ສຳລັບພະນັກງານ SSMI | Human Resource Management System for SSMI Laos Staff',
  keywords: ['ພະນັກງານສິນຊັບເມືອງເໜືອ', 'ssmi laos staff', 'hrm ssmi laos', 'ssmi laos', 'SSMI', 'HRM Laos'],
  authors: [{ name: 'SSMI Laos' }],
  creator: 'SSMI Laos',
  generator: 'SSMI',
  metadataBase: new URL('https://hrm-ssmi.firebaseapp.com'),
  openGraph: {
    title: 'ພະນັກງານສິນຊັບເມືອງເໜືອ | SSMI Laos HRM',
    description: 'ລະບົບການຄຸ້ມຄອງຊັບຍາກອນມະນຸດ ສຳລັບພະນັກງານ SSMI Laos',
    siteName: 'SSMI HRM Portal',
    locale: 'lo_LA',
    type: 'website',
  },
  icons: {
    icon: '/SSMI.svg',
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#3b5998',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="lo" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <Toaster position="top-center" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
