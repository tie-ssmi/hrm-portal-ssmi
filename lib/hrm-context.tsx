'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type {
  AttendanceRecord,
  HRMContextType,
  LeaveRequest,
  OffsiteRequest,
  ProfileUpdateRequest,
  LeaveBalance,
  LeaveApproverRole,
  GeoFence,
  LeaveApprovalStep,
} from './types'
import {
  buildInitialLeaveApprovals,
  getRequiredLeaveApprovers,
  resolveLeaveRequestStatus,
} from '@/services/leave-approval'
import {
  formatAttendanceDocumentDate,
  updateAttendanceCheckInTime,
  updateAttendanceCheckOutTime,
} from '@/services/attendance'
import { createLeaveRequest } from '@/services/leaves'
import { fetchWorkLocationGeoFence, type WorkLocationFenceResult } from '@/services/workLocations'
import { useAuth } from './auth-context'
import { useAttendanceHistory } from './use-attendance-queries'
import { attendanceKeys } from './use-attendance-queries'
import { leaveKeys } from './use-leave-queries'

const HRMContext = createContext<HRMContextType | undefined>(undefined)

function calculateDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371e3
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatLocalIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const d = date.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toDepartmentPayload(department: unknown): { name: string; uid: string } | undefined {
  if (!department) return undefined
  if (typeof department === 'string') return { name: department, uid: '' }
  if (typeof department === 'object') {
    const v = department as Record<string, unknown>
    const name =
      typeof v.nameLo === 'string' ? v.nameLo
        : typeof v.name === 'string' ? v.name
        : typeof v.department === 'string' ? v.department
        : ''
    if (!name) return undefined
    return { name, uid: typeof v.uid === 'string' ? v.uid : '' }
  }
  return undefined
}

function toWorkLocationPayload(
  workLocation: unknown,
): { code?: string; name: string; uid?: string } | undefined {
  if (!workLocation) return undefined
  if (typeof workLocation === 'string') return { name: workLocation }
  if (typeof workLocation === 'object') {
    const v = workLocation as Record<string, unknown>
    const name = typeof v.name === 'string' ? v.name : ''
    if (!name) return undefined
    return {
      name,
      ...(typeof v.code === 'string' ? { code: v.code } : {}),
      ...(typeof v.uid === 'string' ? { uid: v.uid } : {}),
    }
  }
  return undefined
}

export function HRMProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // ── Attendance via TanStack Query (single source of truth) ────────────────
  const { data: attendanceHistory = [] } = useAttendanceHistory(user?.uuid)

  const todayAttendance = useMemo<AttendanceRecord | null>(() => {
    const today = formatLocalIsoDate(new Date())
    return attendanceHistory.find((r) => r.date === today) ?? null
  }, [attendanceHistory])

  // ── Static balance placeholder (replace with real query when API ready) ───
  const [leaveBalance] = useState<LeaveBalance>({
    annual: 0, annualUsed: 0,
    sick: 0, sickUsed: 0,
    personal: 0, personalUsed: 0,
  })

  // ── Geo-fence ─────────────────────────────────────────────────────────────
  const [geoFence, setGeoFence] = useState<GeoFence | null>(null)
  const [geoFenceStatus, setGeoFenceStatus] = useState<
    WorkLocationFenceResult['status'] | 'loading'
  >('loading')

  const workLocationUuid =
    typeof user?.workLocation === 'object'
      ? ((user.workLocation as { uuid?: string; uid?: string; code?: string })?.uuid
          || (user.workLocation as { uid?: string })?.uid
          || (user.workLocation as { code?: string })?.code)
      : typeof user?.workLocation === 'string'
      ? user.workLocation
      : undefined

  useEffect(() => {
    if (!workLocationUuid) {
      setGeoFenceStatus('not_found')
      return
    }
    let mounted = true
    setGeoFenceStatus('loading')
    fetchWorkLocationGeoFence(workLocationUuid)
      .then((result) => {
        if (!mounted) return
        setGeoFenceStatus(result.status)
        if (result.status === 'found') setGeoFence(result.fence)
      })
      .catch(() => { if (mounted) setGeoFenceStatus('not_found') })
    return () => { mounted = false }
  }, [workLocationUuid])

  const distanceToOffice = useCallback(
    (lat: number, lng: number): number | null =>
      geoFence ? Math.round(calculateDistance(lat, lng, geoFence.lat, geoFence.lng)) : null,
    [geoFence],
  )

  const isWithinGeofence = useCallback(
    (lat: number, lng: number) =>
      !geoFence || calculateDistance(lat, lng, geoFence.lat, geoFence.lng) <= geoFence.radius,
    [geoFence],
  )

  // ── Check-in / Check-out ──────────────────────────────────────────────────
  const checkIn = useCallback(
    async (location?: { lat: number; lng: number }) => {
      if (todayAttendance?.checkIn) return { success: false, message: 'Already checked in today' }
      if (!user?.uuid) return { success: false, message: 'User uuid is missing.' }

      const now = new Date()
      const attendanceDate = formatAttendanceDocumentDate(now)
      const checkInTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      const nowMin = now.getHours() * 60 + now.getMinutes()
      const checkInStatus: 'present' | 'late' | 'not_check_in' =
        nowMin <= 8 * 60 + 15 ? 'present'
        : nowMin < 10 * 60 ? 'late'
        : 'not_check_in'

      await updateAttendanceCheckInTime({
        userUuid: user.uuid,
        uid: user.uid || user.uuid,
        date: attendanceDate,
        checkInTime,
        status: checkInStatus,
        location,
        createdBy: 'system',
        fullNameEn: `${user.firstNameEn || user.firstName} ${user.lastNameEn || user.lastName}`.trim(),
        fullNameLo: `${user.firstNameLo || ''} ${user.lastNameLo || ''}`.trim() || undefined,
        jobTitle: user.jobTitle || user.position,
        employeeImage: user.profileImage || user.photo3x4Url || user.avatar,
        note: null,
        department: toDepartmentPayload(user.department),
        workLocation: toWorkLocationPayload(user.workLocation),
      })

      // Invalidate → re-fetch from Firestore to stay in sync
      queryClient.invalidateQueries({ queryKey: attendanceKeys.history(user.uuid) })

      return {
        success: true,
        message: checkInStatus !== 'present' ? `Checked in late at ${checkInTime}` : `Checked in at ${checkInTime}`,
      }
    },
    [todayAttendance, user, queryClient],
  )

  const checkOut = useCallback(
    async (location?: { lat: number; lng: number }) => {
      if (!todayAttendance?.checkIn) return { success: false, message: 'Please check in first' }
      if (todayAttendance?.checkOut) return { success: false, message: 'Already checked out today' }
      if (!user?.uuid) return { success: false, message: 'User uuid is missing.' }

      const now = new Date()
      const attendanceDate = formatAttendanceDocumentDate(now)
      const checkOutTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

      await updateAttendanceCheckOutTime({
        userUuid: user.uuid,
        uid: user.uid || user.uuid,
        date: attendanceDate,
        checkOutTime,
        workHours: 8,
        location: location || todayAttendance.location,
        fullNameEn: `${user.firstNameEn || user.firstName} ${user.lastNameEn || user.lastName}`.trim(),
        fullNameLo: `${user.firstNameLo || ''} ${user.lastNameLo || ''}`.trim() || undefined,
        jobTitle: user.jobTitle || user.position,
        employeeImage: user.profileImage || user.photo3x4Url || user.avatar,
        department: toDepartmentPayload(user.department),
        workLocation: toWorkLocationPayload(user.workLocation),
      })

      queryClient.invalidateQueries({ queryKey: attendanceKeys.history(user.uuid) })

      return { success: true, message: `Checked out at ${checkOutTime}` }
    },
    [todayAttendance, user, queryClient],
  )

  // ── Submit leave (invalidates query cache) ────────────────────────────────
  const submitLeaveRequest = useCallback(
    async (
      request: Omit<LeaveRequest, 'id' | 'status' | 'createdAt'>,
      approvalsOverride?: LeaveApprovalStep[],
    ) => {
      const requiredApprovers = getRequiredLeaveApprovers(request.duration)
      const approvals = approvalsOverride ?? buildInitialLeaveApprovals(request.duration)
      const status = resolveLeaveRequestStatus(approvals)
      const createdBy = [user?.firstNameLo || user?.firstName, user?.lastNameLo || user?.lastName]
        .filter(Boolean).join(' ') || undefined

      const payload: Omit<LeaveRequest, 'id'> = {
        ...request,
        status,
        requiredApprovers,
        approvals,
        createdAt: new Date().toISOString().split('T')[0],
        createdBy,
      }

      await createLeaveRequest(payload)

      // Invalidate all leave caches so pages re-fetch fresh data
      if (payload.leaveUserUuid) {
        queryClient.invalidateQueries({ queryKey: leaveKeys.byUser(payload.leaveUserUuid) })
        queryClient.invalidateQueries({ queryKey: leaveKeys.upcoming(payload.leaveUserUuid) })
      }
      if (payload.workLocationUid) {
        queryClient.invalidateQueries({ queryKey: leaveKeys.today(payload.workLocationUid) })
      }
      if (payload.departmentUid && payload.workLocationUid) {
        queryClient.invalidateQueries({
          queryKey: leaveKeys.approval(payload.departmentUid, payload.workLocationUid),
        })
      }
    },
    [user, queryClient],
  )

  const reviewLeaveRequest = useCallback(
    async (
      requestId: string,
      role: LeaveApproverRole,
      decision: 'approved' | 'rejected',
      reviewedBy?: string,
    ) => {
      // Optimistic local update handled by approv page's own queryClient
      // invalidate approval lists so approv page re-fetches
      queryClient.invalidateQueries({ queryKey: leaveKeys.all })
    },
    [queryClient],
  )

  const submitOffsiteRequest = useCallback(
    async (request: Omit<OffsiteRequest, 'id' | 'status' | 'createdAt'>) => {
      // placeholder — replace with real Firestore write when service is ready
      await new Promise((r) => setTimeout(r, 500))
    },
    [],
  )

  const submitProfileUpdate = useCallback(
    async (request: Omit<ProfileUpdateRequest, 'id' | 'status' | 'createdAt'>) => {
      await new Promise((r) => setTimeout(r, 500))
    },
    [],
  )

  return (
    <HRMContext.Provider
      value={{
        todayAttendance,
        attendanceHistory,
        checkIn,
        checkOut,
        leaveBalance,
        leaveRequests: [],       // deprecated — use useUserLeaves() hook in pages
        submitLeaveRequest,
        reviewLeaveRequest,
        offsiteRequests: [],     // deprecated — use query in pages
        submitOffsiteRequest,
        profileUpdateRequests: [],
        submitProfileUpdate,
        lateRecords: [],         // deprecated — no service yet
        totalFines: 0,
        isWithinGeofence,
        distanceToOffice,
        geoFenceStatus,
      }}
    >
      {children}
    </HRMContext.Provider>
  )
}

export function useHRM() {
  const context = useContext(HRMContext)
  if (!context) throw new Error('useHRM must be used within an HRMProvider')
  return context
}
