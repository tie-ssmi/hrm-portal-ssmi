'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  User,
  Clock,
  FileText,
  History,
  Settings,
  LogOut,
  Newspaper,
  Menu
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

// the themes
import TheThemes from '@/components/themes'
import { Button } from "@/components/ui/button"

import {
  Sheet,
  SheetClose,
  SheetContent,

  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
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
const navItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  // { href: '/dashboard/request', label: 'Forms', icon: FileText },
  { href: '/dashboard/history', label: 'History', icon: History },
  { href: '/dashboard/attendance', label: 'Check-In', icon: Clock },
  { href: '/dashboard/news', label: 'News', icon: Newspaper },
  { href: '/dashboard/profile', label: 'Profile', icon: User }

]
const navMenuItems = [

  { href: '/dashboard/request', label: 'Request Forms', icon: FileText },
  { href: '/dashboard/history', label: 'History', icon: History },
  { href: '/dashboard/profile', label: 'My Profile', icon: User },


]

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [showNav, setShowNav] = useState(true)  // Show initially
  const [lastScrollY, setLastScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      // Show nav when scrolling up
      if (currentScrollY < lastScrollY) {
        setShowNav(true)
      }
      // Hide nav when scrolling down
      else if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setShowNav(false)
      }

      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  return (
    <>
      <nav 
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border pointer-events-auto select-none cursor-auto transition-transform duration-300 ${
          showNav ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
      >
        <div className="flex items-center justify-around h-16 px-2">
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
                  'flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] select-none cursor-pointer',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground focus:text-foreground'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium text-center">{item.label}</span>
              </button>
            )
          })}

        </div>
      </nav>
      <div className={`pointer-events-auto fixed top-2 right-2 z-50 select-none flex items-center justify-center min-h-[44px] min-w-[44px] transition-opacity duration-300 ${
        showNav ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] select-none cursor-pointer text-muted-foreground hover:text-foreground focus:text-foreground"
            >
              <Menu className="w-8 h-8" />
              {/* <span className="text-[10px] font-medium text-center">Settings</span> */}
            </button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Sub menu</SheetTitle>

            </SheetHeader>
            <div className="grid flex-1 auto-rows-min gap-6 px-4">
              <TheThemes />

              {navMenuItems.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href))

                return (
                  <button
                    type="button"
                    key={item.href}
                    onClick={() => {
                      router.push(item.href)
                      setSheetOpen(false)
                    }}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex w-full items-center justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                        : 'text-foreground  hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </button>
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
                    className="w-full justify-center gap-3  text-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"

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

            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
