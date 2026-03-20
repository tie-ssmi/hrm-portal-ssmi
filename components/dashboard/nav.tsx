'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback,AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
//Themes
import TheThemes from '@/components/themes'

import {
  LayoutDashboard,
  User,
  Clock,
  FileText,
  History,
  LogOut,Newspaper 
} from 'lucide-react'

function formatDepartment(value: unknown): string {
  if (!value) return '-'
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const department = typeof obj.department === 'string' ? obj.department : ''
    const title = typeof obj.title === 'string' ? obj.title : ''
    if (department && title) return `${department} (${title})`
    return department || title || '-'
  }
  return String(value)
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/profile', label: 'My Profile', icon: User },
  { href: '/dashboard/attendance', label: 'Check-In/Out', icon: Clock },
  { href: '/dashboard/news', label: 'News', icon: Newspaper  },

  { href: '/dashboard/request', label: 'Request Forms', icon: FileText },
  { href: '/dashboard/history', label: 'History', icon: History },
]

export function DashboardNav() {
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { theme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  const initials = user 
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : 'U'
const profileImage = user?.profileImage || user?.photo3x4Url || user?.avatar || (String(user?.gender).toLowerCase() === 'male' ? '/info/ma.jpg' : '/info/woman.jpg')

 

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
          <Avatar  className="w-10 h-10">
                      <AvatarImage src={profileImage} alt="@shadcn" />

            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-sidebar-foreground/70 truncate">
              {formatDepartment(user?.department)}
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
            <button
              type="button"
              key={item.href}
              onClick={() => router.push(item.href)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex w-full items-center justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-sidebar-border">
       
        <Dialog>
      
        <DialogTrigger asChild>
           <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          
        >
          <LogOut className="w-5 h-5" />
          ອອກຈາກລະບົບ
        </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ອອກຈາກລະບົບ</DialogTitle>
            <DialogDescription>
              ທ່ານແນ່ໃຈບໍ່? ທີຈະອອກຈາກລະບົບ
            </DialogDescription>
          </DialogHeader>
        
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" >ຍົກເລີກ</Button>
            </DialogClose>
            <Button onClick={() => logout()}>ອອກຈາກລະບົບ</Button>
          </DialogFooter>
        </DialogContent>
      
    </Dialog>
      </div>
    </div>
  )
}
