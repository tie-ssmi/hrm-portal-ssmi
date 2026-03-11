'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
const navItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/dashboard/attendance', label: 'Check-In', icon: Clock },
  { href: '/dashboard/forms', label: 'Forms', icon: FileText },
  { href: '/dashboard/history', label: 'History', icon: History },
  { href: '/dashboard/profile', label: 'Profile', icon: User },

]

export function MobileNav() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
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
                'flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] touch-none select-none',
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
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] touch-none select-none text-muted-foreground hover:text-foreground focus:text-foreground"
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
                <Button onClick={() => logout()}> <LogOut className="w-5 h-5" />ອອກຈາກລະບົບ</Button>
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
