'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  User,
  Clock,
  FileText,
  History,
  LogOut,
  Menu,
  ClipboardCheck,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

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

export function MobileNav() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
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
    { href: '/dashboard/approv', label: 'ການອະນຸມັດ', icon: ClipboardCheck, show: canSee },
    { href: '/dashboard/profile', label: 'ຂໍ້ມູນສ່ວນຕົວ', icon: User, show: true },
  ]

  const navMenuItems = [
    { href: '/dashboard', label: 'ໜ້າຫຼັກ', icon: LayoutDashboard, show: true },
    { href: '/dashboard/attendance', label: 'Check-In / Check-Out', icon: Clock, show: true },
    { href: '/dashboard/approv', label: 'ການອະນຸມັດ', icon: ClipboardCheck, show: canSee },
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
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border pointer-events-auto select-none cursor-auto transition-transform duration-300 ${showNav ? 'translate-y-0' : 'translate-y-full'
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
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] select-none cursor-pointer',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground focus:text-foreground',
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium text-center">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      <div
        className={`pointer-events-auto fixed lg:hidden top-2 right-2 z-50 select-none flex items-center justify-center min-h-[44px] min-w-[44px] transition-opacity duration-300 ${showNav ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
      >
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] select-none cursor-pointer text-muted-foreground hover:text-foreground focus:text-foreground"
            >
              <Menu className="w-8 h-8" />
            </button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Sub menu</SheetTitle>
            </SheetHeader>
            <div className="grid flex-1 auto-rows-min gap-6 px-4">
              <TheThemes />

              {navMenuItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href))
                if (!item.show) return null
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSheetOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex w-full items-center justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                        : 'text-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                )
              })}
            </div>

            <SheetFooter>
              <SheetClose asChild>
                <Button variant="outline">ປິດ</Button>
              </SheetClose>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-center gap-3 text-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                  >
                    <LogOut className="w-5 h-5" />
                    ອອກຈາກລະບົບ
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>ອອກຈາກລະບົບ</DialogTitle>
                    <DialogDescription>ທ່ານແນ່ໃຈບໍ່? ທີຈະອອກຈາກລະບົບ</DialogDescription>
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
