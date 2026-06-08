'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAllTodayOffsite } from '@/lib/use-work-outside-queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Search, Users, Building2, MapPin, Calendar } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import type { Department, OffsiteRequestDoc } from '@/types/workOutside'

// ── helpers ────────────────────────────────────────────────────────────────

function getUserWorkLocationName(workLocation: unknown): string {
  if (!workLocation) return ''
  if (typeof workLocation === 'string') return workLocation
  if (typeof workLocation === 'object') {
    const wl = workLocation as Record<string, unknown>
    const name = wl.name ?? wl.nameLo
    return typeof name === 'string' ? name : ''
  }
  return ''
}

function sortDeptGroups<T>(entries: [string, T[]][]): [string, T[]][] {
  return [...entries].sort(([a], [b]) => {
    if (a === 'C Level') return -1
    if (b === 'C Level') return 1
    return a.localeCompare(b)
  })
}

// participantCount may be 0 on old records saved before the field existed;
// fall back to teammates array length + 1 (the requester themselves)
function tripPersonCount(record: OffsiteRequestDoc): number {
  return record.participantCount || (record.teammate?.length ?? 0) + 1
}

// One row per teammate, each carrying its trip's details
type TripPersonRow = {
  uid: string
  fullNameLo: string
  fullNameEn: string
  jobTitle: string
  department: Department
  photoUrl?: string
  roleInTrip: string
  record: OffsiteRequestDoc
}

function tripMembers(record: OffsiteRequestDoc): TripPersonRow[] {
  return (record.teammate ?? []).map(m => ({
    uid: m.uid,
    fullNameLo: m.fullNameLo,
    fullNameEn: m.fullNameEn,
    jobTitle: m.jobTitle,
    department: m.department,
    photoUrl: m.photoUrl,
    roleInTrip: m.roleInTrip,
    record,
  }))
}

// ── page ───────────────────────────────────────────────────────────────────

export default function OffsiteTodayPage() {
  const { user } = useAuth()
  const { data: allRecords = [], isLoading } = useAllTodayOffsite()

  const userWorkLocation = getUserWorkLocationName(user?.workLocation)

  const [workLocationFilter, setWorkLocationFilter] = useState<string>(
    userWorkLocation ? '__user__' : '__all__'
  )
  const [search, setSearch] = useState('')

  const workLocations = useMemo(() => {
    const set = new Set<string>()
    allRecords.forEach(r => {
      const name = r.requester?.workLocation?.nameLo
      if (name) set.add(name)
    })
    return Array.from(set).sort()
  }, [allRecords])

  const filteredRecords = useMemo(() => {
    const activeLocation =
      workLocationFilter === '__user__' ? userWorkLocation
      : workLocationFilter === '__all__' ? ''
      : workLocationFilter

    return allRecords
      .filter(r => !activeLocation || r.requester?.workLocation?.nameLo === activeLocation)
      .filter(r => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        const subj = (r.subject || '').toLowerCase()
        const matchesPerson = (p?: { fullNameLo?: string; fullNameEn?: string }) =>
          (p?.fullNameLo || p?.fullNameEn || '').toLowerCase().includes(q)
        return subj.includes(q) || matchesPerson(r.requester) || (r.teammate ?? []).some(matchesPerson)
      })
  }, [allRecords, workLocationFilter, userWorkLocation, search])

  // One row per teammate — not one row per trip record
  const rows = useMemo(
    () => filteredRecords.flatMap(tripMembers),
    [filteredRecords],
  )

  const grouped = useMemo(() => {
    const map = new Map<string, TripPersonRow[]>()
    rows.forEach(row => {
      const dept = row.department?.department || 'ບໍ່ລະບຸ'
      if (!map.has(dept)) map.set(dept, [])
      map.get(dept)!.push(row)
    })
    return sortDeptGroups(Array.from(map.entries()))
  }, [rows])

  const numberedRows = useMemo(() => {
    let i = 0
    return grouped.map(([dept, deptRows]) => ({
      dept,
      rows: deptRows.map(row => ({ row, rowNum: ++i })),
    }))
  }, [grouped])

  // Show branch info when viewing all branches so user can distinguish records by branch
  const showBranchCol = workLocationFilter !== '__user__' || !userWorkLocation

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">ອອກວຽກນອກວັນນີ້</h1>
        <p className="text-muted-foreground text-sm">ລາຍຊື່ພະນັກງານທີ່ອອກວຽກນອກສະຖານທີ່ວັນນີ້</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">ພະນັກງານທັງໝົດ</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">ພາກແນກ</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{grouped.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ຄົ້ນຫາຊື່ / ຫົວຂໍ້..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
                <Select value={workLocationFilter} onValueChange={setWorkLocationFilter}>
          <SelectTrigger className="h-9 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {userWorkLocation && (
              <SelectItem value="__user__">{userWorkLocation}</SelectItem>
            )}
            <SelectItem value="__all__">ທຸກສາຂາ</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">ລາຍຊື່ ({rows.length} ຄົນ)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Spinner /> ກຳລັງໂຫຼດ...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              ບໍ່ມີຂໍ້ມູນ
            </div>
          ) : (
            <div className="space-y-4 p-3">
              {numberedRows.map(({ dept, rows: deptRows }) => (
                <div key={dept}>
                  <div className="mb-2 flex items-center gap-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {dept}
                    </p>
                    <span className="text-xs text-muted-foreground">({deptRows.length})</span>
                  </div>
                  <div className="space-y-2">
                    {deptRows.map(({ row, rowNum }) => (
                      <div
                        key={`${row.record.id}-${row.uid}`}
                        className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
                      >
                        <span className={`w-6 text-center text-sm font-bold shrink-0 ${rowNum === 1 ? 'text-yellow-500' : rowNum === 2 ? 'text-slate-400' : rowNum === 3 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          {rowNum}
                        </span>
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={row.photoUrl} alt={row.fullNameLo} className="object-cover" />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {row.fullNameLo?.charAt(0) ?? '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{row.fullNameLo ?? row.fullNameEn}</p>
                          <p className="text-xs text-muted-foreground truncate" title={row.record.subject}>{row.record.subject}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{row.record.location || '-'}</span>
                          </div>
                          {showBranchCol && (
                            <p className="text-xs text-muted-foreground truncate">{row.record.requester?.workLocation?.nameLo ?? '-'}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end shrink-0 gap-0.5">
                          <Badge variant="secondary" className="text-xs">{row.record.activityType?.name}</Badge>
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {row.record.startDate} – {row.record.endDate}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {tripPersonCount(row.record)} ຄົນ
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
