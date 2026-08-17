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
import type { AuthCredential, UserCredential } from 'firebase/auth'
import type { AuthContextType, Employee, GoogleLoginOutcome } from './types'
import { queryClient } from './query-client'
import { logAudit, extractWorkLocationLog } from '@/services/audit-log'
import { snapshotDeviceId, restoreDeviceId } from './device'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as "MacIntel" but is touch-capable — real Macs aren't.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
}

// signInWithPopup depends on window.open() keeping a live `opener` link back to
// this page so the popup can hand the auth result back. iOS Safari's standalone
// (home-screen) mode can't guarantee that — the popup either fails to open or
// bounces the user into a disconnected Safari tab, and the sign-in hangs.
// signInWithRedirect avoids popups entirely; getRedirectResult() (mount effect
// in AuthProvider) picks the result back up once the page reloads.
function shouldUseGoogleRedirect(): boolean {
  return isIOSDevice() && isStandaloneDisplayMode()
}

function clearAllClientStorage() {
  if (typeof document !== 'undefined') {
    document.cookie.split(';').forEach((entry) => {
      const name = entry.split('=')[0]?.trim()
      if (name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
      }
    })
  }
  if (typeof window !== 'undefined') {
    // device_id identifies the physical device, not this account — must survive
    // logout or buddy-punch detection (functions/src/index.ts) silently breaks for
    // the next person who logs in on this device.
    const deviceId = snapshotDeviceId()
    localStorage.clear()
    sessionStorage.clear()
    restoreDeviceId(deviceId)
  }
}

let employeesModule: typeof import('./employees') | null = null
async function getEmployeesModule() {
  if (!employeesModule) employeesModule = await import('./employees')
  return employeesModule
}

async function resolveEmployeeForFirebaseUser(firebaseUser: FirebaseUser): Promise<Partial<Employee> | null> {
  const { fetchEmployeeByEmail, fetchEmployeeByUid, fetchRoleByUid, fetchUserRoleId, updateEmployeeUidByEmail } = await getEmployeesModule()
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

  // Resolved from userRoles (synced by the syncEmployeeMirrors Cloud
  // Function), not employeeData.rolesUid directly — see firestore.rules,
  // which stopped trusting that field for the same reason.
  const resolvedUid = employeeData?.uid || firebaseUser.uid
  const roleId = await fetchUserRoleId(resolvedUid)
  if (roleId) {
    const rolePermissions = await fetchRoleByUid(roleId)
    if (rolePermissions && employeeData) {
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
  const [googleRedirectOutcome, setGoogleRedirectOutcome] = useState<GoogleLoginOutcome | null>(null)

  const clearPendingGoogleLink = useCallback(() => {
    pendingGoogleCredentialRef.current = null
    pendingGoogleEmailRef.current = null
  }, [])

  const clearGoogleRedirectOutcome = useCallback(() => setGoogleRedirectOutcome(null), [])

  // Full sign-out: used for manual logout, inactivity timeout, and admin
  // force-logout alike, so every exit path clears the same session data.
  const performFullSignOut = useCallback(async () => {
    clearPendingGoogleLink()
    await signOut(auth)
    queryClient.clear()
    clearAllClientStorage()
  }, [clearPendingGoogleLink])

  // Listen for auth state changes
  useEffect(() => {
    const INACTIVE_MAX_MS = 2 * 24 * 60 * 60 * 1000 // 2 days inactivity
    const ACTIVE_KEY = 'ssmi_last_active'

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      // TEMP DEBUG — remove once the login/force-logout issue is confirmed fixed
      const debugMark = (reason: string, extra?: Record<string, unknown>) => {
        if (typeof window !== 'undefined') {
          ;(window as any).__authDebug = { reason, at: new Date().toISOString(), ...extra }
        }
      }
      try {
        if (fbUser) {
          const stored = localStorage.getItem(ACTIVE_KEY)
          if (stored && Date.now() - new Date(stored).getTime() > INACTIVE_MAX_MS) {
            debugMark('inactive-timeout', { stored })
            // Worth the extra read here — this path fires rarely (once per
            // 2-day-inactive session), unlike login/every-app-open.
            const expiredEmployeeData = await resolveEmployeeForFirebaseUser(fbUser).catch(() => null)
            await logAudit({
              action: 'auth.session.expire',
              actorUid: fbUser.uid,
              actorName: fbUser.displayName || fbUser.email || fbUser.uid,
              actorRoleUuid: expiredEmployeeData?.rolesUid ?? '',
              actorRoleName: expiredEmployeeData?.rolesName,
              workLocation: extractWorkLocationLog(expiredEmployeeData?.workLocation),
              targetType: 'employees',
              targetId: fbUser.uid,
              reason: '2-day inactivity timeout',
              status: 'SUCCESS',
            })
            await performFullSignOut()
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
                debugMark('force-logout', { stored, triggeredAt })
                // The admin who triggered this writes adminSettings/forceLogout from
                // outside this app (Admin SDK), so we can't attribute the actor —
                // this logs the affected session being torn down, not who triggered it.
                // Extra read is fine here too — only fires when an admin actually
                // triggers a global force-logout, not on every app open.
                const forcedEmployeeData = await resolveEmployeeForFirebaseUser(fbUser).catch(() => null)
                await logAudit({
                  action: 'auth.forceLogout.trigger',
                  actorUid: fbUser.uid,
                  actorName: fbUser.displayName || fbUser.email || fbUser.uid,
                  actorRoleUuid: forcedEmployeeData?.rolesUid ?? '',
                  actorRoleName: forcedEmployeeData?.rolesName,
                  workLocation: extractWorkLocationLog(forcedEmployeeData?.workLocation),
                  targetType: 'employees',
                  targetId: fbUser.uid,
                  reason: 'adminSettings/forceLogout.triggeredAt newer than last active session',
                  status: 'SUCCESS',
                })
                await performFullSignOut()
                setFirebaseUser(null)
                setUser(null)
                setIsLoading(false)
                return
              }
            } catch (forceLogoutError) {
              debugMark('force-logout-check-failed', { error: String(forceLogoutError) })
              // ຖ້າ Firestore ບໍ່ໄດ້ — ຜ່ານຕໍ່ (ບໍ່ block login)
            }
          }

          // Update last active time on every app open
          localStorage.setItem(ACTIVE_KEY, new Date().toISOString())
          setFirebaseUser(fbUser)
          const employeeData = await firebaseUserToEmployee(fbUser)
          debugMark('signed-in', { uid: fbUser.uid, hasEmployeeData: !!employeeData })
          setUser(employeeData)
        } else {
          debugMark('no-firebase-user')
          setFirebaseUser(null)
          setUser(null)
        }
      } catch (error) {
        debugMark('error', { error: String(error) })
        console.error('Auth state change error:', error)
        setFirebaseUser(null)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    })

    return () => unsubscribe()
  }, [performFullSignOut])

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

    await logAudit({
      action: 'auth.login',
      actorUid: auth.currentUser.uid,
      actorName: auth.currentUser.displayName || email,
      actorRoleUuid: employeeData.rolesUid ?? '',
      actorRoleName: employeeData.rolesName,
      workLocation: extractWorkLocationLog(employeeData.workLocation),
      targetType: 'employees',
      targetId: auth.currentUser.uid,
      reason: 'Google account linked to existing email/password account',
      status: 'SUCCESS',
    })

    return { success: true }
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true)
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      // Role isn't resolved yet at this point (that happens in the onAuthStateChanged
      // listener) — logged with an empty actorRoleUuid rather than duplicating that fetch.
      await logAudit({
        action: 'auth.login',
        actorUid: result.user.uid,
        actorName: result.user.displayName || result.user.email || email,
        actorRoleUuid: '',
        targetType: 'employees',
        targetId: result.user.uid,
        status: 'SUCCESS',
      })
      return true
    } catch (error) {
      console.error('Login error:', error)
      setIsLoading(false)
      return false
    }
  }, [])

  // Shared by the popup path (loginWithGoogle) and the redirect path (mount
  // effect below) — both end up with a UserCredential that needs the same
  // "is this actually a registered employee" gate.
  const processGoogleCredentialResult = useCallback(async (
    result: UserCredential
  ): Promise<GoogleLoginOutcome> => {
    const employeeData = await resolveEmployeeForFirebaseUser(result.user)

    if (!employeeData) {
      // Still authenticated at this point (Firebase created the session before
      // we discovered they're not a registered employee) — log while we still can.
      await logAudit({
        action: 'auth.login',
        actorUid: result.user.uid,
        actorName: result.user.displayName || result.user.email || '',
        actorRoleUuid: '',
        targetType: 'employees',
        targetId: result.user.uid,
        reason: 'Google account not registered as an employee',
        status: 'FAILED',
        errorMessage: 'This Google account is not allowed',
      })
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

    await logAudit({
      action: 'auth.login',
      actorUid: result.user.uid,
      actorName: result.user.displayName || result.user.email || '',
      actorRoleUuid: employeeData.rolesUid ?? '',
      actorRoleName: employeeData.rolesName,
      workLocation: extractWorkLocationLog(employeeData.workLocation),
      targetType: 'employees',
      targetId: result.user.uid,
      status: 'SUCCESS',
    })
    clearPendingGoogleLink()
    return { success: true }
  }, [clearPendingGoogleLink])

  // Shared error handling for both the popup path and the redirect path —
  // getRedirectResult() throws the same error shapes signInWithPopup does.
  const handleGoogleSignInError = useCallback(async (
    error: any,
    linkPassword?: string
  ): Promise<GoogleLoginOutcome> => {
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
  }, [clearPendingGoogleLink, completeGoogleLink])

  const loginWithGoogle = useCallback(async (linkPassword?: string): Promise<GoogleLoginOutcome> => {
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

      const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import('firebase/auth')
      const googleProvider = new GoogleAuthProvider()

      if (shouldUseGoogleRedirect()) {
        // Navigates away — getRedirectResult() in the mount effect below picks
        // the outcome back up once the page reloads. Nothing meaningful to
        // return here in the common case.
        await signInWithRedirect(auth, googleProvider)
        return { success: false }
      }

      const result = await signInWithPopup(auth, googleProvider)
      return await processGoogleCredentialResult(result)
    } catch (error: any) {
      return await handleGoogleSignInError(error, linkPassword)
    }
  }, [clearPendingGoogleLink, completeGoogleLink, processGoogleCredentialResult, handleGoogleSignInError])

  // Completes the sign-in started by signInWithRedirect (shouldUseGoogleRedirect)
  // once the page reloads after the OAuth round-trip. Resolves to null on a
  // normal page load — cheap local check, no network round-trip.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { getRedirectResult } = await import('firebase/auth')
        const result = await getRedirectResult(auth)
        if (!result || !active) return
        const outcome = await processGoogleCredentialResult(result)
        if (active) setGoogleRedirectOutcome(outcome)
      } catch (error) {
        if (!active) return
        const outcome = await handleGoogleSignInError(error)
        setGoogleRedirectOutcome(outcome)
      }
    })()
    return () => { active = false }
  }, [processGoogleCredentialResult, handleGoogleSignInError])

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
      // Must log before performFullSignOut — the security rule requires the
      // writer to still be authenticated (actorUid == request.auth.uid).
      if (auth.currentUser) {
        await logAudit({
          action: 'auth.logout',
          actorUid: auth.currentUser.uid,
          actorName: [user?.firstNameLo || user?.firstName, user?.lastNameLo || user?.lastName]
            .filter(Boolean).join(' ') || auth.currentUser.displayName || auth.currentUser.email || '',
          actorRoleUuid: user?.rolesUid ?? '',
          actorRoleName: user?.rolesName,
          workLocation: extractWorkLocationLog(user?.workLocation),
          targetType: 'employees',
          targetId: auth.currentUser.uid,
          status: 'SUCCESS',
        })
      }
      await performFullSignOut()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }, [user, performFullSignOut])

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
      googleRedirectOutcome,
      clearGoogleRedirectOutcome,
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
