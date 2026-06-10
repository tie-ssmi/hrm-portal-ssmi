'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchLateRankingForMonth } from '@/services/attendance'

export const lateRankingKeys = {
  forMonth: (monthKey: string) => ['attendance', 'late-ranking', monthKey] as const,
}

export function useLateRankingForMonth(monthKey: string, enabled = true) {
  return useQuery({
    queryKey: lateRankingKeys.forMonth(monthKey),
    queryFn: () => fetchLateRankingForMonth(monthKey),
    enabled,
    staleTime: 1000 * 60 * 5,
  })
}
