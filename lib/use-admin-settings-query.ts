'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchAttendanceTimes, fetchEmployeeSelfEditEnabled } from '@/services/admin-settings'

export const adminSettingsKeys = {
  employeeSelfEdit: ['adminSettings', 'employeeSelfEdit'] as const,
  attendanceTimes: ['adminSettings', 'attendanceTimes'] as const,
}

export function useEmployeeSelfEditEnabled() {
  return useQuery({
    queryKey: adminSettingsKeys.employeeSelfEdit,
    queryFn: fetchEmployeeSelfEditEnabled,
    staleTime: 1000 * 60 * 5, // 5 min — an admin toggling this should take effect promptly
  })
}

export function useAttendanceTimes() {
  return useQuery({
    queryKey: adminSettingsKeys.attendanceTimes,
    queryFn: fetchAttendanceTimes,
    staleTime: 1000 * 60 * 5,
  })
}
