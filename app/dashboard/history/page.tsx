'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useHRM } from '@/lib/hrm-context'
import { useUserLeaves } from '@/lib/use-leave-queries'
import { useQuery } from '@tanstack/react-query'
import { fetchAttendanceByUser } from '@/services/attendance'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ActivityCode, OffsiteRequestDoc } from '@/types/workOutside'
import { activityLabel, formatKip, formatKipText } from '@/lib/format'
import { ActivityTypeBadge } from '@/components/offsite/ActivityTypeBadge'
import HistorySkeleton from '@/components/skeletons/historySkeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Clock,
  Calendar,
  Palmtree,
  MapPin,
  DollarSign,
  CheckCircle,
  XCircle,
  LogIn,
  LogOut,
} from 'lucide-react'
import { formatDayDateLao, formatMonthDateLao, formatDatedayLao, formatDateLao, formatDateMonthLao, formatMonthYearLao } from '@/components/laoDate'

// Safely convert any Firestore value (string, Timestamp, undefined) to a Date.
// Returns null instead of Invalid Date so callers can show a fallback.
function toSafeDate(value: unknown): Date | null {
  if (value == null) return null
  // Firestore Timestamp object: has .toDate() method
  if (typeof value === 'object' && 'toDate' in (value as object) && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }
  const d = new Date(value as string | number)
  return isNaN(d.getTime()) ? null : d
}

export default function HistoryPage() {
  const { user, isLoading } = useAuth()
  useHRM()
  const userUid = user?.uid || user?.id || ''

  const { data: leaveRequests = [] } = useUserLeaves(user?.uuid)

  const { data: allAttendance = [] } = useQuery({
    queryKey: ['attendance', 'all', user?.uuid ?? null],
    queryFn: () => fetchAttendanceByUser(user!.uuid!),
    enabled: !!user?.uuid,
  })

  const { data: myOffsiteRequests = [] } = useQuery<OffsiteRequestDoc[]>({
    queryKey: ['workOutside', 'participant', userUid],
    queryFn: async () => {
      // participantIds has two formats in Firestore:
      //   old: string[]  → array-contains with uid string works
      //   new: { uid }[] → array-contains with a string cannot partial-match objects
      // So we run two queries and merge: one for string format, one by createdByUid
      const [byParticipant, byCreator] = await Promise.all([
        getDocs(query(collection(db, 'workOutside'), where('participantIds', 'array-contains', userUid))),
        getDocs(query(collection(db, 'workOutside'), where('createdByUid', '==', userUid))),
      ])
      const seen = new Set<string>()
      return [...byParticipant.docs, ...byCreator.docs]
        .filter(d => {
          if (seen.has(d.id)) return false
          seen.add(d.id)
          return true
        })
        .map(d => ({ id: d.id, ...d.data() } as OffsiteRequestDoc))
        // also keep docs where user appears as a teammate in new object-format participantIds
        .filter(r => {
          const ids = r.participantIds ?? []
          return ids.some((p: unknown) => typeof p === 'string' ? p === userUid : (p as { uid: string }).uid === userUid)
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    enabled: !!userUid,
  })

  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const value = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
      options.push({ value, label: formatMonthYearLao(d) })
    }
    return options
  }, [])

  // Leave tab: 12 months past + 2 months future
  const leaveMonthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = []
    const now = new Date()
    for (let i = -2; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const value = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
      options.push({ value, label: formatMonthYearLao(d) })
    }
    return options
  }, [])

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`
  })

  const [selectedLeaveMonth, setSelectedLeaveMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`
  })

  const [selectedOffsiteMonth, setSelectedOffsiteMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`
  })

  const [selectedActivityType, setSelectedActivityType] = useState<ActivityCode | 'all'>('all')

  const ACTIVITY_CODES: ActivityCode[] = ['MEET_CLIENT', 'MEETING', 'BOOTH', 'PROMO', 'TRAINING']

  const filteredOffsiteRequests = useMemo(() =>
    myOffsiteRequests.filter(r => {
      const matchMonth = r.startDate.startsWith(selectedOffsiteMonth) || r.endDate.startsWith(selectedOffsiteMonth)
      const matchType = selectedActivityType === 'all' || r.activityType.code === selectedActivityType
      return matchMonth && matchType
    }),
    [myOffsiteRequests, selectedOffsiteMonth, selectedActivityType],
  )

  const monthlyFineSummaries = useMemo(() => {
    const now = new Date()
    // Bug #2: use local date to match r.date format (YYYY-MM-DD), not UTC from toISOString()
    const todayStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`
    const isAfter10 = now.getHours() > 10 || (now.getHours() === 10 && now.getMinutes() >= 1)

    // Bug #1: unified helper — both status names mean the same thing
    const isAbsent = (s: string) => s === 'not_check_in' || s === 'not_checked_in'
    // Bug #4: Firestore may store "null" as a string instead of null
    const isNullish = (v: unknown) => v == null || v === 'null' || v === ''

    const byMonth = new Map<string, typeof allAttendance>()
    for (const r of allAttendance) {
      const month = r.date.slice(0, 7)
      if (!byMonth.has(month)) byMonth.set(month, [])
      byMonth.get(month)!.push(r)
    }

    return Array.from(byMonth.entries())
      .map(([month, records]) => {
        // Bug #3: don't count today's late if result not yet confirmed
        const late = records.filter(r => {
          if (r.date === todayStr && !isAfter10) return false
          return r.status === 'late'
        }).length

        const notCheckInPts = records.reduce((sum, r) => {
          if (r.date === todayStr) {
            if (!isAfter10) return sum
            return sum + (isAbsent(r.status) ? 1 : 0)
          }
          if (isAbsent(r.status) && isNullish(r.checkOutTime)) return sum + 2
          if (isAbsent(r.status) && !isNullish(r.checkOutTime)) return sum + 1
          if (r.status !== 'leave' && isNullish(r.checkOutTime)) return sum + 1
          return sum
        }, 0)
        const fines = notCheckInPts * 10000 + (late > 4 ? (late - 4) * 10000 : 0)
        const [y, m] = month.split('-').map(Number)
        return { month, label: formatMonthYearLao(new Date(y, m - 1, 1)), late, notCheckInPts, fines }
      })
      .sort((a, b) => b.month.localeCompare(a.month))
  }, [allAttendance])

  const computedTotalFines = useMemo(
    () => monthlyFineSummaries.reduce((sum, m) => sum + m.fines, 0),
    [monthlyFineSummaries],
  )

  const filteredAttendance = useMemo(() => {
    return allAttendance.filter(r => r.date.startsWith(selectedMonth))
  }, [allAttendance, selectedMonth])

  // All weekdays (Mon–Fri) in the selected month, merged with actual records
  const allWeekdays = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number)
    const now = new Date()
    const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1
    const lastDay = isCurrentMonth ? now.getDate() : new Date(y, m, 0).getDate()

    const days: { date: string; record: (typeof filteredAttendance)[0] | null }[] = []
    for (let day = 1; day <= lastDay; day++) {
      const dow = new Date(y, m - 1, day).getDay()
      if (dow === 0 || dow === 6) continue
      const dateStr = `${y}-${m.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
      days.push({ date: dateStr, record: filteredAttendance.find(r => r.date === dateStr) ?? null })
    }
    return days.reverse()
  }, [selectedMonth, filteredAttendance])

  const monthLateCount = useMemo(
    () => filteredAttendance.filter(r => r.status === 'late').length,
    [filteredAttendance],
  )

  const filteredLeaveRequests = useMemo(() => {
    return leaveRequests
      .filter(r => {
        const start = typeof r.startDate === 'string' ? r.startDate : ''
        const end   = typeof r.endDate   === 'string' ? r.endDate   : ''
        return start.startsWith(selectedLeaveMonth) || end.startsWith(selectedLeaveMonth)
      })
      .sort((a, b) => {
        // createdAt may be a Firestore Timestamp — convert to ms for safe comparison
        const aMs = toSafeDate(a.createdAt)?.getTime() ?? 0
        const bMs = toSafeDate(b.createdAt)?.getTime() ?? 0
        return bMs - aMs
      })
  }, [leaveRequests, selectedLeaveMonth])

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'approved':
      case 'present':
        return 'default' as const
      case 'rejected':
      case 'absent':
      case 'not_check_in':
       
      case 'not_checked_in':
        return 'destructive' as const
      case 'late':
        return 'secondary' as const
      default:
        return 'outline' as const
    }
  }

  const getStatusLabel = (
    status: string,
    checkIn: string | null | undefined,
    checkOut: string | null | undefined,
  ) => {
    const forgotOut = !checkOut ? ' (ລືມກົດອອກ)' : ''

    switch (status) {
      case 'present':      return 'ມາທັນ' + forgotOut
      case 'late':         return 'ມາຊ້າ' + forgotOut
      case 'absent':       return 'ຂາດ'
      case 'not_checked_in':
      case 'not_check_in':
        if (!checkIn) return 'ຂາດ'
        return 'ລືມກົດເຂົ້າ' + forgotOut
      case 'leave':        return 'ລາພັກ'
      case 'offsite':      return 'ອອກວຽກນອກ' + forgotOut
      default:             return status
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-3 h-3" />
      case 'rejected': return <XCircle className="w-3 h-3" />
      default:         return <Clock className="w-3 h-3" />
    }
  }

  if (isLoading) {
    return <HistorySkeleton />
  }

  const currentYear = new Date().getFullYear().toString()
  console.log('[offsite debug]', { userUid, count: myOffsiteRequests.length, requests: myOffsiteRequests.map(r => ({ id: r.id, status: r.status, startDate: r.startDate, durationDays: r.durationDays, participantIds: r.participantIds })) })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">ປະຫັດຕ່າງ</h1>
        <p className="text-muted-foreground">ເບິ່ງປະຫັດຕ່າງຂອງທ່ານ</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
         <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-chart-1/10">
                <Calendar className="w-5 h-5 text-chart-1" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ຈຳນວນມື້ມາການ</p>
                <p className="text-xl font-bold text-foreground">{allAttendance.filter(r => r.date.startsWith(currentYear) && r.status !== 'not_check_in' && r.status !== 'not_checked_in' && r.status !== 'leave').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-chart-3/10">
                <AlertTriangle className="w-5 h-5 text-chart-3" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ຈຳນວນມື້ມາຊ້າ</p>
                <p className="text-xl font-bold text-foreground">{monthLateCount}</p>
              </div>
            </div>
          </CardContent>
        </Card> */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-chart-2/10">
                <Palmtree className="w-5 h-5 text-chart-2" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ຈຳນວນມື້ທີລາພັກ</p>
                <p className="text-xl font-bold text-foreground">
                  {leaveRequests.filter(r => r.status === 'approved' && (typeof r.startDate === 'string' ? r.startDate : '').startsWith(currentYear)).reduce((sum, r) => sum + (r.duration ?? 0), 0)}
                  
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-chart-2/10">
                <MapPin className="w-5 h-5 text-chart-2" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ຈຳນວນມື້ອອກວຽກນອກ</p>
                <p className="text-xl font-bold text-foreground">
                  {myOffsiteRequests.filter(r => r.status === 'approved' && r.startDate?.startsWith(currentYear)).reduce((sum, r) => sum + (r.durationDays ?? 0), 0)}

                </p>
              </div>
            </div>
          </CardContent>
        </Card>
       

        

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-destructive/10">
                <DollarSign className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ຄ່າປັບທັງໝົດ</p>
                <p className="text-xl md:block hidden font-bold text-foreground">{formatKip(monthlyFineSummaries.filter(m => m.month.startsWith(currentYear)).reduce((sum, m) => sum + m.fines, 0))}</p>
                <p className="text-xl block md:hidden font-bold text-foreground">{formatKipText(monthlyFineSummaries.filter(m => m.month.startsWith(currentYear)).reduce((sum, m) => sum + m.fines, 0))}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        
      </div>

      <Tabs defaultValue="attendance" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="attendance" className="text-xs sm:text-sm">
            <Clock className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">check in/out</span>
          </TabsTrigger>
          <TabsTrigger value="leave" className="text-xs sm:text-sm">
            <Palmtree className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">ລາພັກ</span>
          </TabsTrigger>
          <TabsTrigger value="offsite" className="text-xs sm:text-sm">
            <MapPin className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">ອອກວຽກນອກ</span>
          </TabsTrigger>
          <TabsTrigger value="fines" className="text-xs sm:text-sm">
            <DollarSign className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">ຄ່າປັບ</span>
          </TabsTrigger>
        </TabsList>
            {/* Checkin */}
        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">ປະຫວັດການເຂົ້າ-ອອກ</CardTitle>
                  <CardDescription>ລາຍລະອຽດການເຂົ້າ-ອອກ</CardDescription>
                </div>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                {allWeekdays.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No records for this month
                  </p>
                ) : (
                  <div className="space-y-3">
                    {allWeekdays.map(({ date, record }) => (
                      <div
                        key={date}
                        className="p-3 sm:p-4 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="md:block hidden text-sm font-medium truncate">
                                {formatDayDateLao(new Date(date))}
                              </p>
                              <p className="text-sm md:hidden font-medium truncate">
                                {formatDateLao(new Date(date))}
                              </p>
                            </div>
                          </div>
                          {record ? (
                            <Badge variant={getStatusVariant(record.status)} className="flex-shrink-0">
                              {getStatusLabel(record.status, record?.checkIn, record?.checkOut)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground flex-shrink-0">
                              ບໍ່ມີຂໍ້ມູນ
                            </Badge>
                          )}
                        </div>
                        <div className="flex sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-muted-foreground pl-6">
                          <span className="flex items-center gap-1">
                            <LogIn className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{record?.checkIn || '--:--'}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <LogOut className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{record?.checkOut || '--:--'}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
{/* Leave */}
        <TabsContent value="leave" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">ປະຫວັດການຂໍລາ</CardTitle>
                  <CardDescription>ລາຍລະອຽດການຂໍລາ</CardDescription>
                </div>
                <Select value={selectedLeaveMonth} onValueChange={setSelectedLeaveMonth}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveMonthOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                {filteredLeaveRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No leave requests for this month
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredLeaveRequests.map((request) => {
                      const startD = toSafeDate(request.startDate)
                      const endD   = toSafeDate(request.endDate)
                      const createdD = toSafeDate(request.createdAt)
                      return (
                      <div key={request.id} className="p-4 rounded-lg bg-muted/50">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium">
                              {request.policyName || request.type}
                            </p>
                            <p className="text-xs md:block hidden text-muted-foreground mt-1">
                              {startD ? formatMonthDateLao(startD) : '—'} -{' '}
                              {endD   ? formatDatedayLao(endD)      : '—'}
                            </p>
                            <p className="text-xs md:hidden text-muted-foreground mt-1">
                              {startD ? formatDateMonthLao(startD) : '—'} -{' '}
                              {endD   ? formatDateLao(endD)         : '—'}
                            </p>
                          </div>
                          <Badge variant={getStatusVariant(request.status)} className="flex items-center gap-1">
                            {getStatusIcon(request.status)}
                            {request.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{request.reason}</p>
                        <div className="flex md:block hidden items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span>ມື້ສົ່ງຄຳຮອງ : {createdD ? formatDayDateLao(createdD) : '—'}</span>
                          {request.reviewedBy && <span>Reviewed by: {request.reviewedBy}</span>}
                        </div>
                        <div className="flex md:hidden items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span>ມື້ສົ່ງຄຳຮອງ : {createdD ? formatDateLao(createdD) : '—'}</span>
                          {request.reviewedBy && <span>Reviewed by: {request.reviewedBy}</span>}
                        </div>
                      </div>
                    )
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offsite" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">ປະຫວັດອອກວຽກນອກ</CardTitle>
                  <CardDescription>ລາຍລະອຽດການອອກວຽກນອກ</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={selectedActivityType} onValueChange={(v) => setSelectedActivityType(v as ActivityCode | 'all')}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="ທຸກກິດຈະກຳ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ທຸກກິດຈະກຳ</SelectItem>
                      {ACTIVITY_CODES.map(code => (
                        <SelectItem key={code} value={code}>{activityLabel(code)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedOffsiteMonth} onValueChange={setSelectedOffsiteMonth}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveMonthOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                {filteredOffsiteRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    ບໍ່ມີລາຍການອອກວຽກນອກ
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredOffsiteRequests.map((request) => {
                      const isRequester = request.createdByUid === userUid
                      return (
                        <div key={request.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
                          {/* Row 1: type + role badge + status */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <ActivityTypeBadge code={request.activityType.code} />
                              <span className="text-[10px] rounded-full px-2 py-0.5 bg-background border text-muted-foreground shrink-0">
                                {isRequester ? 'ຜູ້ຍື່ນຄຳຂໍ' : 'ສະມາຊິກທີມ'}
                              </span>
                            </div>
                            <Badge variant={getStatusVariant(request.status)} className="flex items-center gap-1 shrink-0 text-xs">
                              {getStatusIcon(request.status)}
                              {request.status}
                            </Badge>
                          </div>
                          {/* Row 2: subject */}
                          <p className="text-sm font-medium leading-snug">{request.subject}</p>
                          {/* Row 3: location + date */}
                          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {request.location}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 shrink-0" />
                              {formatDateLao(new Date(request.startDate))} – {formatDateLao(new Date(request.endDate))}
                              {request.durationDays ? ` (${request.durationDays} ມື້)` : ''}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fines" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Late Arrivals & Fines</CardTitle>
              <CardDescription>Record of late check-ins and associated penalties</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                {monthlyFineSummaries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    ບໍ່ມີຂໍ້ມູນ
                  </p>
                ) : (
                  <>
                    <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-destructive">ຄ່າປັບທັງໝົດ</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {monthlyFineSummaries.filter(m => m.fines > 0).length} ເດືອນທີ່ມີຄ່າປັບ
                          </p>
                        </div>
                        <p className="text-xl font-bold text-destructive">{formatKip(computedTotalFines)}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {monthlyFineSummaries.map(({ month, label, late, notCheckInPts, fines }) => (
                        <div key={month} className="p-4 rounded-lg bg-muted/50">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">{label}</p>
                              <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                <p>
                                  ມາຊ້າ: {late} ຄັ້ງ
                                  {late > 4
                                    ? <span className="text-destructive ml-1">(ເກີນ {late - 4} ຄັ້ງ)</span>
                                    : <span className="ml-1">(ຟຣີ {late}/4)</span>}
                                </p>
                                <p>ຂາດ/ລືມ: {notCheckInPts} ຄັ້ງ</p>
                              </div>
                            </div>
                            <p className={`text-base font-bold shrink-0 ${fines > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {fines > 0 ? `-${formatKip(fines)}` : '—'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
