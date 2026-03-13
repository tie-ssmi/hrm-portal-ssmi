'use client'

import { useAuth } from '@/lib/auth-context'
import { useHRM } from '@/lib/hrm-context'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import HomeSkeleton from '@/components/skeletons/homeSkeleton'
import { fetchPolicyByUuid } from '@/services/policies'
import { 
  Calendar, 
  Clock, 
  AlertTriangle, 
  DollarSign,
  Palmtree,
  Briefcase,
  HeartPulse,
  User
} from 'lucide-react'
import { format } from 'date-fns'

export default function DashboardPage() {
  const { user, isLoading } = useAuth()
  const { leaveBalance, lateRecords, totalFines, leaveRequests, todayAttendance } = useHRM()

  const { data: policyData } = useQuery({
    queryKey: ['policy', 'POL-001'],
    queryFn: () => fetchPolicyByUuid('POL-001'),
  })

  if (isLoading) {
    return <HomeSkeleton />
  }

  const effectiveLeaveBalance = {
    ...leaveBalance,
    annual: policyData?.leavePolicy.annual ?? leaveBalance.annual,
    sick: policyData?.leavePolicy.sick ?? leaveBalance.sick,
    personal: policyData?.leavePolicy.personal ?? leaveBalance.personal,
  }

  const annualRemaining = effectiveLeaveBalance.annual - leaveBalance.annualUsed
  const sickRemaining = effectiveLeaveBalance.sick - leaveBalance.sickUsed
  const personalRemaining = effectiveLeaveBalance.personal - leaveBalance.personalUsed
  
  const recentLeaves = leaveRequests.slice(0, 3)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">
          ຍີນດີຕ້ອນຮັບ, {user?.firstName}
        </h1>
        <p className="text-muted-foreground">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
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
            <Badge variant={todayAttendance?.checkIn ? 'default' : 'secondary'}>
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
                <Palmtree className="w-5 h-5 text-chart-2" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ວັນພັກປະຈຳປີ</p>
                <p className="text-xl font-bold text-foreground">{annualRemaining}/{effectiveLeaveBalance.annual}</p>
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
            Leave Balance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Palmtree className="w-4 h-4 text-chart-2" />
                Annual Leave
              </span>
              <span className="text-muted-foreground">
                {leaveBalance.annualUsed} used / {effectiveLeaveBalance.annual} days
              </span>
            </div>
            <Progress value={(leaveBalance.annualUsed / effectiveLeaveBalance.annual) * 100} className="h-2" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-chart-1" />
                Sick Leave
              </span>
              <span className="text-muted-foreground">
                {leaveBalance.sickUsed} used / {effectiveLeaveBalance.sick} days
              </span>
            </div>
            <Progress value={(leaveBalance.sickUsed / effectiveLeaveBalance.sick) * 100} className="h-2" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <User className="w-4 h-4 text-chart-5" />
                Personal Leave
              </span>
              <span className="text-muted-foreground">
                {leaveBalance.personalUsed} used / {effectiveLeaveBalance.personal} days
              </span>
            </div>
            <Progress value={(leaveBalance.personalUsed / effectiveLeaveBalance.personal) * 100} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Recent Leaves */}
      <Card>
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
      </Card>
    </div>
  )
}
