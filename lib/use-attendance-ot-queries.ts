'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Employee } from './types'
import {
  fetchTodayOTAttendance,
  fetchTodayOTRequest,
  recordOTCheckIn,
  recordOTCheckOut,
  uploadOTImage,
  type OTPunchParams,
} from '@/services/attendance-ot'
import { getDeviceInfo } from '@/lib/device'
import { toDepartmentPayload, toWorkLocationPayload } from '@/lib/use-attendance-queries'

export const attendanceOTKeys = {
  all: ['attendanceOT'] as const,
  request: (userUuid: string, isoDate: string) =>
    [...attendanceOTKeys.all, 'request', userUuid, isoDate] as const,
  today: (userUuid: string, isoDate: string) =>
    [...attendanceOTKeys.all, 'today', userUuid, isoDate] as const,
}

export function useTodayOTRequest(userUuid: string | undefined, isoDate: string) {
  return useQuery({
    queryKey: attendanceOTKeys.request(userUuid ?? '', isoDate),
    queryFn: () => fetchTodayOTRequest(userUuid!, isoDate),
    enabled: !!userUuid,
    staleTime: 5 * 60 * 1000,
  })
}

export function useTodayOTAttendance(
  userUuid: string | undefined,
  isoDate: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: attendanceOTKeys.today(userUuid ?? '', isoDate),
    queryFn: () => fetchTodayOTAttendance(userUuid!, isoDate),
    enabled: !!userUuid && enabled,
  })
}

type OTPunchInput = {
  user: Employee
  type: 'checkIn' | 'checkOut'
  imageFile: File
  location: { lat: number; lng: number }
  accuracy?: number
}

export function useOTPunch(isoDate: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ user, type, imageFile, location, accuracy }: OTPunchInput) => {
      if (!user.uuid) throw new Error('User uuid is missing. Unable to update attendance.')
      const [device, imageURL] = await Promise.all([
        getDeviceInfo(),
        uploadOTImage(imageFile, user.uuid, type),
      ])
      const params: OTPunchParams = {
        userUuid: user.uuid,
        location,
        accuracy,
        imageURL,
        fullNameEn: `${user.firstNameEn || user.firstName} ${user.lastNameEn || user.lastName}`.trim(),
        fullNameLo: `${user.firstNameLo || ''} ${user.lastNameLo || ''}`.trim() || undefined,
        jobTitle: user.jobTitle || user.position,
        jobTitleLo: user.jobTitleLo || undefined,
        employeeImage: user.profileImage || user.photo3x4Url || user.avatar,
        department: toDepartmentPayload(user.department),
        workLocation: toWorkLocationPayload(user.workLocation),
        deviceLocalId: device.localId,
        deviceFingerprint: device.fingerprint,
        deviceModel: device.model,
      }
      return type === 'checkIn' ? recordOTCheckIn(params) : recordOTCheckOut(params)
    },
    onSuccess: (_data, { user }) => {
      if (!user.uuid) return
      queryClient.invalidateQueries({ queryKey: attendanceOTKeys.today(user.uuid, isoDate) })
    },
  })
}
