'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

type NavProgressContextType = {
  isNavigating: boolean
  startNavigation: () => void
}

const NavProgressContext = createContext<NavProgressContextType>({
  isNavigating: false,
  startNavigation: () => {},
})

export function NavigationProgressProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isNavigating, setIsNavigating] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset when actual route change completes
  useEffect(() => {
    setIsNavigating(false)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [pathname])

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [])

  const startNavigation = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsNavigating(true)
    // Safety: stop shimmer after 3s if pathname never changes (same-route push)
    timeoutRef.current = setTimeout(() => setIsNavigating(false), 3000)
  }, [])

  return (
    <NavProgressContext.Provider value={{ isNavigating, startNavigation }}>
      {children}
    </NavProgressContext.Provider>
  )
}

export const useNavProgress = () => useContext(NavProgressContext)
