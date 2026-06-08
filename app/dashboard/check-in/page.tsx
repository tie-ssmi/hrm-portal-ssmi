'use client'

import { Fragment, Suspense, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useTodayCheckInAttendance } from '@/lib/use-attendance-queries'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Search, Users, Clock, LogOut, MapPinOff } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import type { AttendanceRecord } from '@/lib/types'
import { translateJobTitle } from '@/components/translater'
import { useSearchParams } from 'next/navigation'

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

// FIX Bug 1: add 'not_checked_in' case + default to prevent undefined label
function getStatusLabel(record: AttendanceRecord): string {
  if (record.isOffsite) {
    return record.status === 'late' ? 'ອອກວຽກນອກ (ຊ້າ)' : 'ອອກວຽກນອກ'
  }
  switch (record.status) {
    case 'present':        return 'ມາວຽກ'
    case 'late':           return 'ມາວຽກ (ຊ້າ)'
    case 'absent':         return 'ຂາດ'
    case 'offsite':        return 'ອອກວຽກນອກ'
    case 'leave':          return 'ລາພັກ'
    case 'not_check_in':   return 'ບໍ່ໄດ້ກົດເຂົ້າ'
    case 'not_checked_in': return 'ບໍ່ໄດ້ກົດເຂົ້າ'
    default:               return record.status
  }
}

function getStatusVariant(record: AttendanceRecord): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (record.isOffsite) return 'outline'
  switch (record.status) {
    case 'present': return 'default'
    case 'late':    return 'secondary'
    default:        return 'destructive'
  }
}

function sortDeptGroups(entries: [string, AttendanceRecord[]][]): [string, AttendanceRecord[]][] {
  return [...entries].sort(([a], [b]) => {
    if (a === 'C Level') return -1
    if (b === 'C Level') return 1
    return a.localeCompare(b)
  })
}

// ── page ───────────────────────────────────────────────────────────────────

// useSearchParams() requires a Suspense boundary during static export prerendering —
// see https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
export default function CheckInPage() {
  return (
    <Suspense>
      <CheckInPageContent />
    </Suspense>
  )
}

function CheckInPageContent() {
  const { user } = useAuth()

  // FIX Bug 4: read ?date= param (YYYY-MM-DD) passed by dashboard "ທັງໝົດ" button
  const searchParams = useSearchParams()
  const dateParam = searchParams.get('date') ?? undefined

  const { data: allRecords = [], isLoading } = useTodayCheckInAttendance(dateParam)

  const userWorkLocation = getUserWorkLocationName(user?.workLocation)

  // FIX Bug 3: default to __all__ when user has no workLocation to avoid silent no-op filter
  const [workLocationFilter, setWorkLocationFilter] = useState<string>(
    userWorkLocation ? '__user__' : '__all__'
  )
  const [search, setSearch] = useState('')

  const workLocations = useMemo(() => {
    const set = new Set<string>()
    allRecords.forEach(r => { if (r.workLocation?.name) set.add(r.workLocation.name) })
    return Array.from(set).sort()
  }, [allRecords])

  const filtered = useMemo(() => {
    const activeLocation =
      workLocationFilter === '__user__' ? userWorkLocation
      : workLocationFilter === '__all__' ? ''
      : workLocationFilter

    return allRecords
      // FIX: also exclude 'not_checked_in' (old system status variant)
      .filter(r => r.status !== 'not_check_in' && r.status !== 'not_checked_in' && r.status !== 'leave')
      .filter(r => !activeLocation || r.workLocation?.name === activeLocation)
      .filter(r => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        const name = (r.fullNameLo || r.fullNameEn || '').toLowerCase()
        return name.includes(q)
      })
  }, [allRecords, workLocationFilter, userWorkLocation, search])

  const grouped = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>()
    filtered.forEach(r => {
      const dept = r.department?.name || 'ບໍ່ລະບຸ'
      if (!map.has(dept)) map.set(dept, [])
      map.get(dept)!.push(r)
    })
    return sortDeptGroups(Array.from(map.entries()))
  }, [filtered])

  const numberedRows = useMemo(() => {
    let i = 0
    return grouped.map(([dept, records]) => ({
      dept,
      records: records.map(record => ({ record, rowNum: ++i })),
    }))
  }, [grouped])

  const stats = useMemo(() => ({
    total:      filtered.length,
    present:    filtered.filter(r => r.status === 'present').length,
    late:       filtered.filter(r => r.status === 'late').length,
    checkedOut: filtered.filter(r => !!r.checkOut).length,
  }), [filtered])

  const pageTitle = dateParam ? `ການລົງເວລາ ${dateParam}` : 'ການລົງເວລາວັນນີ້'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{pageTitle}</h1>
        <p className="text-muted-foreground text-sm">ຂໍ້ມູນ check-in / check-out</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">ທັງໝົດ</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-500" />
              <p className="text-xs text-muted-foreground">ທັນເວລາ</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{stats.present}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <p className="text-xs text-muted-foreground">ສາຍ</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{stats.late}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <LogOut className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">ອອກແລ້ວ</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{stats.checkedOut}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ຄົ້ນຫາຊື່..."
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
            {/* FIX Bug 3: only show user's branch option when workLocation is known */}
            {userWorkLocation && (
              <SelectItem value="__user__">{userWorkLocation}</SelectItem>
            )}
            <SelectItem value="__all__">ທຸກສາຂາ</SelectItem>
            {workLocations
              .filter(wl => wl !== userWorkLocation)
              .map(wl => (
                <SelectItem key={wl} value={wl}>{wl}</SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grouped list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            ລາຍຊື່ ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Spinner /> ກຳລັງໂຫຼດ...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              ບໍ່ມີຂໍ້ມູນ
            </div>
          ) : (
            <>
              {/* Mobile cards — grouped */}
              <div className="space-y-4 p-3 md:hidden">
                {grouped.map(([dept, records]) => (
                  <div key={dept}>
                    <div className="mb-2 flex items-center gap-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{dept}</p>
                      <span className="text-xs text-muted-foreground">({records.length})</span>
                    </div>
                    <div className="space-y-2">
                      {records.map((record) => (
                        <div key={record.id} className="flex items-center gap-3 rounded-lg border bg-background p-3">
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarImage src={record.employeeImage} className={`object-cover ${record.checkOut ? 'grayscale' : ''}`} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {(record.fullNameLo || record.fullNameEn || '?')[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {record.fullNameLo || record.fullNameEn || '-'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {translateJobTitle(record.jobTitle ?? '') || '-'}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>{record.checkIn || '--:--'}</span>
                              <span>→</span>
                              <span>{record.checkOut || '--:--'}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge variant={getStatusVariant(record)} className="text-[10px] gap-1">
                              {record.isOffsite && <MapPinOff className="h-3 w-3" />}
                              {getStatusLabel(record)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table — grouped */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-muted/40">
                      <TableHead className="w-12 px-4">#</TableHead>
                      <TableHead className="px-4 min-w-[200px]">ຊື່ / ຕໍາແໜ່ງ</TableHead>
                      <TableHead className="px-4 min-w-[140px]">ພະແນກ</TableHead>
                      <TableHead className="px-4 w-24">ເຂົ້າ</TableHead>
                      <TableHead className="px-4 w-24">ອອກ</TableHead>
                      <TableHead className="px-4 w-32">ສະຖານະ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {numberedRows.map(({ dept, records }) => (
                      <Fragment key={dept}>
                        <TableRow className="hover:bg-transparent bg-muted/20">
                          <TableCell colSpan={6} className="px-4 py-2">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              {dept}
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">({records.length})</span>
                          </TableCell>
                        </TableRow>
                        {records.map(({ record, rowNum }) => (
                          <TableRow key={record.id} className="hover:bg-muted/30">
                            <TableCell className="px-4 py-3 text-sm font-semibold text-muted-foreground">
                              {rowNum}
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <Avatar className="h-8 w-8 shrink-0">
                                  <AvatarImage src={record.employeeImage} className={`object-cover ${record.checkOut ? 'grayscale' : ''}`} />
                                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                    {(record.fullNameLo || record.fullNameEn || '?')[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {record.fullNameLo || record.fullNameEn || '-'}
                                  </p>
                                  {/* FIX Bug 2: ?? '' consistent with mobile */}
                                  <p className="text-xs text-muted-foreground truncate">
                                    {translateJobTitle(record.jobTitle ?? '') || '-'}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-3 text-sm text-foreground">
                              {record.department?.name || '-'}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-sm tabular-nums text-foreground">
                              {record.checkIn || '--:--'}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-sm tabular-nums text-muted-foreground">
                              {record.checkOut || '--:--'}
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <Badge variant={getStatusVariant(record)} className="gap-1">
                                {record.isOffsite && <MapPinOff className="h-3 w-3" />}
                                {getStatusLabel(record)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
