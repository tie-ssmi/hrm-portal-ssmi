'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchLateRankingThisMonth } from '@/services/attendance'

export const lateRankingKeys = {
  thisMonth: () => ['attendance', 'late-ranking', 'this-month'] as const,
}

export function useLateRankingThisMonth() {
  return useQuery({
    queryKey: lateRankingKeys.thisMonth(),
    queryFn: fetchLateRankingThisMonth,
    staleTime: 1000 * 60 * 5,
  })
}
