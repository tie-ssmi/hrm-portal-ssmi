'use client'

import { useAuth } from '@/lib/auth-context'
import { useHRM } from '@/lib/hrm-context'
import FormsSkeleton from '@/components/skeletons/formsSkeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Palmtree, MapPin } from 'lucide-react'
import LeaveRequestForm from '@/components/dashboard/leave-request-form'
import OffsiteRequestForm from '@/components/dashboard/offsite-request-form'

export default function FormsPage() {
  const { isLoading } = useAuth()
  const { leaveBalance } = useHRM()

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
            ຟອມຂໍລາພັກ
          </TabsTrigger>
          <TabsTrigger value="offsite" className="gap-2">
            <MapPin className="w-4 h-4" />
            ຟອມອອກວຽກນອກສະຖານທີ່
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leave" className="mt-4">
          <LeaveRequestForm />
        </TabsContent>

        <TabsContent value="offsite" className="mt-4">
          <OffsiteRequestForm />
        </TabsContent>
      </Tabs>
    </div>
  )
}
