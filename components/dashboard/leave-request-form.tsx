'use client'

import { useEffect, useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth-context'
import { useHRM } from '@/lib/hrm-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar as CalendarIcon, Send, Clock, CheckCircle, XCircle, Sun, Sunset } from 'lucide-react'
import { toast } from 'sonner'
import { format, differenceInCalendarDays } from 'date-fns'
import { cn } from '@/lib/utils'
import { getLeaveApproverRuleText } from '@/services/leave-approval'
import { fetchPoliciesForGender } from '@/services/policies'
import type { LeaveRequest } from '@/lib/types'

type Period = 'morning' | 'afternoon'
type LeaveTypeOption = {
  value: string
  requestType: string
  policyUuid: string | undefined
  policyName: string | undefined
  label: string
}

function calcDuration(startDate?: Date, startPeriod: Period = 'morning', endDate?: Date, endPeriod: Period = 'afternoon'): number | null {
  if (!startDate || !endDate) return null
  const days = differenceInCalendarDays(endDate, startDate)
  const startHalf = days * 2 + (endPeriod === 'morning' ? 0 : 1) - (startPeriod === 'morning' ? 0 : 1) + 1
  if (startHalf <= 0) return null
  return startHalf / 2
}

function formatDuration(d: number): string {
  return d === 0.5 ? '0.5 day' : d === 1 ? '1 day' : `${d} days`
}

function formatPolicyLimit(limitDay?: number, limitType?: string): string | null {
  if (limitDay === undefined) {
    return null
  }

  const typeMap: Record<string, string> = {
    time: 'ຄັ້ງ',
    week: 'ອາທິດ',
    month: 'ເດືອນ',
    year: 'ປີ',
  }

  if (!limitType) {
    return `${limitDay} ວັນ`
  }

  const normalizedType = limitType.trim().toLowerCase()
  const translatedType = typeMap[normalizedType] || limitType

  return `${limitDay} ວັນ / ${translatedType}`
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'approved': return <CheckCircle className="w-3 h-3" />
    case 'rejected': return <XCircle className="w-3 h-3" />
    default: return <Clock className="w-3 h-3" />
  }
}

function getStatusVariant(status: string) {
  switch (status) {
    case 'approved': return 'default' as const
    case 'rejected': return 'destructive' as const
    default: return 'secondary' as const
  }
}

export default function LeaveRequestForm() {
  const { user } = useAuth()
  const { leaveRequests, submitLeaveRequest, leaveBalance } = useHRM()

  const [selectedPolicyValue, setSelectedPolicyValue] = useState('annual')
  const [leaveStartDate, setLeaveStartDate] = useState<Date>()
  const [startPeriod, setStartPeriod] = useState<Period>('morning')
  const [leaveEndDate, setLeaveEndDate] = useState<Date>()
  const [endPeriod, setEndPeriod] = useState<Period>('afternoon')
  const [leaveReason, setLeaveReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const annualRemaining = leaveBalance.annual - leaveBalance.annualUsed
  const sickRemaining = leaveBalance.sick - leaveBalance.sickUsed
  const personalRemaining = leaveBalance.personal - leaveBalance.personalUsed

  const duration = useMemo(
    () => calcDuration(leaveStartDate, startPeriod, leaveEndDate, endPeriod),
    [leaveStartDate, startPeriod, leaveEndDate, endPeriod]
  )

  const approverRuleText = useMemo(() => {
    return getLeaveApproverRuleText(duration)
  }, [duration])

  const { data: policyRecords = [] } = useQuery({
    queryKey: ['policies', 'leave-types', user?.gender ?? null],
    queryFn: () => fetchPoliciesForGender(user?.gender),
  })

  const leaveTypeOptions = useMemo(() => {
    const fallback: LeaveTypeOption[] = [
      { value: 'annual', requestType: 'annual', policyUuid: undefined, policyName: 'Annual Leave', label: `Annual Leave (ສູງສຸດ ${annualRemaining} ມື້)` },
      { value: 'sick', requestType: 'sick', policyUuid: undefined, policyName: 'Sick Leave', label: `Sick Leave (ສູງສຸດ ${sickRemaining} ມື້)` },
      { value: 'personal', requestType: 'personal', policyUuid: undefined, policyName: 'Personal Leave', label: `Personal Leave (ສູງສຸດ ${personalRemaining} ມື້)` },
      { value: 'unpaid', requestType: 'unpaid', policyUuid: undefined, policyName: 'Unpaid Leave', label: 'Unpaid Leave' },
    ]

    const seen = new Set<string>()
    const filtered = policyRecords
      .filter((policy) => policy.requestType)
      .map((policy) => {
        const value = policy.uuid || policy.id
        if (seen.has(value)) {
          return null
        }
        seen.add(value)

        const baseLabel = policy.name?.trim() || policy.requestType
        const limitLabel = formatPolicyLimit(policy.limitDay, policy.limitType)

        return {
          value,
          requestType: policy.requestType,
          policyUuid: policy.uuid,
          policyName: policy.name,
          label: limitLabel ? `${baseLabel} (${limitLabel})` : baseLabel,
        }
      })
      .filter((option): option is LeaveTypeOption => option !== null)

    return filtered.length > 0 ? filtered : fallback
  }, [annualRemaining, leaveBalance.annualUsed, leaveBalance.personalUsed, leaveBalance.sickUsed, personalRemaining, policyRecords, sickRemaining])

  const selectedPolicy = useMemo(
    () => leaveTypeOptions.find((option) => option.value === selectedPolicyValue) ?? leaveTypeOptions[0],
    [leaveTypeOptions, selectedPolicyValue]
  )

  useEffect(() => {
    if (!selectedPolicy || selectedPolicy.value === selectedPolicyValue) {
      return
    }
    setSelectedPolicyValue(selectedPolicy.value)
  }, [selectedPolicy, selectedPolicyValue])

  function handleStartDateSelect(date?: Date) {
    setLeaveStartDate(date)
    // If end is now before start, clear end
    if (date && leaveEndDate && date > leaveEndDate) {
      setLeaveEndDate(undefined)
    }
  }

  function handleStartPeriodChange(period: Period) {
    setStartPeriod(period)
    // If same day and new start period is afternoon, force end to afternoon too
    if (leaveStartDate && leaveEndDate && leaveStartDate.toDateString() === leaveEndDate.toDateString() && period === 'afternoon') {
      setEndPeriod('afternoon')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!leaveStartDate || !leaveEndDate) {
      toast.error('Please select start and end dates')
      return
    }

    if (!duration || duration <= 0) {
      toast.error('End must be after start')
      return
    }

    if (!leaveReason.trim()) {
      toast.error('Please provide a reason')
      return
    }

    setIsSubmitting(true)
    try {
      await submitLeaveRequest({
        type: selectedPolicy?.requestType || 'annual',
        policyUuid: selectedPolicy?.policyUuid,
        policyName: selectedPolicy?.policyName || selectedPolicy?.label,
        startDate: format(leaveStartDate, 'yyyy-MM-dd'),
        startPeriod,
        endDate: format(leaveEndDate, 'yyyy-MM-dd'),
        endPeriod,
        duration: duration ?? undefined,
        reason: leaveReason,
      })
      toast.success('Leave request submitted successfully')
      setSelectedPolicyValue(leaveTypeOptions[0]?.value || 'annual')
      setLeaveStartDate(undefined)
      setStartPeriod('morning')
      setLeaveEndDate(undefined)
      setEndPeriod('afternoon')
      setLeaveReason('')
    } catch {
      toast.error('Failed to submit leave request')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ແບບຟອມຂໍພັກຜ່ອນ</CardTitle>
          <CardDescription>ສົ່ງຄໍາຮ້ອງຂໍພັກຜ່ອນ</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel>ປະເພດການລາ</FieldLabel>
                <Select value={selectedPolicyValue} onValueChange={setSelectedPolicyValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="ເລືອກປະເພດການລາ" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>ວັນເລີ່ມຕົ້ນ</FieldLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !leaveStartDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {leaveStartDate ? format(leaveStartDate, 'MMM d, yyyy') : 'ເລືອກວັນທີ'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={leaveStartDate} onSelect={handleStartDateSelect} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <div className="flex gap-1 mt-1.5">
                    <button
                      type="button"
                      onClick={() => handleStartPeriodChange('morning')}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded border transition-colors',
                        startPeriod === 'morning'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-transparent border-input text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <Sun className="w-3 h-3" /> ຕອນເຊົ້າ
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartPeriodChange('afternoon')}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded border transition-colors',
                        startPeriod === 'afternoon'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-transparent border-input text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <Sunset className="w-3 h-3" /> ຕອນບ່າຍ
                    </button>
                  </div>
                </Field>

                <Field>
                  <FieldLabel>ວັນສິ້ນສຸດ</FieldLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !leaveEndDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {leaveEndDate ? format(leaveEndDate, 'MMM d, yyyy') : 'ເລືອກວັນທີ'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={leaveEndDate}
                        onSelect={setLeaveEndDate}
                        disabled={(d) => !!leaveStartDate && d < leaveStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <div className="flex gap-1 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setEndPeriod('morning')}
                      disabled={
                        !!(leaveStartDate && leaveEndDate &&
                          leaveStartDate.toDateString() === leaveEndDate.toDateString() &&
                          startPeriod === 'afternoon')
                      }
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded border transition-colors',
                        endPeriod === 'morning'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-transparent border-input text-muted-foreground hover:bg-muted',
                        'disabled:opacity-40 disabled:cursor-not-allowed'
                      )}
                    >
                      <Sun className="w-3 h-3" /> ຕອນເຊົ້າ
                    </button>
                    <button
                      type="button"
                      onClick={() => setEndPeriod('afternoon')}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded border transition-colors',
                        endPeriod === 'afternoon'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-transparent border-input text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <Sunset className="w-3 h-3" /> ຕອນບ່າຍ
                    </button>
                  </div>
                </Field>
              </div>

              {duration !== null && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 text-sm">
                  <span className="text-muted-foreground">Duration:</span>
                  <Badge variant="secondary" className="font-semibold">
                    {formatDuration(duration)}
                  </Badge>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {approverRuleText}.
              </p>

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

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Spinner className="mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Submit Request
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Recent Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {leaveRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No leave requests yet</p>
          ) : (
            <div className="space-y-3">
              {leaveRequests.slice(0, 5).map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{request.policyName || request.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(request.startDate), 'MMM d')} -{' '}
                      {format(new Date(request.endDate), 'MMM d, yyyy')}
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
    </>
  )
}
