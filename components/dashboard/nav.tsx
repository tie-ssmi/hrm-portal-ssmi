'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
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

//Themes
import TheThemes from '@/components/themes'
import { PWAInstallButton } from '@/components/pwa-install-button'

import {
  LayoutDashboard,
  User,
  Clock,
  FileText,
  History,
  LogOut,
  Newspaper,
  ClipboardCheck,
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



export function DashboardNav() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const canApproveDept  = user?.rolePermissions?.approveDepartment ?? false
const canApproveBranch = user?.rolePermissions?.approveBranch ?? false
const canSee=canApproveBranch || canApproveDept
  const initials = user
    ? (`${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'U')
    : 'U'
const profileImage = user?.profileImage || user?.photo3x4Url || user?.avatar || (String(user?.gender).toLowerCase() === 'male' ? '/info/man.jpg' : '/info/woman.jpg')
 const navItems = [
  { href: '/dashboard', label: 'ໜ້າຫຼັກ', icon: LayoutDashboard, show: true },
  { href: '/dashboard/profile', label: 'ຂໍ້ມູນສວນຕົວ', icon: User, show: true },
  { href: '/dashboard/attendance', label: 'Check-In/Out', icon: Clock, show: true },
  { href: '/dashboard/news', label: 'ຂ່າວສານ', icon: Newspaper, show: true },

  { href: '/dashboard/request', label: 'ແບບຟອມ', icon: FileText, show: true },
  { href: '/dashboard/approv', label: 'ການອະນຸມັດ', icon: ClipboardCheck, show: canSee },
  { href: '/dashboard/history', label: 'ປະຫວັດ', icon: History, show: true },
]

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg text-sidebar-primary-foreground overflow-hidden">
          <img src="/SSMI.svg" alt="SSMI Logo" className="w-full h-full object-contain" />
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
          if (!item.show) return null

          const isActive = pathname === item.href || 
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          
          return (
            <Link
              key={item.href}
              href={item.href}
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
            </Link>
          )
        })}
      </nav>

      {/* Install App */}
      <div className="px-3 pb-2">
        <PWAInstallButton className="w-full justify-start gap-3" />
      </div>

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
