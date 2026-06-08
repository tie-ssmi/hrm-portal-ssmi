import { useQuery } from '@tanstack/react-query'
import { fetchAllTodayOffsite, fetchTodayOffsiteByWorkLocation } from '@/services/workOutside'

export const workOutsideKeys = {
  todayAll: () => ['workOutside', 'today', '__all__'] as const,
  todayByWorkLocation: (uid: string) => ['workOutside', 'today', uid] as const,
}

export function useAllTodayOffsite() {
  return useQuery({
    queryKey: workOutsideKeys.todayAll(),
    queryFn: fetchAllTodayOffsite,
    staleTime: 1000 * 60 * 5,
  })
}

export function useTodayOffsiteByWorkLocation(workLocationUid: string | null | undefined) {
  return useQuery({
    queryKey: workOutsideKeys.todayByWorkLocation(workLocationUid ?? ''),
    queryFn: () => fetchTodayOffsiteByWorkLocation(workLocationUid!),
    enabled: !!workLocationUid,
    staleTime: 1000 * 60 * 5,
  })
}
