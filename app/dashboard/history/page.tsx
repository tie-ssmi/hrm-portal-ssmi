'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useHRM } from '@/lib/hrm-context'
import { useQuery } from '@tanstack/react-query'
import { fetchAllLeavesByUserUuid } from '@/services/leaves'
import { fetchAttendanceByUser } from '@/services/attendance'
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
  AlertTriangle,
  DollarSign,
  CheckCircle,
  XCircle,
  LogIn,
  LogOut,
} from 'lucide-react'
import { format } from 'date-fns'
//formatDayDateLao
import { formatDayDateLao ,formatMonthDateLao, formatDatedayLao} from '@/components/laoDate'
export default function HistoryPage() {
  const { user, isLoading } = useAuth()
  const { offsiteRequests, lateRecords, totalFines } = useHRM()

  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['leaves', 'user', user?.uuid ?? null],
    queryFn: () => fetchAllLeavesByUserUuid(user!.uuid!),
    enabled: !!user?.uuid,
  })

  const { data: allAttendance = [] } = useQuery({
    queryKey: ['attendance', 'all', user?.uuid ?? null],
    queryFn: () => fetchAttendanceByUser(user!.uuid!),
    enabled: !!user?.uuid,
  })

  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const value = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
      options.push({ value, label: format(d, 'MMMM yyyy') })
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
      options.push({ value, label: format(d, 'MMMM yyyy') })
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
      .filter(r => r.startDate.startsWith(selectedLeaveMonth) || r.endDate.startsWith(selectedLeaveMonth))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [leaveRequests, selectedLeaveMonth])

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'approved':
      case 'present':
        return 'default' as const
      case 'rejected':
      case 'absent':
      case 'not_check_in':
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
                <p className="text-xl font-bold text-foreground">{allWeekdays.filter(d => d.record?.checkInTime != null).length}</p>
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
                  {leaveRequests.filter(r => r.status === 'approved').reduce((sum, r) => sum + (r.duration ?? 0), 0)} 
                  
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
                  {leaveRequests.filter(r => r.status === 'approved').reduce((sum, r) => sum + (r.duration ?? 0), 0)} 
                  
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
                <p className="text-xs text-muted-foreground">Total Fines</p>
                <p className="text-xl font-bold text-foreground">${totalFines}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        
      </div>

      <Tabs defaultValue="attendance" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="attendance" className="text-xs sm:text-sm">
            <Clock className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Attendance</span>
          </TabsTrigger>
          <TabsTrigger value="leave" className="text-xs sm:text-sm">
            <Palmtree className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Leave</span>
          </TabsTrigger>
          <TabsTrigger value="offsite" className="text-xs sm:text-sm">
            <MapPin className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Off-site</span>
          </TabsTrigger>
          <TabsTrigger value="fines" className="text-xs sm:text-sm">
            <DollarSign className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Fines</span>
          </TabsTrigger>
        </TabsList>

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
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-background">
                            <Calendar className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {formatDayDateLao(new Date(date))}
                            </p>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <LogIn className="w-3 h-3" />
                                {record?.checkIn || '--:--'}
                              </span>
                              <span className="flex items-center gap-1">
                                <LogOut className="w-3 h-3" />
                                {record?.checkOut || '--:--'}
                              </span>
                              {record?.workHours && (
                                <span>{record.workHours}h worked</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {record ? (
                          <Badge variant={getStatusVariant(record.status)}>
                            {getStatusLabel(record.status, record?.checkIn, record?.checkOut)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            ບໍ່ມີຂໍ້ມູນ
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

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
                    {filteredLeaveRequests.map((request) => (
                      <div key={request.id} className="p-4 rounded-lg bg-muted/50">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium">
                              {request.policyName || request.type}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatMonthDateLao(new Date(request.startDate),)} -{' '}
                              {formatDatedayLao(new Date(request.endDate),)}
                            </p>
                          </div>
                          <Badge variant={getStatusVariant(request.status)} className="flex items-center gap-1">
                            {getStatusIcon(request.status)}
                            {request.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{request.reason}</p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span>ມື້ສົ່ງຄຳຮອງ : {formatDayDateLao(new Date(request.createdAt))}</span>
                          {request.reviewedBy && <span>Reviewed by: {request.reviewedBy}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offsite" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Off-site Work History</CardTitle>
              <CardDescription>Your remote work requests</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                {offsiteRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No off-site requests yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {offsiteRequests.map((request) => (
                      <div key={request.id} className="p-4 rounded-lg bg-muted/50">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium">{request.location}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(request.date), 'EEEE, MMM d, yyyy')}
                            </p>
                          </div>
                          <Badge variant={getStatusVariant(request.status)} className="flex items-center gap-1">
                            {getStatusIcon(request.status)}
                            {request.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{request.reason}</p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span>Submitted: {format(new Date(request.createdAt), 'MMM d, yyyy')}</span>
                          {request.reviewedBy && <span>Reviewed by: {request.reviewedBy}</span>}
                        </div>
                      </div>
                    ))}
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
                {lateRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No late records - Great job!
                  </p>
                ) : (
                  <>
                    <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-destructive">Total Fines</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {lateRecords.length} late arrivals
                          </p>
                        </div>
                        <p className="text-2xl font-bold text-destructive">${totalFines}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {lateRecords.map((record, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-chart-3/10">
                              <AlertTriangle className="w-5 h-5 text-chart-3" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {format(new Date(record.date), 'EEEE, MMM d, yyyy')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {record.minutes} minutes late
                              </p>
                            </div>
                          </div>
                          <Badge variant="destructive" className="text-sm">
                            -${record.fine}
                          </Badge>
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
