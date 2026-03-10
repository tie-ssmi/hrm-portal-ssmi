'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'

//Themes
import TheThemes from '@/components/themes'

import {
  LayoutDashboard,
  User,
  Clock,
  FileText,
  History,
  LogOut,
  Building2
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/profile', label: 'My Profile', icon: User },
  { href: '/dashboard/attendance', label: 'Check-In/Out', icon: Clock },
  { href: '/dashboard/forms', label: 'Request Forms', icon: FileText },
  { href: '/dashboard/history', label: 'History', icon: History },
]

export function DashboardNav() {
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { theme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  const initials = user 
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : 'U'

 

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg  text-sidebar-primary-foreground">
          {mounted && theme === 'light' ? (
            <img src="/SSMI.png" alt="SSMI Logo" className="w-10 h-10" />
          ) : (
            <img src="/SSMI2.png" alt="SSMI Logo" className="w-10 h-10" />
          )}
        </div>
        <span className="font-semibold">HRM Portal</span>
        <div className="ml-auto">
          <TheThemes />
        </div>
      </div>

      {/* User info */}
      <div className="px-6 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-sidebar-foreground/70 truncate">
              {user?.position}
            </p>
          </div>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          onClick={() => logout()}
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
