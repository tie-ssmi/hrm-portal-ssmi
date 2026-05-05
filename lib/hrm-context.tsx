'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { AttendanceRecord, HRMContextType, LeaveRequest, OffsiteRequest, ProfileUpdateRequest, LeaveBalance, LateRecord, LeaveApproverRole, GeoFence } from './types'
import { buildInitialLeaveApprovals, getRequiredLeaveApprovers, resolveLeaveRequestStatus } from '@/services/leave-approval'
import { fetchAttendanceByUserThisMonth, formatAttendanceDocumentDate, updateAttendanceCheckInTime, updateAttendanceCheckOutTime } from '@/services/attendance'
import { createLeaveRequest } from '@/services/leaves'
import { fetchWorkLocationGeoFence } from '@/services/workLocations'
import { useAuth } from './auth-context'

const HRMContext = createContext<HRMContextType | undefined>(undefined)

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lng2 - lng1) * Math.PI / 180

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

  return R * c // Distance in meters
}

function formatLocalIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toDepartmentPayload(department: unknown): { name: string; uid: string } | undefined {
  if (!department) {
    return undefined
  }

  if (typeof department === 'string') {
    return { name: department, uid: '' }
  }

  if (typeof department === 'object') {
    const value = department as Record<string, unknown>
    const name = typeof value.nameLo === 'string'
      ? value.nameLo
      : typeof value.name === 'string'
        ? value.name
        : typeof value.department === 'string'
          ? value.department
          : ''

    if (!name) {
      return undefined
    }

    return {
      name,
      uid: typeof value.uid === 'string' ? value.uid : '',
    }
  }

  return undefined
}

function toWorkLocationPayload(workLocation: unknown): { code?: string; name: string; uid?: string } | undefined {
  if (!workLocation) {
    return undefined
  }

  if (typeof workLocation === 'string') {
    return { name: workLocation }
  }

  if (typeof workLocation === 'object') {
    const value = workLocation as Record<string, unknown>
    const name = typeof value.name === 'string' ? value.name : ''

    if (!name) {
      return undefined
    }

    return {
      name,
      ...(typeof value.code === 'string' ? { code: value.code } : {}),
      ...(typeof value.uid === 'string' ? { uid: value.uid } : {}),
    }
  }

  return undefined
}

export function HRMProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null)
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([])
  const [leaveBalance] = useState<LeaveBalance>({ annual: 0, annualUsed: 0, sick: 0, sickUsed: 0, personal: 0, personalUsed: 0 })
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [offsiteRequests, setOffsiteRequests] = useState<OffsiteRequest[]>([])
  const [profileUpdateRequests, setProfileUpdateRequests] = useState<ProfileUpdateRequest[]>([])
  const [lateRecords] = useState<LateRecord[]>([])
  const [geoFence, setGeoFence] = useState<GeoFence | null>(null)

  const workLocationUuid = typeof user?.workLocation === 'object'
    ? ((user.workLocation as { uuid?: string; code?: string })?.uuid
        || (user.workLocation as { code?: string })?.code)
    : typeof user?.workLocation === 'string'
      ? user.workLocation
      : undefined

  useEffect(() => {
    if (!workLocationUuid) return
    let isMounted = true
    fetchWorkLocationGeoFence(workLocationUuid).then((fence) => {
      if (isMounted && fence) setGeoFence(fence)
    })
    return () => { isMounted = false }
  }, [workLocationUuid])

  useEffect(() => {
    let isMounted = true

    async function loadAttendance() {
      if (!user?.uuid) {
        if (isMounted) {
          setTodayAttendance(null)
          setAttendanceHistory([])
        }
        return
      }

      try {
        const records = await fetchAttendanceByUserThisMonth(user.uuid)

        if (!isMounted) {
          return
        }

        setAttendanceHistory(records)

        const todayIso = formatLocalIsoDate(new Date())
        const todayRecord = records.find((record) => record.date === todayIso) || null
        setTodayAttendance(todayRecord)
      } catch (error) {
        console.error('Error loading attendance history:', error)
        if (isMounted) {
          setTodayAttendance(null)
          setAttendanceHistory([])
        }
      }
    }

    loadAttendance()

    return () => {
      isMounted = false
    }
  }, [user?.uuid])

  const distanceToOffice = useCallback((lat: number, lng: number): number | null => {
    if (!geoFence) return null
    return Math.round(calculateDistance(lat, lng, geoFence.lat, geoFence.lng))
  }, [geoFence])

  const isWithinGeofence = useCallback((lat: number, lng: number) => {
    if (!geoFence) return true
    const distance = calculateDistance(lat, lng, geoFence.lat, geoFence.lng)
    return distance <= geoFence.radius
  }, [geoFence])

  const checkIn = useCallback(async (location?: { lat: number; lng: number }) => {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    if (todayAttendance?.checkIn) {
      return { success: false, message: 'Already checked in today' }
    }

    if (!user?.uuid) {
      return { success: false, message: 'User uuid is missing. Unable to update attendance.' }
    }

    const now = new Date()
    const attendanceDate = formatAttendanceDocumentDate(now)
    const checkInTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    const isLate = now.getHours() >= 9 && now.getMinutes() > 0

    await updateAttendanceCheckInTime({
      userUuid: user.uuid,
      uid: user.uid || user.uuid,
      date: attendanceDate,
      checkInTime,
      status: isLate ? 'late' : 'present',
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
    
    const newAttendance: AttendanceRecord = {
      id: `${user.uuid}_${attendanceDate}`,
      date: now.toISOString().split('T')[0],
      checkIn: checkInTime,
      status: isLate ? 'late' : 'present',
      location
    }
    
    setTodayAttendance(newAttendance)
    setAttendanceHistory(prev => [newAttendance, ...prev])
    
    return { 
      success: true, 
      message: isLate ? `Checked in late at ${checkInTime}` : `Checked in at ${checkInTime}` 
    }
  }, [todayAttendance, user])

  const checkOut = useCallback(async (location?: { lat: number; lng: number }) => {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    if (!todayAttendance?.checkIn) {
      return { success: false, message: 'Please check in first' }
    }
    
    if (todayAttendance?.checkOut) {
      return { success: false, message: 'Already checked out today' }
    }

    if (!user?.uuid) {
      return { success: false, message: 'User uuid is missing. Unable to update attendance.' }
    }

    const now = new Date()
    const attendanceDate = formatAttendanceDocumentDate(now)
    const checkOutTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    const workHours = 8

    await updateAttendanceCheckOutTime({
      userUuid: user.uuid,
      uid: user.uid || user.uuid,
      date: attendanceDate,
      checkOutTime,
      workHours,
      location: location || todayAttendance.location,
      fullNameEn: `${user.firstNameEn || user.firstName} ${user.lastNameEn || user.lastName}`.trim(),
      fullNameLo: `${user.firstNameLo || ''} ${user.lastNameLo || ''}`.trim() || undefined,
      jobTitle: user.jobTitle || user.position,
      employeeImage: user.profileImage || user.photo3x4Url || user.avatar,
      department: toDepartmentPayload(user.department),
      workLocation: toWorkLocationPayload(user.workLocation),
    })
    
    const updatedAttendance: AttendanceRecord = {
      ...todayAttendance,
      checkOut: checkOutTime,
      location: location || todayAttendance.location,
      workHours // Simplified calculation
    }
    
    setTodayAttendance(updatedAttendance)
    setAttendanceHistory(prev => prev.map(a => a.id === updatedAttendance.id ? updatedAttendance : a))
    
    return { success: true, message: `Checked out at ${checkOutTime}` }
  }, [todayAttendance, user])

  const submitLeaveRequest = useCallback(async (request: Omit<LeaveRequest, 'id' | 'status' | 'createdAt'>) => {
    const requiredApprovers = getRequiredLeaveApprovers(request.duration)
    const approvals = buildInitialLeaveApprovals(request.duration)
    const createdAt = new Date().toISOString().split('T')[0]
    const createdBy = [user?.firstNameLo || user?.firstName, user?.lastNameLo || user?.lastName]
      .filter(Boolean)
      .join(' ') || undefined

    const payload: Omit<LeaveRequest, 'id'> = {
      ...request,
      status: 'pending',
      requiredApprovers,
      approvals,
      createdAt,
      createdBy,
    }

    const id = await createLeaveRequest(payload)
    
    const newRequest: LeaveRequest = {
      ...payload,
      id,
    }
    
    setLeaveRequests(prev => [newRequest, ...prev])
  }, [user])

  const reviewLeaveRequest = useCallback(async (
    requestId: string,
    role: LeaveApproverRole,
    decision: 'approved' | 'rejected',
    reviewedBy?: string
  ) => {
    await new Promise(resolve => setTimeout(resolve, 500))

    setLeaveRequests((prev) => prev.map((request) => {
      if (request.id !== requestId) {
        return request
      }

      const baseRequired = request.requiredApprovers && request.requiredApprovers.length > 0
        ? request.requiredApprovers
        : getRequiredLeaveApprovers(request.duration)

      const baseApprovals = baseRequired.map((requiredRole) => {
        const existing = request.approvals?.find((a) => a.role === requiredRole)
        if (existing) {
          return existing
        }
        return { role: requiredRole, decision: 'pending' as const }
      })

      const now = new Date().toISOString()
      const updatedApprovals = baseApprovals.map((approval) => {
        if (approval.role !== role) {
          return approval
        }
        return {
          ...approval,
          decision,
          reviewedBy: reviewedBy || approval.reviewedBy,
          reviewedAt: now,
        }
      })

      const status = resolveLeaveRequestStatus(updatedApprovals)
      return {
        ...request,
        requiredApprovers: baseRequired,
        approvals: updatedApprovals,
        status,
        reviewedBy: reviewedBy || request.reviewedBy,
        reviewedAt: status !== 'pending' ? now : request.reviewedAt,
      }
    }))
  }, [])

  const submitOffsiteRequest = useCallback(async (request: Omit<OffsiteRequest, 'id' | 'status' | 'createdAt'>) => {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const newRequest: OffsiteRequest = {
      ...request,
      id: Date.now().toString(),
      status: 'pending',
      createdAt: new Date().toISOString().split('T')[0]
    }
    
    setOffsiteRequests(prev => [newRequest, ...prev])
  }, [])

  const submitProfileUpdate = useCallback(async (request: Omit<ProfileUpdateRequest, 'id' | 'status' | 'createdAt'>) => {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const newRequest: ProfileUpdateRequest = {
      ...request,
      id: Date.now().toString(),
      status: 'pending',
      createdAt: new Date().toISOString().split('T')[0]
    }
    
    setProfileUpdateRequests(prev => [newRequest, ...prev])
  }, [])

  const totalFines = lateRecords.reduce((sum, record) => sum + record.fine, 0)

  return (
    <HRMContext.Provider value={{
      todayAttendance,
      attendanceHistory,
      checkIn,
      checkOut,
      leaveBalance,
      leaveRequests,
      submitLeaveRequest,
      reviewLeaveRequest,
      offsiteRequests,
      submitOffsiteRequest,
      profileUpdateRequests,
      submitProfileUpdate,
      lateRecords,
      totalFines,
      isWithinGeofence,
      distanceToOffice,
    }}>
      {children}
    </HRMContext.Provider>
  )
}

export function useHRM() {
  const context = useContext(HRMContext)
  if (!context) {
    throw new Error('useHRM must be used within an HRMProvider')
  }
  return context
}
