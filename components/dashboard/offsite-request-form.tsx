'use client'

import { useState } from 'react'
import { useHRM } from '@/lib/hrm-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarIcon, Send, Clock, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

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

export default function OffsiteRequestForm() {
  const { offsiteRequests, submitOffsiteRequest } = useHRM()

  const [offsiteDate, setOffsiteDate] = useState<Date>()
  const [offsiteLocation, setOffsiteLocation] = useState('')
  const [offsiteReason, setOffsiteReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!offsiteDate) {
      toast.error('Please select a date')
      return
    }

    if (!offsiteLocation.trim() || !offsiteReason.trim()) {
      toast.error('Please fill in all fields')
      return
    }

    setIsSubmitting(true)
    try {
      await submitOffsiteRequest({
        date: format(offsiteDate, 'yyyy-MM-dd'),
        location: offsiteLocation,
        reason: offsiteReason,
      })
      toast.success('Off-site request submitted successfully')
      setOffsiteDate(undefined)
      setOffsiteLocation('')
      setOffsiteReason('')
    } catch {
      toast.error('Failed to submit off-site request')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Off-site Work Request</CardTitle>
          <CardDescription>Request to work from a different location</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel>Date</FieldLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !offsiteDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {offsiteDate ? format(offsiteDate, 'MMM d, yyyy') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={offsiteDate} onSelect={setOffsiteDate} initialFocus />
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
          {offsiteRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No off-site requests yet</p>
          ) : (
            <div className="space-y-3">
              {offsiteRequests.slice(0, 5).map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{request.location}</p>
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
    </>
  )
}
