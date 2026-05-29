'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  User,
  Clock,
  FileText,
  History,
  LogOut,
  Menu,
  X,
  ClipboardCheck,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useNotifications } from '@/components/NotificationProvider' // 🌟 1. Import ລະບົບແຈ້ງເຕືອນ
import { version } from '@/package.json'
import TheThemes from '@/components/themes'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { PWAInstallButton } from '../pwa-install-button';

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { notifications } = useNotifications() // 🌟 2. ດຶງຂໍ້ມູນຄຳຂໍ pending
  const [sheetOpen, setSheetOpen] = useState(false)
  const [showNav, setShowNav] = useState(true)
  const lastScrollYRef = useRef(0)

  const canApproveDept = user?.rolePermissions?.approveDepartment ?? false
  const canApproveBranch = user?.rolePermissions?.approveBranch ?? false
  const canSee = canApproveBranch || canApproveDept

  const navItems = [
    { href: '/dashboard', label: 'ໜ້າຫຼັກ', icon: LayoutDashboard, show: true },
    { href: '/dashboard/history', label: 'ປະຫວັດ', icon: History, show: true },
    { href: '/dashboard/attendance', label: 'Check-In', icon: Clock, show: true },
    { href: '/dashboard/approv', label: 'ການອະນຸມັດ', icon: ClipboardCheck, show: canSee, badge: notifications.length }, // 🌟 ໃສ່ badge
    { href: '/dashboard/profile', label: 'ຂໍ້ມູນສ່ວນຕົວ', icon: User, show: true },
  ]

  const navMenuItems = [
    { href: '/dashboard', label: 'ໜ້າຫຼັກ', icon: LayoutDashboard, show: true },
    { href: '/dashboard/attendance', label: 'Check-In / Check-Out', icon: Clock, show: true },
    { href: '/dashboard/approv', label: 'ການອະນຸມັດ', icon: ClipboardCheck, show: canSee, badge: notifications.length }, // 🌟 ໃສ່ badge
    { href: '/dashboard/profile', label: 'ຂໍ້ມູນສ່ວນຕົວ', icon: User, show: true },
    { href: '/dashboard/request', label: 'ແບບຟອມ', icon: FileText, show: true },
    { href: '/dashboard/history', label: 'ປະຫວັດ', icon: History, show: true },
  ]

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      if (currentScrollY < lastScrollYRef.current) {
        setShowNav(true)
      } else if (currentScrollY > lastScrollYRef.current && currentScrollY > 50) {
        setShowNav(false)
      }
      lastScrollYRef.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      <nav
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-[60] bg-card border-t border-border pointer-events-auto select-none cursor-auto transition-transform duration-300 ${showNav ? 'translate-y-0' : 'translate-y-full'
          }`}
        style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
      >
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href))
            if (!item.show) return null
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => router.push(item.href)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] select-none cursor-pointer relative', // 🌟 ໃສ່ relative ໃຫ້ປຸ່ມ
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground focus:text-foreground',
                )}
              >
                <div className="relative">
                  <item.icon className="w-5 h-5" />
                  {/* 🌟 ສະແດງຕົວເລກສີແດງເທິງ Icon ຂອງ Bottom Nav */}
                  {!!item.badge && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-red-500 text-white font-bold text-[9px] min-w-[15px] h-3.5 px-0.5 rounded-full flex items-center justify-center border border-card shadow-sm">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium text-center">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <div
        className={`pointer-events-auto fixed lg:hidden top-2 right-2 z-[60] select-none flex items-center justify-center min-h-[44px] min-w-[44px] transition-opacity duration-300 ${showNav ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
      >
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] select-none cursor-pointer text-muted-foreground hover:text-foreground focus:text-foreground relative"
            >
              {!sheetOpen ? <Menu className="w-8 h-8" /> : <X className="w-8 h-8" />}
              {/* 🌟 ຖ້າມີຄຳຂໍຄ້າງ ໃຫ້ຂຶ້ນຕຸ່ມແດງເຕືອນຢູ່ປຸ່ມແຮມເບີເກີເມນູນຳ */}
              {!sheetOpen && notifications.length > 0 && (
                <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border border-background animate-pulse" />
              )}
            </button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>ເມນູ</SheetTitle>
            </SheetHeader>
            <div className="grid flex-1 auto-rows-min gap-2 px-4">
              <TheThemes />

              {navMenuItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href))
                if (!item.show) return null
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => { router.push(item.href); setSheetOpen(false) }}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors', // 🌟 ປ່ຽນເປັນ justify-between
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                        : 'text-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </div>
                    {/* 🌟 ສະແດງຕົວເລກສີແດງຢູ່ທ້າຍແຖວຂອງ Slide Menu */}
                    {!!item.badge && item.badge > 0 && (
                      <span className="bg-red-500 text-white font-bold text-[11px] min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center shadow-sm">
                        {item.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="px-3 py-2 text-sm flex items-center justify-center">
              <p className="text-xs font-medium transition-colors">
                V {version}
              </p>
            </div>
            {/* Install App */}
            <div className="px-3 pb-2">
              <PWAInstallButton className="w-full justify-start gap-3" />
            </div>
            <SheetFooter className="pb-20 lg:pb-4">

              <SheetClose asChild>
                <Button variant="outline">ປິດ</Button>
              </SheetClose>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-center gap-3 text-destructive hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                  >
                    <LogOut className="w-5 h-5" />
                    ອອກຈາກລະບົບ
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">

                  <DialogHeader>
                    <DialogTitle>ອອກຈາກລະບົບ</DialogTitle>
                    <DialogDescription>ท่านແນ່ໃຈບໍ? ທີຈະອອກຈາກລະບົບ</DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">ຍົກເລີກ</Button>
                    </DialogClose>
                    <Button onClick={() => logout()}>ອອກຈາກລະບົບ</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}