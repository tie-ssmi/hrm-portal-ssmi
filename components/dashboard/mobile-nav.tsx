'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  User,
  Clock,
  FileText,
  History
} from 'lucide-react'
// the themes
import TheThemes from '@/components/themes'

const navItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/dashboard/attendance', label: 'Check-In', icon: Clock },
  { href: '/dashboard/forms', label: 'Forms', icon: FileText },
  { href: '/dashboard/history', label: 'History', icon: History },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border pointer-events-auto touch-none select-none">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] touch-none select-none',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground focus:text-foreground'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium text-center">{item.label}</span>
            </Link>
          )
        })}
        <div className="pointer-events-auto touch-none select-none flex items-center justify-center min-h-[44px] min-w-[44px]">
          <TheThemes />
        </div>
      </div>
    </nav>
  )
}
