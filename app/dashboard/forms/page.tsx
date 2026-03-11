'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useHRM } from '@/lib/hrm-context'
import FormsSkeleton from '@/components/skeletons/formsSkeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Palmtree, 
  MapPin, 
  Calendar as CalendarIcon,
  Send,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { LeaveRequest, OffsiteRequest } from '@/lib/types'

export default function FormsPage() {
  const { isLoading } = useAuth()
  const { 
    leaveRequests, 
    offsiteRequests, 
    submitLeaveRequest, 
    submitOffsiteRequest,
    leaveBalance 
  } = useHRM()

  // Leave form state
  const [leaveType, setLeaveType] = useState<LeaveRequest['type']>('annual')
  const [leaveStartDate, setLeaveStartDate] = useState<Date>()
  const [leaveEndDate, setLeaveEndDate] = useState<Date>()
  const [leaveReason, setLeaveReason] = useState('')
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false)

  // Offsite form state
  const [offsiteDate, setOffsiteDate] = useState<Date>()
  const [offsiteLocation, setOffsiteLocation] = useState('')
  const [offsiteReason, setOffsiteReason] = useState('')
  const [isSubmittingOffsite, setIsSubmittingOffsite] = useState(false)

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!leaveStartDate || !leaveEndDate) {
      toast.error('Please select start and end dates')
      return
    }

    if (!leaveReason.trim()) {
      toast.error('Please provide a reason')
      return
    }

    setIsSubmittingLeave(true)
    try {
      await submitLeaveRequest({
        type: leaveType,
        startDate: format(leaveStartDate, 'yyyy-MM-dd'),
        endDate: format(leaveEndDate, 'yyyy-MM-dd'),
        reason: leaveReason
      })
      toast.success('Leave request submitted successfully')
      
      // Reset form
      setLeaveType('annual')
      setLeaveStartDate(undefined)
      setLeaveEndDate(undefined)
      setLeaveReason('')
    } catch {
      toast.error('Failed to submit leave request')
    } finally {
      setIsSubmittingLeave(false)
    }
  }

  const handleSubmitOffsite = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!offsiteDate) {
      toast.error('Please select a date')
      return
    }

    if (!offsiteLocation.trim() || !offsiteReason.trim()) {
      toast.error('Please fill in all fields')
      return
    }

    setIsSubmittingOffsite(true)
    try {
      await submitOffsiteRequest({
        date: format(offsiteDate, 'yyyy-MM-dd'),
        location: offsiteLocation,
        reason: offsiteReason
      })
      toast.success('Off-site request submitted successfully')
      
      // Reset form
      setOffsiteDate(undefined)
      setOffsiteLocation('')
      setOffsiteReason('')
    } catch {
      toast.error('Failed to submit off-site request')
    } finally {
      setIsSubmittingOffsite(false)
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

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'approved':
        return 'default' as const
      case 'rejected':
        return 'destructive' as const
      default:
        return 'secondary' as const
    }
  }

  const annualRemaining = leaveBalance.annual - leaveBalance.annualUsed
  const sickRemaining = leaveBalance.sick - leaveBalance.sickUsed
  const personalRemaining = leaveBalance.personal - leaveBalance.personalUsed

  if (isLoading) {
    return <FormsSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Request Forms</h1>
        <p className="text-muted-foreground">Submit leave and off-site work requests</p>
      </div>

      {/* Leave Balance Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-chart-2/20 bg-chart-2/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Annual</p>
            <p className="text-lg font-bold text-foreground">{annualRemaining} days</p>
          </CardContent>
        </Card>
        <Card className="border-chart-1/20 bg-chart-1/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Sick</p>
            <p className="text-lg font-bold text-foreground">{sickRemaining} days</p>
          </CardContent>
        </Card>
        <Card className="border-chart-5/20 bg-chart-5/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Personal</p>
            <p className="text-lg font-bold text-foreground">{personalRemaining} days</p>
          </CardContent>
        </Card>
      </div>

      {/* Forms Tabs */}
      <Tabs defaultValue="leave" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="leave" className="gap-2">
            <Palmtree className="w-4 h-4" />
            Leave Request
          </TabsTrigger>
          <TabsTrigger value="offsite" className="gap-2">
            <MapPin className="w-4 h-4" />
            Off-site Work
          </TabsTrigger>
        </TabsList>

        {/* Leave Request Form */}
        <TabsContent value="leave" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">New Leave Request</CardTitle>
              <CardDescription>
                Submit a request for time off
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitLeave} className="space-y-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel>Leave Type</FieldLabel>
                    <Select value={leaveType} onValueChange={(v) => setLeaveType(v as LeaveRequest['type'])}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select leave type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="annual">Annual Leave ({annualRemaining} remaining)</SelectItem>
                        <SelectItem value="sick">Sick Leave ({sickRemaining} remaining)</SelectItem>
                        <SelectItem value="personal">Personal Leave ({personalRemaining} remaining)</SelectItem>
                        <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel>Start Date</FieldLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !leaveStartDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {leaveStartDate ? format(leaveStartDate, "MMM d, yyyy") : "Pick date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={leaveStartDate}
                            onSelect={setLeaveStartDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </Field>

                    <Field>
                      <FieldLabel>End Date</FieldLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !leaveEndDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {leaveEndDate ? format(leaveEndDate, "MMM d, yyyy") : "Pick date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={leaveEndDate}
                            onSelect={setLeaveEndDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel>Reason</FieldLabel>
                    <Textarea
                      placeholder="Describe your reason for leave..."
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      rows={3}
                    />
                  </Field>
                </FieldGroup>

                <Button type="submit" className="w-full" disabled={isSubmittingLeave}>
                  {isSubmittingLeave ? <Spinner className="mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Submit Request
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Recent Leave Requests */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Recent Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {leaveRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No leave requests yet
                </p>
              ) : (
                <div className="space-y-3">
                  {leaveRequests.slice(0, 5).map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium capitalize">
                          {request.type} Leave
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(request.startDate), 'MMM d')} - {format(new Date(request.endDate), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <Badge variant={getStatusVariant(request.status)} className="flex items-center gap-1">
                        {getStatusIcon(request.status)}
                        {request.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Off-site Work Form */}
        <TabsContent value="offsite" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Off-site Work Request</CardTitle>
              <CardDescription>
                Request to work from a different location
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitOffsite} className="space-y-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel>Date</FieldLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !offsiteDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {offsiteDate ? format(offsiteDate, "MMM d, yyyy") : "Pick date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={offsiteDate}
                          onSelect={setOffsiteDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </Field>

                  <Field>
                    <FieldLabel>Location</FieldLabel>
                    <Input
                      placeholder="e.g., Home Office, Client Site..."
                      value={offsiteLocation}
                      onChange={(e) => setOffsiteLocation(e.target.value)}
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Reason</FieldLabel>
                    <Textarea
                      placeholder="Describe your reason for working off-site..."
                      value={offsiteReason}
                      onChange={(e) => setOffsiteReason(e.target.value)}
                      rows={3}
                    />
                  </Field>
                </FieldGroup>

                <Button type="submit" className="w-full" disabled={isSubmittingOffsite}>
                  {isSubmittingOffsite ? <Spinner className="mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Submit Request
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Recent Off-site Requests */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Recent Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {offsiteRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No off-site requests yet
                </p>
              ) : (
                <div className="space-y-3">
                  {offsiteRequests.slice(0, 5).map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {request.location}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(request.date), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <Badge variant={getStatusVariant(request.status)} className="flex items-center gap-1">
                        {getStatusIcon(request.status)}
                        {request.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
