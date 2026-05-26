'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun, Monitor } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from './ui/button'

export default function TheThemes({ color }: { color?: string } = {}) {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <Button variant="outline" size="icon" className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground touch-none select-none">
        <Sun className="h-5 w-5" />
      </Button>
    )
  }

  return (
  <Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" size="icon" className={`hover:bg-sidebar-accent ${color ? color : 'bg-secondary'} hover:text-sidebar-accent-foreground active:scale-95 transition-all touch-none select-none focus:ring-2`}>
      {theme === 'light' ? <Sun className="h-5 w-5"  /> : <Moon className="h-5 w-5" />}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-auto flex flex-col space-y-1 p-2 touch-none select-none z-[100]">
    <Button 
      variant="ghost" 
      onClick={() => setTheme('light')} 
      className={`flex items-center justify-start gap-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-95 transition-all touch-none select-none ${theme === 'light' ? 'bg-sidebar-accent/50' : ''}`}
    >
      <Sun className="h-4 w-4" /> Light
    </Button>
    <Button 
      variant="ghost" 
      onClick={() => setTheme('dark')} 
      className={`flex items-center justify-start gap-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-95 transition-all touch-none select-none ${theme === 'dark' ? 'bg-sidebar-accent/50' : ''}`}
    >
      <Moon className="h-4 w-4" /> Dark
    </Button>
    <Button 
      variant="ghost" 
      onClick={() => setTheme('system')} 
      className={`flex items-center justify-start gap-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-95 transition-all touch-none select-none ${theme === 'system' ? 'bg-sidebar-accent/50' : ''}`}
    >
      <Monitor className="h-4 w-4" /> System
    </Button>
  </PopoverContent>
</Popover>
  )
}