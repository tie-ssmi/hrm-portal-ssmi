'use client'

import type { FormEvent } from 'react'
import { format, isWeekend } from 'date-fns'
import { Calendar as CalendarIcon, Send, Sun, Sunset } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

type Period = 'morning' | 'afternoon'

type LeaveTypeOption = {
value: string
label: string
}

type LeaveRequestCardProps = {
selectedPolicyValue: string
onSelectedPolicyValueChange: (value: string) => void
leaveTypeOptions: LeaveTypeOption[]
leaveStartDate?: Date
onLeaveStartDateChange: (date?: Date) => void
startPeriod: Period
onStartPeriodChange: (period: Period) => void
leaveEndDate?: Date
onLeaveEndDateChange: (date?: Date) => void
endPeriod: Period
onEndPeriodChange: (period: Period) => void
duration: number | null
approverRuleText: string
leaveReason: string
onLeaveReasonChange: (value: string) => void
isSubmitting: boolean
onSubmit: (e: FormEvent<HTMLFormElement>) => void
}

function formatDuration(d: number): string {
return d === 0.5 ? '0.5 day' : d === 1 ? '1 day' : `${d} days`
}

function isWeekendDate(date: Date): boolean {
return isWeekend(date)
}

export default function LeaveRequest({
selectedPolicyValue,
onSelectedPolicyValueChange,
leaveTypeOptions,
leaveStartDate,
onLeaveStartDateChange,
startPeriod,
onStartPeriodChange,
leaveEndDate,
onLeaveEndDateChange,
endPeriod,
onEndPeriodChange,
duration,
approverRuleText,
leaveReason,
onLeaveReasonChange,
isSubmitting,
onSubmit,
}: LeaveRequestCardProps) {
return (
<Card>
<CardHeader>
<CardTitle className="text-lg">ແບບຟອມຂໍພັກຜ່ອນ</CardTitle>
<CardDescription>ສົ່ງຄໍາຮ້ອງຂໍພັກຜ່ອນ</CardDescription>
</CardHeader>
<CardContent>
<form onSubmit={onSubmit} className="space-y-4">
<FieldGroup>
<Field>
<FieldLabel>ປະເພດການລາ</FieldLabel>
<Select value={selectedPolicyValue} onValueChange={onSelectedPolicyValueChange}>
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
<Calendar
mode="single"
selected={leaveStartDate}
onSelect={onLeaveStartDateChange}
disabled={isWeekendDate}
initialFocus
/>
</PopoverContent>
</Popover>
<div className="flex gap-1 mt-1.5">
<button
type="button"
onClick={() => onStartPeriodChange('morning')}
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
onClick={() => onStartPeriodChange('afternoon')}
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
onSelect={onLeaveEndDateChange}
disabled={(d) => isWeekendDate(d) || (!!leaveStartDate && d < leaveStartDate)}
initialFocus
/>
</PopoverContent>
</Popover>
<div className="flex gap-1 mt-1.5">
<button
type="button"
onClick={() => onEndPeriodChange('morning')}
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
onClick={() => onEndPeriodChange('afternoon')}
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
<span className="text-muted-foreground">ຈຳນວນມື້:</span>
<Badge variant="secondary" className="font-semibold">
{formatDuration(duration)}
</Badge>
</div>
)}

<p className="text-xs text-muted-foreground">
{approverRuleText}.
</p>

<Field>
<FieldLabel>ເຫດຜົນ</FieldLabel>
<Textarea
placeholder="ອະທິບາຍເຫດຜົນການລາ..."
value={leaveReason}
onChange={(e) => onLeaveReasonChange(e.target.value)}
rows={3}
/>
</Field>
</FieldGroup>

<Button type="submit" className="w-full" disabled={isSubmitting}>
{isSubmitting ? <Spinner className="mr-2" /> : <Send className="w-4 h-4 mr-2" />}
ສົ່ງຄໍາຮ້ອງຂໍ
</Button>
</form>
</CardContent>
</Card>
)
}
