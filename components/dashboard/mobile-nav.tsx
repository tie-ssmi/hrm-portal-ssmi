'use client'

import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  User,
  Clock,
  FileText,
  History,
  Settings,
  LogOut
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

// the themes
import TheThemes from '@/components/themes'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
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
  { href: '/dashboard/attendance', label: 'Check-In', icon: Clock },
  { href: '/dashboard/forms', label: 'Forms', icon: FileText },
  { href: '/dashboard/history', label: 'History', icon: History },
  { href: '/dashboard/profile', label: 'Profile', icon: User },

]

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border pointer-events-auto select-none cursor-auto" style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}>
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
        <div className="pointer-events-auto select-none flex items-center justify-center min-h-[44px] min-w-[44px]">
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] select-none cursor-pointer text-muted-foreground hover:text-foreground focus:text-foreground"
              >
                <Settings className="w-5 h-5" />
                <span className="text-[10px] font-medium text-center">Settings</span>
              </button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Settings</SheetTitle>

              </SheetHeader>
              <div className="grid flex-1 auto-rows-min gap-6 px-4">
                <TheThemes />
                    <Dialog>
      
        <DialogTrigger asChild>
           <Button
          variant="outline"
          className="w-full justify-start gap-3  text-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          
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
              <SheetFooter>

                <SheetClose asChild>
                  <Button variant="outline">ປິດ</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  )
}
