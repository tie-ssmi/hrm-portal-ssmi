'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth'
import { auth } from './firebase'
import { fetchEmployeeByUid } from './employees'
import type { AuthContextType, Employee } from './types'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const googleProvider = new GoogleAuthProvider()

// Convert Firebase user to Employee format
async function firebaseUserToEmployee(firebaseUser: FirebaseUser): Promise<Employee> {
  const displayName = firebaseUser.displayName || ''
  const nameParts = displayName.split(' ')
  
  // Fetch extended employee data from Firestore
  const employeeData = await fetchEmployeeByUid(firebaseUser.uid)
  
  const baseEmployee: Employee = {
    id: firebaseUser.uid,
    email: firebaseUser.email || '',
    firstName: nameParts[0] || firebaseUser.email?.split('@')[0] || 'User',
    lastName: nameParts.slice(1).join(' ') || '',
    avatar: firebaseUser.photoURL || undefined,
    department: 'General',
    position: 'Employee',
    employeeId: `EMP-${firebaseUser.uid.slice(0, 6).toUpperCase()}`,
    phone: firebaseUser.phoneNumber || '',
    joinDate: new Date().toISOString().split('T')[0],
  }
  
  // Merge with Firestore data if available
  if (employeeData) {
    return {
      ...baseEmployee,
      ...employeeData,
      // Override with Firestore data where available
      firstName: employeeData.firstNameEn || baseEmployee.firstName,
      lastName: employeeData.lastNameEn || baseEmployee.lastName,
      phone: employeeData.tel || baseEmployee.phone,
      position: employeeData.jobTitle || baseEmployee.position,
      department: employeeData.workLocation || baseEmployee.department,
    }
  }
  
  return baseEmployee
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Employee | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser)
        const employeeData = await firebaseUserToEmployee(fbUser)
        setUser(employeeData)
      } else {
        setFirebaseUser(null)
        setUser(null)
      }
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      return true
    } catch (error) {
      console.error('Login error:', error)
      setIsLoading(false)
      return false
    }
  }, [])

  const loginWithGoogle = useCallback(async (): Promise<boolean> => {
    setIsLoading(true)
    try {
      await signInWithPopup(auth, googleProvider)
      return true
    } catch (error) {
      console.error('Google login error:', error)
      setIsLoading(false)
      return false
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Logout error:', error)
    }
  }, [])

  const updateProfile = useCallback((updates: Partial<Employee>) => {
    setUser(prev => prev ? { ...prev, ...updates } : null)
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      firebaseUser,
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
