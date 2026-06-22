'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/auth-context'
import type { OffsiteRequestDoc } from '@/types/workOutside'

export interface OffsiteFilters {
  status: string
  activityCode: string
  monthKey: string
  search: string
}

export const OFFSITE_QUERY_KEY = 'my-offsite-requests'

export function useMyOffsiteRequests(filters: OffsiteFilters, enabled = true) {
  const { user } = useAuth()
  const uid = user?.uid ?? ''

  const { data: allDocs = [], isLoading, error, refetch } = useQuery<OffsiteRequestDoc[]>({
    queryKey: [OFFSITE_QUERY_KEY, uid],
    queryFn: async () => {
      if (!uid) return []
      const q = query(
        collection(db, 'workOutside'),
        where('participantIds', 'array-contains', uid),
      )
      const snap = await getDocs(q)
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OffsiteRequestDoc))
      return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    enabled: !!uid && enabled,
    staleTime: 1000 * 60 * 5,
  })

  const filtered = useMemo(() =>
    allDocs.filter((doc) => {
      if (filters.status && doc.status !== filters.status) return false
      if (filters.activityCode && doc.activityType.code !== filters.activityCode) return false
      if (filters.monthKey && doc.monthKey !== filters.monthKey) return false
      if (filters.search) {
        const q = filters.search.toLowerCase()
        const hit =
          doc.subject.toLowerCase().includes(q) ||
          doc.customerName.toLowerCase().includes(q) ||
          doc.requestNo.toLowerCase().includes(q)
        if (!hit) return false
      }
      return true
    }),
  [allDocs, filters.status, filters.activityCode, filters.monthKey, filters.search])

  const availableMonths = useMemo(() =>
    Array.from(new Set(allDocs.map((d) => d.monthKey))).sort((a, b) => {
      const [am, ay] = a.split('-').map(Number)
      const [bm, by] = b.split('-').map(Number)
      if (ay !== by) return by - ay
      return bm - am
    }),
  [allDocs])

  return { filtered, allDocs, isLoading, error: error as Error | null, refetch, availableMonths }
}
