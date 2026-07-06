'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import {
  EmailAuthProvider,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  linkWithCredential,
  onAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth'
import { auth } from './firebase-auth'
import { db } from './firebase'
import { doc, getDoc } from 'firebase/firestore'
import type { AuthCredential } from 'firebase/auth'
import type { AuthContextType, Employee } from './types'
import { queryClient } from './query-client'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

let employeesModule: typeof import('./employees') | null = null
async function getEmployeesModule() {
  if (!employeesModule) employeesModule = await import('./employees')
  return employeesModule
}

async function resolveEmployeeForFirebaseUser(firebaseUser: FirebaseUser): Promise<Partial<Employee> | null> {
  const { fetchEmployeeByEmail, fetchEmployeeByUid, fetchRoleByUid, updateEmployeeUidByEmail } = await getEmployeesModule()
  let employeeData = await fetchEmployeeByUid(firebaseUser.uid)

  if (!employeeData && firebaseUser.email) {
    employeeData = await fetchEmployeeByEmail(firebaseUser.email)

    if (employeeData) {
      if (employeeData.uid !== firebaseUser.uid) {
        updateEmployeeUidByEmail(firebaseUser.email, firebaseUser.uid).catch(
          (error) => console.error('Error syncing employee uid:', error)
        )
      }

      employeeData = {
        ...employeeData,
        uid: firebaseUser.uid,
        email: employeeData.email || firebaseUser.email,
      }
    }
  }

  if (employeeData?.rolesUid) {
    const rolePermissions = await fetchRoleByUid(employeeData.rolesUid)
    if (rolePermissions) {
      employeeData = { ...employeeData, rolePermissions }
    }
  }

  return employeeData
}

// Convert Firebase user to Employee format
async function firebaseUserToEmployee(firebaseUser: FirebaseUser): Promise<Employee> {
  const displayName = firebaseUser.displayName || ''
  const nameParts = displayName.split(' ')
  
  // Fetch extended employee data from Firestore
  const employeeData = await resolveEmployeeForFirebaseUser(firebaseUser)
  
  const baseEmployee: Employee = {
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
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
      uid: employeeData.uid || firebaseUser.uid,
      uuid: employeeData.uuid || employeeData.uid || firebaseUser.uid,
      // Override with Firestore data where available
      firstName: employeeData.firstNameEn || baseEmployee.firstName,
      lastName: employeeData.lastNameEn || baseEmployee.lastName,
      phone: employeeData.tel || baseEmployee.phone,
      position: employeeData.jobTitle || baseEmployee.position,
      department: employeeData.department || baseEmployee.department,
      workLocation: employeeData.workLocation,
    }
  }
  
  return {
    ...baseEmployee,
    uuid: firebaseUser.uid,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Employee | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const pendingGoogleCredentialRef = useRef<AuthCredential | null>(null)
  const pendingGoogleEmailRef = useRef<string | null>(null)

  const clearPendingGoogleLink = useCallback(() => {
    pendingGoogleCredentialRef.current = null
    pendingGoogleEmailRef.current = null
  }, [])

  // Listen for auth state changes
  useEffect(() => {
    const INACTIVE_MAX_MS = 2 * 24 * 60 * 60 * 1000 // 2 days inactivity
    const ACTIVE_KEY = 'ssmi_last_active'

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          const stored = localStorage.getItem(ACTIVE_KEY)
          if (stored && Date.now() - new Date(stored).getTime() > INACTIVE_MAX_MS) {
            localStorage.removeItem(ACTIVE_KEY)
            await signOut(auth)
            setFirebaseUser(null)
            setUser(null)
            setIsLoading(false)
            return
          }

          // Force logout all — admin can set adminSettings/forceLogout.triggeredAt
          if (stored) {
            try {
              const forceSnap = await getDoc(doc(db, 'adminSettings', 'forceLogout'))
              const triggeredAt = forceSnap.data()?.triggeredAt as string | undefined
              if (triggeredAt && new Date(stored).getTime() < new Date(triggeredAt).getTime()) {
                localStorage.removeItem(ACTIVE_KEY)
                await signOut(auth)
                setFirebaseUser(null)
                setUser(null)
                setIsLoading(false)
                return
              }
            } catch {
              // ຖ້າ Firestore ບໍ່ໄດ້ — ຜ່ານຕໍ່ (ບໍ່ block login)
            }
          }

          // Update last active time on every app open
          localStorage.setItem(ACTIVE_KEY, new Date().toISOString())
          setFirebaseUser(fbUser)
          const employeeData = await firebaseUserToEmployee(fbUser)
          setUser(employeeData)
        } else {
          setFirebaseUser(null)
          setUser(null)
        }
      } catch (error) {
        console.error('Auth state change error:', error)
        setFirebaseUser(null)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  const completeGoogleLink = useCallback(async (email: string, password: string, credential: AuthCredential) => {
    await signInWithEmailAndPassword(auth, email, password)

    if (!auth.currentUser) {
      return { success: false, error: 'Unable to verify account. Please try again.' }
    }

    await linkWithCredential(auth.currentUser, credential)

    const employeeData = await resolveEmployeeForFirebaseUser(auth.currentUser)
    if (!employeeData) {
      await signOut(auth)
      return {
        success: false,
        error: 'This Google account is not allowed. Please contact HR.',
      }
    }

    return { success: true }
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

  const loginWithGoogle = useCallback(async (linkPassword?: string): Promise<{
    success: boolean
    error?: string
    requiresPasswordLink?: boolean
    requiresPasswordSetup?: boolean
    email?: string
  }> => {
    setIsLoading(true)
    try {
      if (linkPassword && pendingGoogleCredentialRef.current && pendingGoogleEmailRef.current) {
        try {
          const linkResult = await completeGoogleLink(
            pendingGoogleEmailRef.current,
            linkPassword,
            pendingGoogleCredentialRef.current
          )

          if (linkResult.success) {
            clearPendingGoogleLink()
          } else {
            setIsLoading(false)
          }

          return linkResult
        } catch (linkError: any) {
          console.error('Google link error:', linkError)
          setIsLoading(false)
          if (linkError?.code === 'auth/wrong-password' || linkError?.code === 'auth/invalid-credential') {
            return { success: false, error: 'Incorrect password. Please try again.' }
          }
          return { success: false, error: 'Unable to link Google account. Please try again.' }
        }
      }

      const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth')
      const googleProvider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, googleProvider)
      const employeeData = await resolveEmployeeForFirebaseUser(result.user)

      if (!employeeData) {
        clearPendingGoogleLink()
        await signOut(auth)
        setIsLoading(false)
        return {
          success: false,
          error: 'This Google account is not allowed. Please contact HR.',
        }
      }

      const hasPasswordProvider = result.user.providerData.some(
        (provider) => provider.providerId === 'password'
      )

      if (!hasPasswordProvider && result.user.email) {
        clearPendingGoogleLink()
        setIsLoading(false)
        return {
          success: false,
          requiresPasswordSetup: true,
          email: result.user.email,
          error: 'Set a password to enable email and password login for this account.',
        }
      }

      clearPendingGoogleLink()
      return { success: true }
    } catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user') {
        setIsLoading(false)
        return { success: false }
      }

      if (error?.code === 'auth/account-exists-with-different-credential') {
        const { GoogleAuthProvider } = await import('firebase/auth')
        const email = error?.customData?.email as string | undefined
        const pendingCredential = GoogleAuthProvider.credentialFromError(error)

        if (!email || !pendingCredential) {
          clearPendingGoogleLink()
          setIsLoading(false)
          return { success: false, error: 'Unable to link this Google account. Please contact HR.' }
        }

        pendingGoogleCredentialRef.current = pendingCredential
        pendingGoogleEmailRef.current = email

        if (!linkPassword) {
          setIsLoading(false)
          return {
            success: false,
            requiresPasswordLink: true,
            email,
            error: 'Please enter your account password to link Google sign-in.',
          }
        }

        try {
          const linkResult = await completeGoogleLink(email, linkPassword, pendingCredential)

          if (!linkResult.success) {
            setIsLoading(false)
            return linkResult
          }

          clearPendingGoogleLink()
          return linkResult
        } catch (linkError: any) {
          console.error('Google link error:', linkError)
          setIsLoading(false)
          if (linkError?.code === 'auth/wrong-password' || linkError?.code === 'auth/invalid-credential') {
            return { success: false, error: 'Incorrect password. Please try again.' }
          }
          return { success: false, error: 'Unable to link Google account. Please try again.' }
        }
      }

      console.error('Google login error:', error)
      clearPendingGoogleLink()
      setIsLoading(false)
      return { success: false, error: 'Google sign-in failed. Please try again.' }
    }
  }, [clearPendingGoogleLink, completeGoogleLink])

  const setupPasswordForCurrentUser = useCallback(async (password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true)

    try {
      if (!auth.currentUser?.email) {
        setIsLoading(false)
        return { success: false, error: 'No authenticated Google account is available for password setup.' }
      }

      const credential = EmailAuthProvider.credential(auth.currentUser.email, password)
      await linkWithCredential(auth.currentUser, credential)
      setIsLoading(false)

      return { success: true }
    } catch (error: any) {
      console.error('Password setup error:', error)
      setIsLoading(false)

      if (error?.code === 'auth/provider-already-linked') {
        return { success: true }
      }

      if (error?.code === 'auth/weak-password') {
        return { success: false, error: 'Password must be at least 6 characters.' }
      }

      return { success: false, error: 'Unable to set password for this account. Please try again.' }
    }
  }, [])

  const resetPassword = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await sendPasswordResetEmail(auth, email)
      return { success: true }
    } catch (error: any) {
      if (error?.code === 'auth/user-not-found' || error?.code === 'auth/invalid-email') {
        return { success: false, error: 'ບໍ່ພົບອີເມວນີ້ໃນລະບົບ' }
      }
      return { success: false, error: 'ບໍ່ສາມາດສົ່ງອີເມວໄດ້ ກະລຸນາລອງໃໝ່' }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      clearPendingGoogleLink()
      localStorage.removeItem('ssmi_last_active')
      await signOut(auth)
      queryClient.clear()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }, [clearPendingGoogleLink])

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
      setupPasswordForCurrentUser,
      resetPassword,
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
