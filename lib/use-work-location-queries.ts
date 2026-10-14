import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAllWorkLocations } from '@/services/workLocations'

export const workLocationKeys = {
  all: () => ['workLocation', 'all'] as const,
}

// All branches plus a comparator that sorts branch uids or names by the
// branch's `order`. Unknown branches and ones without an order go last,
// alphabetically.
export function useWorkLocations() {
  const { data: workLocations = [] } = useQuery({
    queryKey: workLocationKeys.all(),
    queryFn: fetchAllWorkLocations,
    staleTime: 1000 * 60 * 10,
  })

  const compareWorkLocation = useMemo(() => {
    const rank = new Map<string, number>()
    for (const wl of workLocations) {
      const order = wl.order ?? Infinity
      for (const key of [wl.uid, wl.name, wl.nameEn]) {
        if (key && !rank.has(key)) rank.set(key, order)
      }
    }
    return (a: string, b: string) => {
      const ra = rank.get(a) ?? Infinity
      const rb = rank.get(b) ?? Infinity
      return ra === rb ? a.localeCompare(b) : ra - rb
    }
  }, [workLocations])

  return { workLocations, compareWorkLocation }
}
