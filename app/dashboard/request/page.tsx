'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useHRM } from '@/lib/hrm-context'
import { useQueryClient } from '@tanstack/react-query'
import { db } from '@/lib/firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { Plus, Palmtree, MapPin } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import LeaveRequestForm from '@/components/dashboard/leave-request-form'
import { useMyOffsiteRequests, OFFSITE_QUERY_KEY } from '@/hooks/useMyOffsiteRequests'
import type { OffsiteFilters } from '@/hooks/useMyOffsiteRequests'
import { OffsiteListFilterBar } from '@/components/offsite/OffsiteListFilterBar'
import { OffsiteRequestList } from '@/components/offsite/OffsiteRequestList'
import { CreateRequestDialog } from '@/components/offsite/CreateRequestDialog'
import FormsSkeleton from '@/components/skeletons/formsSkeleton'
import type { OffsiteRequestDoc } from '@/types/workOutside'

const DEFAULT_FILTERS: OffsiteFilters = {
  status: '',
  activityCode: '',
  monthKey: '',
  search: '',
}

export default function FormsPage() {
  const { user, isLoading } = useAuth()
  const { leaveBalance } = useHRM()
  const queryClient = useQueryClient()

  // ── persistent tab ──
  const [activeTab, setActiveTab] = useState('leave')

  useEffect(() => {
    const saved = localStorage.getItem('request-tab')
    if (saved === 'leave' || saved === 'offsite') setActiveTab(saved)
  }, [])

  function handleTabChange(value: string) {
    setActiveTab(value)
    localStorage.setItem('request-tab', value)
  }

  // ── offsite state ──
  const [filters, setFilters] = useState<OffsiteFilters>(DEFAULT_FILTERS)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<OffsiteRequestDoc | undefined>()
  const [cancelTarget, setCancelTarget] = useState<OffsiteRequestDoc | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  const { filtered, isLoading: listLoading, error, refetch, availableMonths } =
    useMyOffsiteRequests(filters)

  const annualRemaining = leaveBalance.annual - leaveBalance.annualUsed
  const sickRemaining = leaveBalance.sick - leaveBalance.sickUsed
  const personalRemaining = leaveBalance.personal - leaveBalance.personalUsed

  function handleCreateNew() {
    setEditTarget(undefined)
    setDialogOpen(true)
  }

  function handleEdit(d: OffsiteRequestDoc) {
    setEditTarget(d)
    setDialogOpen(true)
  }

  function handleSuccess() {
    queryClient.invalidateQueries({ queryKey: [OFFSITE_QUERY_KEY] })
  }

  async function handleConfirmCancel() {
    if (!cancelTarget || !user) return
    setIsCancelling(true)
    try {
      const now = new Date().toISOString()
      const fullName = `${user.firstNameEn ?? user.firstName ?? ''} ${user.lastNameEn ?? user.lastName ?? ''}`.trim()
      await updateDoc(doc(db, 'workOutside', cancelTarget.id), {
        status: 'cancelled',
        updatedAt: now,
        updatedBy: fullName,
      })
      toast.success(`ຍົກເລີກຄຳຂໍ ${cancelTarget.requestNo} ສຳເລັດ`)
      queryClient.invalidateQueries({ queryKey: [OFFSITE_QUERY_KEY] })
    } catch (err) {
      console.error(err)
      toast.error('ຍົກເລີກລົ້ມເຫລວ ກະລຸນາລອງໃໝ່')
    } finally {
      setIsCancelling(false)
      setCancelTarget(null)
    }
  }

  if (isLoading) return <FormsSkeleton />

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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="leave" className="gap-2">
            <Palmtree className="w-4 h-4" />
            ຟອມຂໍລາພັກ
          </TabsTrigger>
          <TabsTrigger value="offsite" className="gap-2">
            <MapPin className="w-4 h-4" />
            ຟອມອອກວຽກນອກ
          </TabsTrigger>
        </TabsList>

        {/* Leave Tab */}
        <TabsContent value="leave" className="mt-4">
          <LeaveRequestForm />
        </TabsContent>

        {/* Offsite Tab — list view */}
        <TabsContent value="offsite" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                ການອອກປະຕິບັດງານນອກສະຖານທີ່
              </h2>
              <p className="text-sm text-muted-foreground">ລາຍການຄຳຂໍຂອງທ່ານ</p>
            </div>
            <Button onClick={handleCreateNew} size="sm" className="gap-2 shrink-0">
              <Plus className="w-4 h-4" />
              ສ້າງຄຳຂໍໃໝ່
            </Button>
          </div>

          <OffsiteListFilterBar
            filters={filters}
            onFiltersChange={setFilters}
            availableMonths={availableMonths}
          />

          <OffsiteRequestList
            docs={filtered}
            isLoading={listLoading}
            error={error}
            currentUid={user?.uid ?? ''}
            onCreateNew={handleCreateNew}
            onEdit={handleEdit}
            onCancel={(d) => setCancelTarget(d)}
            onRetry={refetch}
          />
        </TabsContent>
      </Tabs>

      {/* Create / Edit Dialog */}
      <CreateRequestDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditTarget(undefined)
        }}
        onSuccess={handleSuccess}
        initialData={editTarget}
      />

      {/* Cancel confirmation */}
      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(open) => { if (!open) setCancelTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ຍົກເລີກຄຳຂໍນີ້?</AlertDialogTitle>
            <AlertDialogDescription>
              ຄຳຂໍ{' '}
              <span className="font-mono font-semibold">{cancelTarget?.requestNo}</span>{' '}
              ຈະຖືກຍົກເລີກ ແລະ ບໍ່ສາມາດກັບຄືນໄດ້
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>ປິດ</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? 'ກຳລັງຍົກເລີກ...' : 'ຍົກເລີກຄຳຂໍ'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
