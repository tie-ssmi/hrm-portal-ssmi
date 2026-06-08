'use client'

import { Fragment, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAllTodayLeaves } from '@/lib/use-leave-queries'
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Search, Users, Building2 } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import type { LeaveRequest } from '@/lib/types'
import { translateJobTitle } from '@/components/translater'

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

function getLeaveTypeLabel(record: LeaveRequest): string {
  return record.policyName ?? record.type ?? 'ລາພັກ'
}

function sortDeptGroups(
  entries: [string, LeaveRequest[]][],
): [string, LeaveRequest[]][] {
  return [...entries].sort(([a], [b]) => {
    if (a === 'C Level') return -1
    if (b === 'C Level') return 1
    return a.localeCompare(b)
  })
}

// ── page ───────────────────────────────────────────────────────────────────

export default function LeaveTodayPage() {
  const { user } = useAuth()
  const { data: allRecords = [], isLoading } = useAllTodayLeaves()

  const myWorkLocationUid =
    typeof user?.workLocation === 'object' && user.workLocation !== null
      ? (
          (user.workLocation as { uuid?: string; uid?: string }).uuid ??
          (user.workLocation as { uid?: string }).uid
        )
      : undefined

  const userWorkLocation = getUserWorkLocationName(user?.workLocation)

  const [workLocationFilter, setWorkLocationFilter] = useState<string>(
    userWorkLocation ? '__user__' : '__all__'
  )
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const myLocOnly = workLocationFilter === '__user__'

    return allRecords
      .filter(r => !myLocOnly || r.workLocationUid === myWorkLocationUid)
      .filter(r => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return (r.leaveUserName ?? '').toLowerCase().includes(q)
      })
  }, [allRecords, workLocationFilter, myWorkLocationUid, search])

  const grouped = useMemo(() => {
    const map = new Map<string, LeaveRequest[]>()
    filtered.forEach(r => {
      const dept = r.departmentNameLo || r.departmentNameEn || 'ບໍ່ລະບຸ'
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">ການລາພັກວັນນີ້</h1>
        <p className="text-muted-foreground text-sm">ລາຍຊື່ພະນັກງານທີ່ລາພັກວັນນີ້</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">ທັງໝົດ</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{filtered.length}</p>
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
          <CardTitle className="text-base">ລາຍຊື່ ({filtered.length})</CardTitle>
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
              {/* Mobile cards — grouped by department */}
              <div className="space-y-4 p-3 md:hidden">
                {grouped.map(([dept, records]) => (
                  <div key={dept}>
                    <div className="mb-2 flex items-center gap-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {dept}
                      </p>
                      <span className="text-xs text-muted-foreground">({records.length})</span>
                    </div>
                    <div className="space-y-2">
                      {records.map(record => (
                        <div
                          key={record.id}
                          className="flex items-center gap-3 rounded-lg border bg-background p-3"
                        >
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {(record.leaveUserName || '?')[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {record.leaveUserName || '-'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {translateJobTitle(record.jobTitle ?? '') || '-'}
                            </p>
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <span>{record.startDate}</span>
                              <span>–</span>
                              <span>{record.endDate}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge variant="secondary" className="text-[10px]">
                              {getLeaveTypeLabel(record)}
                            </Badge>
                            <span className="text-xs font-bold text-primary">
                              {record.duration ?? '-'} ມື້
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table — grouped by department */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-muted/40">
                      <TableHead className="w-12 px-4">#</TableHead>
                      <TableHead className="px-4 min-w-[200px]">ຊື່ / ຕຳແໜ່ງ</TableHead>
                      <TableHead className="px-4 min-w-[140px]">ພາກແນກ</TableHead>
                      <TableHead className="px-4 w-32">ປະເພດລາ</TableHead>
                      <TableHead className="px-4 w-48">ວັນທີ</TableHead>
                      <TableHead className="px-4 w-20 text-center">ຈຳນວນ</TableHead>
                      <TableHead className="px-4 w-40">ຜູ້ຮັບວຽກຕໍ່</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {numberedRows.map(({ dept, records }) => (
                      <Fragment key={dept}>
                        <TableRow className="hover:bg-transparent bg-muted/20">
                          <TableCell colSpan={7} className="px-4 py-2">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              {dept}
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({records.length})
                            </span>
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
                                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                    {(record.leaveUserName || '?')[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {record.leaveUserName || '-'}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {translateJobTitle(record.jobTitle ?? '') || '-'}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-3 text-sm text-foreground">
                              {record.departmentNameLo || record.departmentNameEn || '-'}
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <Badge variant="secondary" className="text-xs">
                                {getLeaveTypeLabel(record)}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-4 py-3 text-sm tabular-nums text-foreground">
                              {record.startDate} – {record.endDate}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-sm font-bold text-primary tabular-nums text-center">
                              {record.duration ?? '-'} ມື້
                            </TableCell>
                            <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                              {record.successorNameLo || record.successorNameEn || '-'}
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
