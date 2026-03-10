'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { Employee } from './types'
import { mockEmployee } from './mock-data'

interface AuthContextType {
  user: Employee | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<boolean>
  loginWithGoogle: () => Promise<boolean>
  logout: () => void
  updateProfile: (updates: Partial<Employee>) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Employee | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    if (email && password) {
      setUser({
        ...mockEmployee,
        email,
        firstName: email.split('@')[0].split('.')[0] || 'User',
        lastName: email.split('@')[0].split('.')[1] || '',
      })
      setIsLoading(false)
      return true
    }
    setIsLoading(false)
    return false
  }, [])

  const loginWithGoogle = useCallback(async (): Promise<boolean> => {
    setIsLoading(true)
    // Simulate Google OAuth
    await new Promise(resolve => setTimeout(resolve, 1500))
    setUser(mockEmployee)
    setIsLoading(false)
    return true
  }, [])

  const logout = useCallback(() => {
    setUser(null)
  }, [])

  const updateProfile = useCallback((updates: Partial<Employee>) => {
    setUser(prev => prev ? { ...prev, ...updates } : null)
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      loginWithGoogle,
      logout,
      updateProfile
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
