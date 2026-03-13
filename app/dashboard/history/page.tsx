'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useHRM } from '@/lib/hrm-context'
import HistorySkeleton from '@/components/skeletons/historySkeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  LogOut
} from 'lucide-react'
import { format } from 'date-fns'

export default function HistoryPage() {
  const { isLoading } = useAuth()
  const { 
    attendanceHistory, 
    leaveRequests, 
    offsiteRequests,
    lateRecords,
    totalFines
  } = useHRM()

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'approved':
      case 'present':
        return 'default' as const
      case 'rejected':
      case 'absent':
        return 'destructive' as const
      case 'late':
        return 'secondary' as const
      default:
        return 'outline' as const
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-3 h-3" />
      case 'rejected':
        return <XCircle className="w-3 h-3" />
      default:
        return <Clock className="w-3 h-3" />
    }
  }

  if (isLoading) {
    return <HistorySkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">History</h1>
        <p className="text-muted-foreground">View your attendance and request history</p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-chart-1/10">
                <Calendar className="w-5 h-5 text-chart-1" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Days</p>
                <p className="text-xl font-bold text-foreground">{attendanceHistory.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-chart-3/10">
                <AlertTriangle className="w-5 h-5 text-chart-3" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Late Count</p>
                <p className="text-xl font-bold text-foreground">{lateRecords.length}</p>
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

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-chart-2/10">
                <Palmtree className="w-5 h-5 text-chart-2" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Leave Taken</p>
                <p className="text-xl font-bold text-foreground">
                  {leaveRequests.filter(r => r.status === 'approved').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History Tabs */}
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

        {/* Attendance History */}
        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attendance History</CardTitle>
              <CardDescription>Your daily check-in/out records</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {attendanceHistory.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-background">
                          <Calendar className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {format(new Date(record.date), 'EEEE, MMM d, yyyy')}
                          </p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <LogIn className="w-3 h-3" />
                              {record.checkIn || '--:--'}
                            </span>
                            <span className="flex items-center gap-1">
                              <LogOut className="w-3 h-3" />
                              {record.checkOut || '--:--'}
                            </span>
                            {record.workHours && (
                              <span>{record.workHours}h worked</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge variant={getStatusVariant(record.status)}>
                        {record.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leave History */}
        <TabsContent value="leave" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Leave Request History</CardTitle>
              <CardDescription>All your leave requests and their status</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                {leaveRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No leave requests yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {leaveRequests.map((request) => (
                      <div
                        key={request.id}
                        className="p-4 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium">
                              {request.policyName || request.type}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(request.startDate), 'MMM d')} - {format(new Date(request.endDate), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <Badge variant={getStatusVariant(request.status)} className="flex items-center gap-1">
                            {getStatusIcon(request.status)}
                            {request.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {request.reason}
                        </p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span>Submitted: {format(new Date(request.createdAt), 'MMM d, yyyy')}</span>
                          {request.reviewedBy && (
                            <span>Reviewed by: {request.reviewedBy}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Off-site History */}
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
                      <div
                        key={request.id}
                        className="p-4 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium">
                              {request.location}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(request.date), 'EEEE, MMM d, yyyy')}
                            </p>
                          </div>
                          <Badge variant={getStatusVariant(request.status)} className="flex items-center gap-1">
                            {getStatusIcon(request.status)}
                            {request.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {request.reason}
                        </p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span>Submitted: {format(new Date(request.createdAt), 'MMM d, yyyy')}</span>
                          {request.reviewedBy && (
                            <span>Reviewed by: {request.reviewedBy}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fines History */}
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
                    {/* Summary */}
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
