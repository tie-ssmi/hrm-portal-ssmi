'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { AttendanceRecord, Employee } from './types'
import {
  fetchAttendanceByUserThisMonth,
  formatAttendanceDocumentDate,
  updateAttendanceCheckInTime,
  updateAttendanceCheckOutTime,
} from '@/services/attendance'

type AttendanceLocation = {
  lat: number
  lng: number
}

type AttendanceStatus = AttendanceRecord['status']

// Query keys factory for attendance
export const attendanceKeys = {
  all: ['attendance'] as const,
  history: (userUuid: string) => [...attendanceKeys.all, 'history', userUuid] as const,
}

function formatLocalIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

function upsertAttendanceRecord(
  records: AttendanceRecord[] | undefined,
  nextRecord: AttendanceRecord
): AttendanceRecord[] {
  const currentRecords = records || []
  const existingIndex = currentRecords.findIndex((record) => record.date === nextRecord.date)

  if (existingIndex === -1) {
    return [...currentRecords, nextRecord].sort((left, right) => right.date.localeCompare(left.date))
  }

  const updatedRecords = [...currentRecords]
  updatedRecords[existingIndex] = {
    ...updatedRecords[existingIndex],
    ...nextRecord,
  }

  return updatedRecords.sort((left, right) => right.date.localeCompare(left.date))
}

/**
 * Fetch attendance history for the current month
 */
export function useAttendanceHistory(userUuid: string | null | undefined) {
  return useQuery({
    queryKey: attendanceKeys.history(userUuid || ''),
    queryFn: async () => {
      if (!userUuid) {
        return []
      }
      const records = await fetchAttendanceByUserThisMonth(userUuid)
      return records
    },
    enabled: !!userUuid,
  })
}

/**
 * Get today's attendance record from history
 */
export function useTodayAttendance(userUuid: string | null | undefined) {
  const { data: history = [], ...query } = useAttendanceHistory(userUuid)

  const todayAttendance = useMemo(() => {
    const todayIso = formatLocalIsoDate(new Date())
    return history.find((record) => record.date === todayIso) || null
  }, [history])

  return {
    data: todayAttendance,
    ...query,
  }
}

function toDepartmentPayload(
  department: unknown
): { name: string; uid: string } | undefined {
  if (!department) {
    return undefined
  }

  if (typeof department === 'string') {
    return { name: department, uid: '' }
  }

  if (typeof department === 'object') {
    const value = department as Record<string, unknown>
    const name =
      typeof value.nameLo === 'string'
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

function toWorkLocationPayload(
  workLocation: unknown
): { code?: string; name: string; uid?: string } | undefined {
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

type CheckInParams = {
  user: Employee
  location?: AttendanceLocation
}

/**
 * Check-in mutation
 */
export function useCheckIn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ user, location }: CheckInParams) => {
      if (!user.uuid) {
        throw new Error('User uuid is missing. Unable to update attendance.')
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

      return {
        success: true,
        attendanceDate: formatLocalIsoDate(now),
        message: isLate
          ? `Checked in late at ${checkInTime}`
          : `Checked in at ${checkInTime}`,
        checkInTime,
        status: (isLate ? 'late' : 'present') as AttendanceStatus,
      }
    },
    onSuccess: (data, variables) => {
      const userUuid = variables.user.uuid

      if (!userUuid) {
        return
      }

      queryClient.setQueryData<AttendanceRecord[]>(
        attendanceKeys.history(userUuid),
        (currentRecords) =>
          upsertAttendanceRecord(currentRecords, {
            id: `${userUuid}_${formatAttendanceDocumentDate(new Date(`${data.attendanceDate}T00:00:00`))}`,
            date: data.attendanceDate,
            checkIn: data.checkInTime,
            status: data.status,
            ...(variables.location ? { location: variables.location } : {}),
          })
      )

      queryClient.invalidateQueries({
        queryKey: attendanceKeys.history(userUuid),
      })
    },
  })
}

type CheckOutParams = {
  user: Employee
  location?: AttendanceLocation
  currentLocation?: AttendanceLocation
}

/**
 * Check-out mutation
 */
export function useCheckOut() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ user, location, currentLocation }: CheckOutParams) => {
      if (!user.uuid) {
        throw new Error('User uuid is missing. Unable to update attendance.')
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
        location: location || currentLocation,
        fullNameEn: `${user.firstNameEn || user.firstName} ${user.lastNameEn || user.lastName}`.trim(),
        fullNameLo: `${user.firstNameLo || ''} ${user.lastNameLo || ''}`.trim() || undefined,
        jobTitle: user.jobTitle || user.position,
        employeeImage: user.profileImage || user.photo3x4Url || user.avatar,
        department: toDepartmentPayload(user.department),
        workLocation: toWorkLocationPayload(user.workLocation),
      })

      return {
        success: true,
        attendanceDate: formatLocalIsoDate(now),
        message: `Checked out at ${checkOutTime}`,
        checkOutTime,
      }
    },
    onSuccess: (data, variables) => {
      const userUuid = variables.user.uuid

      if (!userUuid) {
        return
      }

      queryClient.setQueryData<AttendanceRecord[]>(
        attendanceKeys.history(userUuid),
        (currentRecords) => {
          const existingRecord = currentRecords?.find((record) => record.date === data.attendanceDate)

          return upsertAttendanceRecord(currentRecords, {
            id: `${userUuid}_${formatAttendanceDocumentDate(new Date(`${data.attendanceDate}T00:00:00`))}`,
            date: data.attendanceDate,
            ...(existingRecord?.checkIn ? { checkIn: existingRecord.checkIn } : {}),
            checkOut: data.checkOutTime,
            status: existingRecord?.status || 'present',
            ...(variables.location || variables.currentLocation
              ? { location: variables.location || variables.currentLocation }
              : {}),
          })
        }
      )

      queryClient.invalidateQueries({
        queryKey: attendanceKeys.history(userUuid),
      })
    },
  })
}
