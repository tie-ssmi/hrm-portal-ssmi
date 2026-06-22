'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { AttendanceRecord, Employee } from './types'
import {
  fetchAttendanceByUserThisMonth,
  fetchTodayCheckInAttendance,
  formatAttendanceDocumentDate,
  updateAttendanceCheckInTime,
  updateAttendanceCheckOutTime,
  uploadAttendanceImage,
} from '@/services/attendance'
import { fetchServerTime } from '@/lib/server-time'
import { fetchTodayLeaveStatus, type DayLeaveStatus } from '@/services/leaves'

export type { DayLeaveStatus }

type AttendanceLocation = {
  lat: number
  lng: number
}

type AttendanceStatus = AttendanceRecord['status']

export const attendanceKeys = {
  all: ['attendance'] as const,
  history: (userUuid: string) => [...attendanceKeys.all, 'history', userUuid] as const,
  todayCheckIn: ['attendance', 'today-check-in'] as const,
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
  const current = records || []
  const existingIndex = current.findIndex((r) => r.date === nextRecord.date)

  if (existingIndex === -1) {
    return [...current, nextRecord].sort((a, b) => b.date.localeCompare(a.date))
  }

  const updated = [...current]
  updated[existingIndex] = { ...updated[existingIndex], ...nextRecord }
  return updated
}

function toDepartmentPayload(
  department: unknown
): { name: string; uid: string } | undefined {
  if (!department) return undefined

  if (typeof department === 'string') return { name: department, uid: '' }

  if (typeof department === 'object') {
    const value = department as Record<string, unknown>
    const name =
      typeof value.nameLo === 'string' ? value.nameLo
        : typeof value.name === 'string' ? value.name
        : typeof value.department === 'string' ? value.department
        : ''
    if (!name) return undefined
    return { name, uid: typeof value.uid === 'string' ? value.uid : '' }
  }

  return undefined
}

function toWorkLocationPayload(
  workLocation: unknown
): { code?: string; name: string; uid?: string } | undefined {
  if (!workLocation) return undefined

  if (typeof workLocation === 'string') return { name: workLocation }

  if (typeof workLocation === 'object') {
    const value = workLocation as Record<string, unknown>
    const name = typeof value.name === 'string' ? value.name : ''
    if (!name) return undefined
    return {
      name,
      ...(typeof value.code === 'string' ? { code: value.code } : {}),
      ...(typeof value.uid === 'string' ? { uid: value.uid } : {}),
    }
  }

  return undefined
}

export function useAttendanceHistory(userUuid: string | null | undefined) {
  return useQuery({
    queryKey: attendanceKeys.history(userUuid || ''),
    queryFn: async () => {
      if (!userUuid) return []
      return fetchAttendanceByUserThisMonth(userUuid)
    },
    enabled: !!userUuid,
    staleTime: 1000 * 60 * 5,
  })
}

export function useTodayAttendance(userUuid: string | null | undefined) {
  const { data: history = [], ...query } = useAttendanceHistory(userUuid)

  const todayAttendance = useMemo(() => {
    const todayIso = formatLocalIsoDate(new Date())
    return history.find((r) => r.date === todayIso) ?? null
  }, [history])

  return { data: todayAttendance, ...query }
}

export function useTodayCheckInAttendance(isoDate?: string) {
  return useQuery({
    queryKey: isoDate ? [...attendanceKeys.todayCheckIn, isoDate] : attendanceKeys.todayCheckIn,
    queryFn: () => fetchTodayCheckInAttendance(isoDate),
    staleTime: 1000 * 60,
    refetchInterval: isoDate ? false : 1000 * 60 * 5,
  })
}

type CheckInParams = {
  user: Employee
  location?: AttendanceLocation
  imageFile?: File
  isOffsite?: boolean
}

type CheckInServerStatus = 'present' | 'late' | 'not_check_in'

export function useCheckIn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ user, location, imageFile, isOffsite }: CheckInParams) => {
      if (!user.uuid) throw new Error('User uuid is missing. Unable to update attendance.')

      const serverTime = await fetchServerTime(user.uuid)

      let status = serverTime.status as CheckInServerStatus
      if (isOffsite) {
        // Offsite: present < 09:00 | late 09:00–09:59 | not_check_in >= 10:00
        const [h, m] = serverTime.checkTime.split(':').map(Number)
        const nowMin = h * 60 + m
        status = nowMin < 9 * 60 ? 'present' : nowMin < 10 * 60 ? 'late' : 'not_check_in'
      }

      const checkInImageURL = imageFile
        ? await uploadAttendanceImage(imageFile, user.uuid, 'checkIn')
        : undefined

      await updateAttendanceCheckInTime({
        userUuid: user.uuid,
        uid: user.uid || user.uuid,
        date: serverTime.date,
        checkInTime: serverTime.checkTime,
        status,
        location,
        fullNameEn: `${user.firstNameEn || user.firstName} ${user.lastNameEn || user.lastName}`.trim(),
        fullNameLo: `${user.firstNameLo || ''} ${user.lastNameLo || ''}`.trim() || undefined,
        jobTitle: user.jobTitle || user.position,
        employeeImage: user.profileImage || user.photo3x4Url || user.avatar,
        department: toDepartmentPayload(user.department),
        workLocation: toWorkLocationPayload(user.workLocation),
        note: null,
        checkInImageURL,
        isOffsite,
      })

      return {
        attendanceDate: serverTime.isoDate,
        checkInTime: serverTime.checkTime,
        status: status as AttendanceStatus,
      }
    },
    onSuccess: (data, variables) => {
      const userUuid = variables.user.uuid
      if (!userUuid) return

      queryClient.setQueryData<AttendanceRecord[]>(
        attendanceKeys.history(userUuid),
        (current) =>
          upsertAttendanceRecord(current, {
            id: `${userUuid}_${formatAttendanceDocumentDate(new Date(`${data.attendanceDate}T00:00:00`))}`,
            date: data.attendanceDate,
            checkIn: data.checkInTime,
            status: data.status,
            ...(variables.location ? { location: variables.location } : {}),
          })
      )

      queryClient.invalidateQueries({ queryKey: attendanceKeys.history(userUuid) })
    },
  })
}

type CheckOutParams = {
  user: Employee
  location?: AttendanceLocation
  imageFile?: File
}

export function useCheckOut() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ user, location, imageFile }: CheckOutParams) => {
      if (!user.uuid) throw new Error('User uuid is missing. Unable to update attendance.')

      const serverTime = await fetchServerTime(user.uuid)

      const checkOutImageURL = imageFile
        ? await uploadAttendanceImage(imageFile, user.uuid, 'checkOut')
        : undefined

      await updateAttendanceCheckOutTime({
        userUuid: user.uuid,
        uid: user.uid || user.uuid,
        date: serverTime.date,
        checkOutTime: serverTime.checkTime,
        workHours: 8,
        location,
        fullNameEn: `${user.firstNameEn || user.firstName} ${user.lastNameEn || user.lastName}`.trim(),
        fullNameLo: `${user.firstNameLo || ''} ${user.lastNameLo || ''}`.trim() || undefined,
        jobTitle: user.jobTitle || user.position,
        employeeImage: user.profileImage || user.photo3x4Url || user.avatar,
        department: toDepartmentPayload(user.department),
        workLocation: toWorkLocationPayload(user.workLocation),
        checkOutImageURL,
      })

      return {
        attendanceDate: serverTime.isoDate,
        checkOutTime: serverTime.checkTime,
      }
    },
    onSuccess: (data, variables) => {
      const userUuid = variables.user.uuid
      if (!userUuid) return

      queryClient.setQueryData<AttendanceRecord[]>(
        attendanceKeys.history(userUuid),
        (current) => {
          const existing = current?.find((r) => r.date === data.attendanceDate)
          return upsertAttendanceRecord(current, {
            id: `${userUuid}_${formatAttendanceDocumentDate(new Date(`${data.attendanceDate}T00:00:00`))}`,
            date: data.attendanceDate,
            ...(existing?.checkIn ? { checkIn: existing.checkIn } : {}),
            checkOut: data.checkOutTime,
            status: existing?.status ?? 'present',
            ...(variables.location ? { location: variables.location } : {}),
          })
        }
      )

      queryClient.invalidateQueries({ queryKey: attendanceKeys.history(userUuid) })
    },
  })
}

export const leaveStatusKeys = {
  today: (userUuid: string, isoDate: string) => ['leave-status', userUuid, isoDate] as const,
}

export function useTodayLeaveStatus(userUuid: string | null | undefined, isoDate: string) {
  return useQuery({
    queryKey: leaveStatusKeys.today(userUuid || '', isoDate),
    queryFn: () => fetchTodayLeaveStatus(userUuid!, isoDate),
    enabled: !!userUuid,
    staleTime: 1000 * 60 * 5,
  })
}
