'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { AttendanceRecord, HRMContextType, LeaveRequest, OffsiteRequest, ProfileUpdateRequest, LeaveBalance, LateRecord, LeaveApproverRole } from './types'
import { mockAttendanceHistory, mockLeaveRequests, mockOffsiteRequests, mockLeaveBalance, mockLateRecords, mockGeoFenceLPB } from './mock-data'
import { buildInitialLeaveApprovals, getRequiredLeaveApprovers, resolveLeaveRequestStatus } from '@/services/leave-approval'
import { createLeaveRequest } from '@/services/leaves'
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

export function HRMProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null)
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>(mockAttendanceHistory)
  const [leaveBalance] = useState<LeaveBalance>(mockLeaveBalance)
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(mockLeaveRequests)
  const [offsiteRequests, setOffsiteRequests] = useState<OffsiteRequest[]>(mockOffsiteRequests)
  const [profileUpdateRequests, setProfileUpdateRequests] = useState<ProfileUpdateRequest[]>([])
  const [lateRecords] = useState<LateRecord[]>(mockLateRecords)

  const isWithinGeofence = useCallback((lat: number, lng: number) => {
    const distance = calculateDistance(lat, lng, mockGeoFenceLPB.lat, mockGeoFenceLPB.lng)
    return distance <= mockGeoFenceLPB.radius
  }, [])

  const checkIn = useCallback(async (location?: { lat: number; lng: number }) => {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    if (todayAttendance?.checkIn) {
      return { success: false, message: 'Already checked in today' }
    }

    const now = new Date()
    const checkInTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    const isLate = now.getHours() >= 9 && now.getMinutes() > 0
    
    const newAttendance: AttendanceRecord = {
      id: Date.now().toString(),
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
  }, [todayAttendance])

  const checkOut = useCallback(async (location?: { lat: number; lng: number }) => {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    if (!todayAttendance?.checkIn) {
      return { success: false, message: 'Please check in first' }
    }
    
    if (todayAttendance?.checkOut) {
      return { success: false, message: 'Already checked out today' }
    }

    const now = new Date()
    const checkOutTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    
    const updatedAttendance: AttendanceRecord = {
      ...todayAttendance,
      checkOut: checkOutTime,
      location: location || todayAttendance.location,
      workHours: 8 // Simplified calculation
    }
    
    setTodayAttendance(updatedAttendance)
    setAttendanceHistory(prev => prev.map(a => a.id === updatedAttendance.id ? updatedAttendance : a))
    
    return { success: true, message: `Checked out at ${checkOutTime}` }
  }, [todayAttendance])

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
      isWithinGeofence
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
