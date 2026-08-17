'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchEmployeeCompensation } from '@/lib/employees'

export const compensationKeys = {
  detail: (uid: string) => ['employeeCompensation', uid] as const,
}

export function useEmployeeCompensation(uid: string | undefined) {
  return useQuery({
    queryKey: compensationKeys.detail(uid || ''),
    queryFn: () => fetchEmployeeCompensation(uid as string),
    enabled: Boolean(uid),
    staleTime: 5 * 60 * 1000,
  })
}
