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
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import type { AuthCredential, UserCredential } from 'firebase/auth'
import type { AuthContextType, Employee, GoogleLoginOutcome } from './types'
import { queryClient } from './query-client'
import { logAudit, extractWorkLocationLog } from '@/services/audit-log'
import { snapshotDeviceId, restoreDeviceId } from './device'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ເວລາບັງຄັບອອກລ່າສຸດທີ່ກ່ຽວກັບ uid ນີ້ — ທຸກຄົນ (adminSettings/forceLogoutPortal, ແລະ
// adminSettings/forceLogout ຊື່ເກົ່າ) ຫຼື ສະເພາະຄົນ (forceLogoutUsers/{uid}.portalAt, ຂຽນໂດຍ
// Cloud Function forceLogoutUser ໃນ HRM-System-SSMI). ອ່ານບໍ່ໄດ້ອັນໃດ ຖືວ່າບໍ່ມີ
async function latestForceLogoutAt(uid: string): Promise<string | undefined> {
  const read = (path: [string, string], field: string) =>
    getDoc(doc(db, ...path))
      .then((snap) => snap.data()?.[field] as string | undefined)
      .catch(() => undefined)
  const times = await Promise.all([
    read(['adminSettings', 'forceLogoutPortal'], 'triggeredAt'),
    read(['adminSettings', 'forceLogout'], 'triggeredAt'),
    read(['forceLogoutUsers', uid], 'portalAt'),
  ])
  return times
    .filter((t): t is string => typeof t === 'string' && !Number.isNaN(new Date(t).getTime()))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
}

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

export const ACCOUNT_MISMATCH_MESSAGE = 'ບັນຊີບໍ່ກົງກັບຂໍ້ມູນພະນັກງານ ກະລຸນາຕິດຕໍ່ HR'

// ຊອກພະນັກງານດ້ວຍ employees/{auth uid} ຢ່າງດຽວ — ບໍ່ fallback ໄປ email ອີກ. ກ່ອນໜ້ານີ້ບັນຊີ Auth
// ທີ່ uid ຜິດ (email ດຽວກັນ) ຖືກ map ເຂົ້າ doc ພະນັກງານຜ່ານ email ແລ້ວ user ໄດ້ uid = auth uid ແຕ່
// uuid = doc id ປົນກັນ → attendance.uid ຜິດ → ລາຍງານເດືອນຂອງ HRM ຂ້າມ attendance ທັງໝົດ.
// ບັນຊີແບບນັ້ນຕ້ອງໃຫ້ HR relink (HRM-System-SSMI/functions/scripts/relink-auth-uid.js).
//
// null = ບໍ່ພົບ employees/{auth uid} (ຕ້ອງ signOut). throw = ອ່ານ Firestore ບໍ່ໄດ້ (ບໍ່ແມ່ນບັນຊີຜິດ)
async function resolveEmployeeForFirebaseUser(firebaseUser: FirebaseUser): Promise<Partial<Employee> | null> {
  const { fetchEmployeeByUid, fetchRoleByUid, fetchUserRoleId } = await getEmployeesModule()
  let employeeData = await fetchEmployeeByUid(firebaseUser.uid)
  if (!employeeData) return null

  // Prefer the userRoles mirror (written by the syncEmployeeMirrors Cloud
  // Function), but fall back to employees.rolesUid when it is missing.
  //
  // The mirror is only written when rolesUid actually *changes*
  // (functions/src/index.ts) — it is never created retroactively, so every
  // employee whose role has not been touched since that trigger shipped has
  // no mirror at all. Without a fallback those accounts resolve no
  // permissions whatsoever: no approval nav, no admin panel, nothing.
  //
  // Falling back is not a privilege escalation: firestore.rules resolves
  // rolesUid off employees/{uid} in exactly the same way (see isAdmin() and
  // friends), and self-update is blocked from touching rolesUid, so a user
  // cannot point this at a role they were not granted. Client-side
  // rolePermissions only decides which UI is rendered — the rules remain the
  // enforcement boundary either way.
  const roleId = (await fetchUserRoleId(firebaseUser.uid)) || employeeData.rolesUid || null
  if (roleId) {
    const rolePermissions = await fetchRoleByUid(roleId)
    if (rolePermissions) {
      employeeData = { ...employeeData, rolePermissions }
    }
  }

  return employeeData
}

// Convert Firebase user to Employee format — null = ບໍ່ພົບ employees/{auth uid} (ຜູ້ເອີ້ນຕ້ອງ signOut)
async function firebaseUserToEmployee(firebaseUser: FirebaseUser): Promise<Employee | null> {
  const displayName = firebaseUser.displayName || ''
  const nameParts = displayName.split(' ')

  // Fetch extended employee data from Firestore. ອ່ານບໍ່ໄດ້ (offline ແລະ ບໍ່ມີ cache) → ໃຊ້ຂໍ້ມູນ
  // ພື້ນຖານຈາກ Auth ຄືເກົ່າ ບໍ່ signOut; uid = uuid = auth uid ຢູ່ແລ້ວ ຈຶ່ງບໍ່ປົນກັນ
  let employeeData: Partial<Employee> | null | undefined
  try {
    employeeData = await resolveEmployeeForFirebaseUser(firebaseUser)
  } catch (error) {
    console.error('Error fetching employee data:', error)
  }
  if (employeeData === null) return null

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
      // doc id === auth uid (fetchEmployeeByUid) — uid ແລະ uuid ຕ້ອງເທົ່າກັນສະເໝີ
      uid: firebaseUser.uid,
      uuid: firebaseUser.uid,
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

  const [accountMismatchError, setAccountMismatchError] = useState<string | null>(null)
  const clearAccountMismatchError = useCallback(() => setAccountMismatchError(null), [])
  const rejectingAccountRef = useRef<{ uid: string; promise: Promise<void> } | null>(null)

  // ບັນຊີ Auth ທີ່ບໍ່ມີ employees/{auth uid}: ບັນທຶກ audit (ຕ້ອງຂຽນກ່ອນ signOut — logAuditEvent
  // ຕ້ອງການ auth) ແລ້ວ signOut ແລະ ສະແດງຂໍ້ຄວາມ. login() ແລະ onAuthStateChanged ເອີ້ນພ້ອມກັນໄດ້
  // ໃນ login ດຽວ — ໃຊ້ promise ດຽວກັນ ແລະ ຂ້າມຖ້າ session ນັ້ນຖືກ signOut ແລ້ວ ເພື່ອບໍ່ໃຫ້ audit ຊ້ຳ
  const rejectUnmatchedAccount = useCallback((fbUser: FirebaseUser): Promise<void> => {
    const pending = rejectingAccountRef.current
    if (pending?.uid === fbUser.uid) return pending.promise

    const promise = (async () => {
      if (auth.currentUser?.uid === fbUser.uid) {
        await logAudit({
          action: 'auth.uid.mismatch',
          actorUid: fbUser.uid,
          actorName: fbUser.displayName || fbUser.email || fbUser.uid,
          actorRoleUuid: '',
          targetType: 'employees',
          targetId: fbUser.uid,
          before: { authUid: fbUser.uid, email: fbUser.email ?? null },
          reason: 'employees/{auth uid} not found — relink with HRM-System-SSMI/functions/scripts/relink-auth-uid.js',
          status: 'FAILED',
          errorMessage: ACCOUNT_MISMATCH_MESSAGE,
        })
        await performFullSignOut()
      }
      setAccountMismatchError(ACCOUNT_MISMATCH_MESSAGE)
    })().finally(() => {
      if (rejectingAccountRef.current?.promise === promise) rejectingAccountRef.current = null
    })
    rejectingAccountRef.current = { uid: fbUser.uid, promise }
    return promise
  }, [performFullSignOut])

  // Listen for auth state changes
  useEffect(() => {
    const INACTIVE_MAX_MS = 5 * 24 * 60 * 60 * 1000 // 5 days inactivity
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
            // 5-day-inactive session), unlike login/every-app-open.
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
              reason: '5-day inactivity timeout',
              status: 'SUCCESS',
            })
            await performFullSignOut()
            setFirebaseUser(null)
            setUser(null)
            setIsLoading(false)
            return
          }

          // Force logout — HRM system-setting ຂຽນ adminSettings/forceLogoutPortal (ທຸກຄົນ) ຫຼື
          // forceLogoutUsers/{uid}.portalAt (ສະເພາະຄົນ). ກວດຕອນເປີດ app ສຳລັບ trigger ທີ່ເກີດຕອນປິດ app;
          // ຕອນ app ເປີດຢູ່ ຟັງແບບ real-time ຢູ່ useEffect ລຸ່ມ
          if (stored) {
            try {
              const triggeredAt = await latestForceLogoutAt(fbUser.uid)
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
                  reason: 'forceLogoutPortal / forceLogoutUsers.portalAt newer than last active session',
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
          if (!employeeData) {
            debugMark('account-mismatch', { uid: fbUser.uid })
            await rejectUnmatchedAccount(fbUser)
            setFirebaseUser(null)
            setUser(null)
            return
          }
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
  }, [performFullSignOut, rejectUnmatchedAccount])

  // Force logout ແບບ real-time ຕອນ app ເປີດຢູ່ — trigger ທີ່ເກີດກ່ອນ listener ເລີ່ມ ຖືກກວດແລ້ວໃນ
  // onAuthStateChanged ຂ້າງເທິງ, ສະນັ້ນທີ່ນີ້ສົນໃຈສະເພາະເວລາທີ່ໃໝ່ກວ່າຕອນເລີ່ມຟັງ
  const forcedSignOutRef = useRef(false)
  useEffect(() => {
    const uid = firebaseUser?.uid
    if (!uid) return
    const listenStart = Date.now()
    forcedSignOutRef.current = false

    const handle = (triggeredAt: unknown, source: string) => {
      if (typeof triggeredAt !== 'string' || forcedSignOutRef.current) return
      if (new Date(triggeredAt).getTime() <= listenStart) return
      forcedSignOutRef.current = true
      ;(async () => {
        await logAudit({
          action: 'auth.forceLogout.trigger',
          actorUid: uid,
          actorName: firebaseUser?.displayName || firebaseUser?.email || uid,
          actorRoleUuid: user?.rolesUid ?? '',
          actorRoleName: user?.rolesName,
          workLocation: extractWorkLocationLog(user?.workLocation),
          targetType: 'employees',
          targetId: uid,
          reason: `${source} triggered while app open`,
          status: 'SUCCESS',
        }).catch(() => undefined)
        await performFullSignOut()
        setFirebaseUser(null)
        setUser(null)
      })()
    }

    const unsubAll = onSnapshot(
      doc(db, 'adminSettings', 'forceLogoutPortal'),
      (snap) => handle(snap.data()?.triggeredAt, 'adminSettings/forceLogoutPortal'),
      (err) => console.error('forceLogoutPortal listener error:', err),
    )
    const unsubUser = onSnapshot(
      doc(db, 'forceLogoutUsers', uid),
      (snap) => handle(snap.data()?.portalAt, 'forceLogoutUsers.portalAt'),
      (err) => console.error('forceLogoutUsers listener error:', err),
    )
    return () => {
      unsubAll()
      unsubUser()
    }
    // user ໃຊ້ແຕ່ໃສ່ audit — ບໍ່ຕ້ອງ subscribe ໃໝ່ທຸກຄັ້ງທີ່ profile ປ່ຽນ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser?.uid, performFullSignOut])

  const completeGoogleLink = useCallback(async (email: string, password: string, credential: AuthCredential) => {
    await signInWithEmailAndPassword(auth, email, password)

    if (!auth.currentUser) {
      return { success: false, error: 'Unable to verify account. Please try again.' }
    }

    // The password sign-in above already established the session — linking the
    // Google credential on top of it is a convenience, not a requirement. When
    // Google is already on this account Firebase throws
    // auth/provider-already-linked; letting that escape used to fail the whole
    // login and strand the user on the login screen while actually signed in.
    try {
      await linkWithCredential(auth.currentUser, credential)
    } catch (linkError: any) {
      if (linkError?.code !== 'auth/provider-already-linked') throw linkError
    }

    const employeeData = await resolveEmployeeForFirebaseUser(auth.currentUser)
    if (!employeeData) {
      await rejectUnmatchedAccount(auth.currentUser)
      return { success: false, error: ACCOUNT_MISMATCH_MESSAGE }
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
  }, [rejectUnmatchedAccount])

  // ກັນ login ຊ້ອນກັນ (ກົດ Enter/ປຸ່ມຊ້ຳກ່ອນ re-render ປິດປຸ່ມ) — ທຸກ request ທີ່ fail ນັບເຂົ້າ
  // rate limit ຂອງ Firebase (auth/too-many-requests). ບໍ່ມີ retry ອັດຕະໂນມັດ.
  const loginInFlightRef = useRef(false)

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; errorCode?: string }> => {
    if (loginInFlightRef.current) return { success: false, errorCode: 'in-flight' }
    loginInFlightRef.current = true
    setIsLoading(true)
    email = email.trim()
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      // ກວດ employees/{auth uid} ກ່ອນ return true — ບໍ່ດັ່ງນັ້ນ LoginForm ຈະ push /dashboard ແລ້ວ
      // ຖືກເຕະອອກທີຫຼັງ. ອ່ານບໍ່ໄດ້ (undefined) ປ່ອຍໃຫ້ onAuthStateChanged ຕັດສິນ ຄືເກົ່າ
      const employeeData = await resolveEmployeeForFirebaseUser(result.user).catch(() => undefined)
      if (employeeData === null) {
        await rejectUnmatchedAccount(result.user)
        setIsLoading(false)
        return { success: false, errorCode: 'account-mismatch' }
      }
      await logAudit({
        action: 'auth.login',
        actorUid: result.user.uid,
        actorName: result.user.displayName || result.user.email || email,
        actorRoleUuid: employeeData?.rolesUid ?? '',
        actorRoleName: employeeData?.rolesName,
        workLocation: extractWorkLocationLog(employeeData?.workLocation),
        targetType: 'employees',
        targetId: result.user.uid,
        status: 'SUCCESS',
      })
      return { success: true }
    } catch (error: any) {
      console.error('Login error:', error)
      setIsLoading(false)
      return { success: false, errorCode: error?.code }
    } finally {
      loginInFlightRef.current = false
    }
  }, [rejectUnmatchedAccount])

  // Shared by the popup path (loginWithGoogle) and the redirect path (mount
  // effect below) — both end up with a UserCredential that needs the same
  // "is this actually a registered employee" gate.
  const processGoogleCredentialResult = useCallback(async (
    result: UserCredential
  ): Promise<GoogleLoginOutcome> => {
    const employeeData = await resolveEmployeeForFirebaseUser(result.user)

    if (!employeeData) {
      // Still authenticated at this point (Firebase created the session before
      // we discovered there is no employees/{auth uid}) — rejectUnmatchedAccount
      // logs while we still can, then signs out.
      clearPendingGoogleLink()
      await rejectUnmatchedAccount(result.user)
      setIsLoading(false)
      return { success: false, error: ACCOUNT_MISMATCH_MESSAGE }
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
  }, [clearPendingGoogleLink, rejectUnmatchedAccount])

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

    // Raised when the SDK runs a *link* task for a provider the signed-in
    // account already holds (stale popup/redirect state, or a re-linking
    // attempt). The session is valid at this point — the only thing that
    // failed is a redundant link — so continue through the normal employee
    // gate instead of reporting a sign-in failure.
    if (error?.code === 'auth/provider-already-linked' && auth.currentUser) {
      clearPendingGoogleLink()
      return await processGoogleCredentialResult({ user: auth.currentUser } as UserCredential)
    }

    console.error('Google login error:', error)
    clearPendingGoogleLink()
    setIsLoading(false)
    return { success: false, error: 'Google sign-in failed. Please try again.' }
  }, [clearPendingGoogleLink, completeGoogleLink, processGoogleCredentialResult])

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
      await sendPasswordResetEmail(auth, email.trim())
      return { success: true }
    } catch (error: any) {
      if (error?.code === 'auth/user-not-found' || error?.code === 'auth/invalid-email') {
        return { success: false, error: 'ບໍ່ພົບອີເມວນີ້ໃນລະບົບ' }
      }
      if (error?.code === 'auth/too-many-requests') {
        return { success: false, error: 'ພະຍາຍາມຫຼາຍເກີນໄປ. ກະລຸນາລໍຖ້າບໍ່ເທົ່າໃດນາທີ.' }
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
      accountMismatchError,
      clearAccountMismatchError,
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
