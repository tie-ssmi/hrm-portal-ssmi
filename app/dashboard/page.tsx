'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useHRM } from '@/lib/hrm-context'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import HomeSkeleton from '@/components/skeletons/homeSkeleton'
import { fetchPoliciesForGender } from '@/services/policies'
import { fetchTodayLeavesByWorkLocation } from '@/services/leaves'
import type { LeaveData } from '@/types/employee'
import {
  Calendar,
  Clock,
  AlertTriangle,
  DollarSign,
  Briefcase,
  HeartPulse,
  MapPinX,
  ChevronDown,
} from 'lucide-react'
import { format } from 'date-fns'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { CheckInToday, ToDay } from '@/components/leaveLists'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import type { PolicyRecord } from '@/lib/types'

const LAO_DAYS   = ['ວັນອາທິດ','ວັນຈັນ','ວັນອັງຄານ','ວັນພຸດ','ວັນພະຫັດ','ວັນສຸກ','ວັນເສົາ']
const LAO_MONTHS = ['ມັງກອນ','ກຸມພາ','ມີນາ','ເມສາ','ພຶດສະພາ','ມິຖຸນາ','ກໍລະກົດ','ສິງຫາ','ກັນຍາ','ຕຸລາ','ພະຈິກ','ທັນວາ']
function formatDateLao(date: Date): string {
  return `${LAO_DAYS[date.getDay()]}, ${date.getDate()} ${LAO_MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

const VISIBLE_COUNT = 3

function PolicyRow({ policy, used }: { policy: PolicyRecord; used: number }) {
  const total = policy.days ?? 0
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-chart-2" />
          {policy.name || policy.requestType}
        </span>
        <span className="text-muted-foreground">{used} / {total} ວັນ</span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  )
}

function PolicyList({
  policies,
  usedByPolicy,
}: {
  policies: PolicyRecord[]
  usedByPolicy: Map<string, number>
}) {
  const [open, setOpen] = useState(false)
  const visible = policies.slice(0, VISIBLE_COUNT)
  const hidden  = policies.slice(VISIBLE_COUNT)
  const hasMore = hidden.length > 0

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-4">
      {visible.map(policy => (
        <PolicyRow
          key={policy.uuid ?? policy.id}
          policy={policy}
          used={usedByPolicy.get(policy.uuid ?? '') ?? usedByPolicy.get(policy.id) ?? 0}
        />
      ))}

      {hasMore && (
        <>
          <CollapsibleContent className="space-y-4">
            {hidden.map(policy => (
              <PolicyRow
                key={policy.uuid ?? policy.id}
                policy={policy}
                used={usedByPolicy.get(policy.uuid ?? '') ?? usedByPolicy.get(policy.id) ?? 0}
              />
            ))}
          </CollapsibleContent>

          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full gap-1 text-xs text-muted-foreground">
              <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
              {open ? 'ຫຍໍ້ລົງ' : `ເບິ່ງທັງໝົດ (${hidden.length} ລາຍການ)`}
            </Button>
          </CollapsibleTrigger>
        </>
      )}
    </Collapsible>
  )
}

export default function DashboardPage() {
  const { user, isLoading } = useAuth()
  const { leaveBalance, lateRecords, totalFines, leaveRequests, todayAttendance } = useHRM()
  const router = useRouter()
  console.log('gender:', user?.gender)

  const { data: policies = [] } = useQuery({
    queryKey: ['policies', 'gender', user?.gender ?? null],
    queryFn: () => fetchPoliciesForGender(user?.gender),
    enabled: !!user,
  })

  // used days per policy UUID or ID (approved leaves only)
  const usedByPolicy = useMemo(() => {
    const map = new Map<string, number>()
    leaveRequests.forEach(req => {
      if (req.status !== 'approved') return
      const key = req.policyUuid || req.policyId
      if (!key) return
      map.set(key, (map.get(key) ?? 0) + (req.duration ?? 1))
    })
    return map
  }, [leaveRequests])

  const { data: todayLeaveRequests = [] } = useQuery({
    queryKey: ['leaves', 'today', user?.workLocation?.uuid],
    queryFn: () => fetchTodayLeavesByWorkLocation(user!.workLocation.uuid),
    enabled: !!user?.workLocation?.uuid,
  })

  if (isLoading) {
    return <HomeSkeleton />
  }

  // Keep stat cards working: derive totals from the matching policy types
  const annualPolicy = policies.find(p => p.requestType === 'annual')
  const sickPolicy   = policies.find(p => p.requestType === 'sick')

  const effectiveLeaveBalance = {
    ...leaveBalance,
    annual:   annualPolicy?.days ?? leaveBalance.annual,
    sick:     sickPolicy?.days   ?? leaveBalance.sick,
    personal: leaveBalance.personal,
  }

  const sickRemaining = effectiveLeaveBalance.sick - leaveBalance.sickUsed

  const recentLeaves = leaveRequests.slice(0, 3)

  const leaveDataToday: LeaveData[] = todayLeaveRequests.map(r => ({
    name: r.leaveUserName ?? '',
    department: r.departmentNameLo ?? r.departmentNameEn ?? '',
    successor: r.successorNameLo ?? r.successorNameEn ?? '',
    startDate: r.startDate,
    endDate: r.endDate,
    reason: r.reason,
    position: r.jobTitle ?? '',
    note: r.doc ?? '',
    type: { id: r.policyId ?? '', name: r.policyName ?? r.type },
  }))


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">
          ຍີນດີຕ້ອນຮັບ, {user?.firstNameLo}
        </h1>
        <p className="text-muted-foreground">
          {formatDateLao(new Date())}
        </p>
      </div>

      {/* Today's Status */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Today&apos;s Status</p>
                <p className="text-lg font-semibold text-foreground">
                  {todayAttendance?.checkIn
                    ? `ກົດເຊັກ-ອິນ ຕອນ ${todayAttendance.checkIn}`
                    : 'ຍັງບໍ່ໄດ້ເຊັກ-ອິນ'
                  }
                </p>
              </div>
            </div>
            <Badge variant={todayAttendance?.checkIn ? 'default' : 'secondary'} 
            onClick={() => router.push('/dashboard/attendance')}>
              {todayAttendance?.checkOut
                ? 'ກັບບ້ານແລ້ວ'
                : todayAttendance?.checkIn
                  ? 'ເຂົ້າເຮັດວຽກແລ້ວ'
                  : 'ຍັງບໍ່ໄດ້ເຊັກ-ອິນ'
              }
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Late Balance */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-chart-3/10">
                <AlertTriangle className="w-5 h-5 text-chart-3" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ມາຊ້າ</p>
                <p className="text-xl font-bold text-foreground">{lateRecords.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Fines */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-destructive/10">
                <DollarSign className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ຄ່າປັນ</p>
                <p className="text-xl font-bold text-foreground">${totalFines}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Annual Leave */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-chart-2/10">
                <MapPinX  className="w-5 h-5 text-chart-2" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ລືມກົດເຂົ້າວຽກ</p>
                <p className="text-xl font-bold text-foreground">3</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sick Leave */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-chart-1/10">
                <HeartPulse className="w-5 h-5 text-chart-1" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sick Leave</p>
                <p className="text-xl font-bold text-foreground">{sickRemaining}/{effectiveLeaveBalance.sick}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leave Balance Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            ປະເພດມື້ພັກ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {policies.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">ບໍ່ມີຂໍ້ມູນນະໂຍບາຍ</p>
          ) : (
            <PolicyList policies={policies} usedByPolicy={usedByPolicy} />
          )}
        </CardContent>
      </Card>

      {/* leave      */}

      <Tabs defaultValue="checkIn" className="w-full ">
        <TabsList>
          <TabsTrigger value="checkIn">ເຂົ້າວຽກ</TabsTrigger>
          <TabsTrigger value="leave">ລາພັກ</TabsTrigger>
          <TabsTrigger value="off_site">ອອກວຽກນອກ</TabsTrigger>
          <TabsTrigger value="topLeave">ມາຊ້າ (Top)</TabsTrigger>
        </TabsList>
        <TabsContent value="checkIn">
         
            <Card>

            <div  >

              <CardContent className="text-muted-foreground text-sm h-auto max-h-[500px] overflow-auto">
                <div className="flex items-center justify-between mb-4">
                                 <p className="mb-2 font-semibold text-lg">ລາຍການມາວຽກມື້ນີ້ </p>
                <Button variant="link" onClick={() => {
                  const today = new Date();
                  const formattedToday = today.toISOString().split('T')[0];
                  const url = `/dashboard/check-in?date=${formattedToday}`;
                  router.push(url);
                }}>
                  ທັງໝົດ
                </Button>
                </div>
                <CheckInToday />
              </CardContent>

            </div>
          </Card>
        </TabsContent>
        <TabsContent value="leave">
          <Card >

            <div  >

              <CardContent className="text-muted-foreground text-sm h-auto max-h-[500px] overflow-auto">
                <p className="mb-2 font-semibold text-lg">ລາຍການລາພັກມື້ນີ້ </p>
                <ToDay data={leaveDataToday} />
              </CardContent>

            </div>
          </Card>
        </TabsContent>
        <TabsContent value="off_site">
          <Card>
            <CardHeader>
              <CardTitle>Reports</CardTitle>
              <CardDescription>
                Generate and download your detailed reports. Export data in
                multiple formats for analysis.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              You have 5 reports ready and available to export.
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="topLeave">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
              <CardDescription>
                Manage your account preferences and options. Customize your
                experience to fit your needs.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Configure notifications, security, and themes.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>



      {/* Recent Leaves */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Recent Leave Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentLeaves.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No leave requests yet
            </p>
          ) : (
            <div className="space-y-3">
              {recentLeaves.map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {leave.policyName || leave.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(leave.startDate), 'MMM d')} - {format(new Date(leave.endDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <Badge
                    variant={
                      leave.status === 'approved' ? 'default' :
                        leave.status === 'rejected' ? 'destructive' :
                          'secondary'
                    }
                  >
                    {leave.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card> */}
    </div>
  )
}
