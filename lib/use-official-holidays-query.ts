'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchOfficialHolidays } from '@/services/officialHolidays'

export const holidayKeys = {
  all: ['officialHolidays'] as const,
}

export function useOfficialHolidays() {
  return useQuery({
    queryKey: holidayKeys.all,
    queryFn: fetchOfficialHolidays,
    staleTime: 1000 * 60 * 60, // 1 hour — holidays rarely change
  })
}
