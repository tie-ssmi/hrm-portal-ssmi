'use client'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { fetchLeavesForApproval, updateLeaveApproval } from '@/services/leaves'
import { toast } from 'sonner'
import type { LeaveTableItem } from '@/components/leaveTable'
import type { OffsiteTableItem } from '@/components/offSiteTable'
import FormsSkeleton from '@/components/skeletons/formsSkeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Palmtree, MapPin } from 'lucide-react'
import LeaveTable from '@/components/leaveTable'
import OffsiteTable from '@/components/offSiteTable'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from "@/components/ui/checkbox"
import type { OffsiteRequestDoc } from '@/types/workOutside'

export default function ApprovePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, isLoading } = useAuth()

  const loggedInUserUuid = user?.uid || user?.id || ''
  const departmentUuid = typeof user?.department === 'object' ? (user.department as { uuid?: string })?.uuid : undefined
  const workLocationUuid = typeof user?.workLocation === 'object' ? (user.workLocation as { uuid?: string })?.uuid : undefined
  const canApproveDept  = user?.rolePermissions?.approveDepartment ?? false
  const canApproveBranch = user?.rolePermissions?.approveBranch ?? false
  const isUnauthorized = !isLoading && !canApproveDept && !canApproveBranch

  // go to dashboard if canApproveDept and canApproveBranch are both false, to prevent unauthorized access to this page
  // NOTE: must run as an effect — an early `return null` here would skip the hooks
  // declared below and trigger "Rendered fewer hooks than expected" on the next render
  useEffect(() => {
    if (isUnauthorized) router.push('/dashboard')
  }, [isUnauthorized, router])

  const queryKey = ['leaves', 'approval', departmentUuid ?? null, workLocationUuid ?? null, loggedInUserUuid]

  const { data: leaveRequests = [] } = useQuery({
    queryKey,
    queryFn: () => fetchLeavesForApproval({
      departmentUid: departmentUuid!,
      workLocationUid: workLocationUuid!,
      excludeUserUuid: loggedInUserUuid,
    }),
    enabled: !!departmentUuid && !!workLocationUuid && !!loggedInUserUuid,
  })

  const leaveTableData = useMemo(() => leaveRequests.map((r) => ({
    id: r.id,
    name: r.leaveUserName || r.createdBy || '',
    position: r.jobTitle,
    department: r.departmentNameEn || r.departmentNameLo,
    reason: r.reason,
    successor: r.successorNameEn || r.successorNameLo,
    startDate: r.startDate,
    endDate: r.endDate,
    duration: r.duration,
    note: undefined as string | undefined,
    type: r.policyName ? { name: r.policyName } : { name: r.type },
    status: r.status,
    approvals: r.approvals,
  })), [leaveRequests])

  // ── Offsite approval query ──────────────────────────────────────────────────
  // canApproveBranch → same workLocation, all departments
  // canApproveDept   → same workLocation + same department
  // both cases: exclude records created by current user (client-side filter)
  const offsiteQueryKey = [
    'workOutside', 'approval',
    workLocationUuid ?? null,
    canApproveBranch ? 'branch' : departmentUuid ?? null,
    loggedInUserUuid,
  ]

  const { data: offsiteRequests = [] } = useQuery<OffsiteRequestDoc[]>({
    queryKey: offsiteQueryKey,
    queryFn: async () => {
      if (!workLocationUuid) return []
      const coll = collection(db, 'workOutside')
      const constraints = canApproveBranch
        ? [where('requester.workLocation.uuid', '==', workLocationUuid)]
        : [
            where('requester.workLocation.uuid', '==', workLocationUuid),
            where('requester.department.uuid', '==', departmentUuid),
          ]
      const snap = await getDocs(query(coll, ...constraints))
      const monthStart = new Date().toISOString().slice(0, 7) + '-01' // "YYYY-MM-01"
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as OffsiteRequestDoc))
        .filter((d) => d.createdByUid !== loggedInUserUuid)
        .filter((d) => d.status === 'pending' || d.endDate >= monthStart)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    enabled: !!workLocationUuid && !!loggedInUserUuid && (canApproveDept || canApproveBranch),
  })

  const offsiteTableData = useMemo(() =>
    offsiteRequests.map((r) => ({
      id: r.id,
      requestNo: r.requestNo,
      requester: r.requester,
      activityType: r.activityType,
      subject: r.subject,
      details: r.details,
      customerName: r.customerName,
      location: r.location,
      startDate: r.startDate,
      endDate: r.endDate,
      durationDays: r.durationDays,
      estimatedCost: r.estimatedCost,
      status: (r.status === 'cancelled' ? 'rejected' : r.status) as 'pending' | 'approved' | 'rejected',
      approvals: r.approvals as { role: string; decision: string }[],
      teammate: r.teammate,
      participantIds: r.participantIds,
      createdAt: r.createdAt,
      createdBy: r.createdBy,
    })),
    [offsiteRequests],
  )

  const workOutSide = offsiteTableData.length

  // ── Persistent tab state ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('leave')

  useEffect(() => {
    const saved = localStorage.getItem('approv-tab')
    if (saved === 'leave' || saved === 'offsite') setActiveTab(saved)
  }, [])

  function handleTabChange(value: string) {
    setActiveTab(value)
    localStorage.setItem('approv-tab', value)
  }

  // ── Leave approval state ─────────────────────────────────────────────────
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [pendingApproveItem, setPendingApproveItem] = useState<LeaveTableItem | null>(null)
  const [isApproving, setIsApproving] = useState(false)

  // ── Offsite approval state ───────────────────────────────────────────────
  const [openOffsiteDialog, setOpenOffsiteDialog] = useState(false)
  const [offsiteAction, setOffsiteAction] = useState<'approve' | 'reject' | null>(null)
  const [pendingOffsiteItem, setPendingOffsiteItem] = useState<OffsiteTableItem | null>(null)
  const [confirmOffsite, setConfirmOffsite] = useState(false)
  const [isProcessingOffsite, setIsProcessingOffsite] = useState(false)

  const handleConfirmLeaveChange = (checked: boolean | 'indeterminate') => {
    setConfirmLeave(checked === true)
  }

  const handleDialogOpenChange = (open: boolean) => {
    setOpenConfirmDialog(open)
    if (!open) {
      setConfirmLeave(false)
      setPendingApproveItem(null)
    }
  }

  const handleApprove = (item: LeaveTableItem) => {
    setPendingApproveItem(item)
    setOpenConfirmDialog(true)
  }

  // ── Offsite handlers ─────────────────────────────────────────────────────
  const handleOffsiteApprove = (item: OffsiteTableItem) => {
    setPendingOffsiteItem(item)
    setOffsiteAction('approve')
    setOpenOffsiteDialog(true)
  }

  const handleOffsiteReject = (item: OffsiteTableItem) => {
    setPendingOffsiteItem(item)
    setOffsiteAction('reject')
    setOpenOffsiteDialog(true)
  }

  const handleOffsiteDialogOpenChange = (open: boolean) => {
    setOpenOffsiteDialog(open)
    if (!open) {
      setPendingOffsiteItem(null)
      setOffsiteAction(null)
      setConfirmOffsite(false)
    }
  }

  const handleConfirmOffsiteAction = async () => {
    if (!pendingOffsiteItem || !offsiteAction || !confirmOffsite) return
    const reviewedBy = [user?.firstNameLo || user?.firstName, user?.lastNameLo || user?.lastName]
      .filter(Boolean).join(' ') || loggedInUserUuid
    const now = new Date().toISOString()

    setIsProcessingOffsite(true)
    try {
      const decision = offsiteAction === 'approve' ? 'approved' : 'rejected'
      const approvalRole = canApproveDept ? 'departmentHead' : 'manager'
      const fullRecord = offsiteRequests.find((r) => r.id === pendingOffsiteItem.id)
      const approvalIndex = fullRecord?.approvals.findIndex((ap) => ap.role === approvalRole) ?? -1

      const payload: Record<string, unknown> = {
        ...(decision === 'rejected' && { status: 'rejected' }),
        updatedAt: now,
        updatedBy: reviewedBy,
      }

      if (approvalIndex >= 0 && fullRecord) {
        const updatedApprovals = fullRecord.approvals.map((ap, i) =>
          i === approvalIndex ? { ...ap, decision, reviewedBy, reviewedAt: now } : ap
        )
        payload.approvals = updatedApprovals
      }

      await updateDoc(doc(db, 'workOutside', pendingOffsiteItem.id), payload)
      await queryClient.invalidateQueries({ queryKey: offsiteQueryKey })
      toast.success(offsiteAction === 'approve' ? 'ອະນຸມັດສຳເລັດ' : 'ປະຕິເສດສຳເລັດ')
    } catch {
      toast.error('ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່')
    } finally {
      setIsProcessingOffsite(false)
      setOpenOffsiteDialog(false)
      setPendingOffsiteItem(null)
      setOffsiteAction(null)
      setConfirmOffsite(false)
    }
  }

  const handleConfirmApprove = async () => {
    if (!pendingApproveItem || !confirmLeave) return
    const reviewedBy = [user?.firstNameLo || user?.firstName, user?.lastNameLo || user?.lastName]
      .filter(Boolean).join(' ') || loggedInUserUuid

    setIsApproving(true)
    try {
      await updateLeaveApproval({
        leaveId: pendingApproveItem.id,
        approvalIndex: 0,
        decision: 'approved',
        reviewedBy,
        reviewedByUid: loggedInUserUuid,
      })
      await queryClient.invalidateQueries({ queryKey })
      toast.success('ອະນຸມັດສຳເລັດ')
    } catch {
      toast.error('ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່')
    } finally {
      setIsApproving(false)
      setOpenConfirmDialog(false)
      setConfirmLeave(false)
      setPendingApproveItem(null)
    }
  }


  if (isLoading || isUnauthorized) {
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
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-chart-2/20 bg-chart-2/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Palmtree className="h-3.5 w-3.5 text-chart-2" />
              ຂໍລາພັກ
            </p>
            <p className="text-lg font-bold text-foreground">{leaveTableData.length} list</p>
          </CardContent>
        </Card>
        <Card className="border-chart-1/20 bg-chart-1/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-chart-1" />
              ຂໍອອກວຽກນອກ
            </p>
            <p className="text-lg font-bold text-foreground">{workOutSide} list</p>
          </CardContent>
        </Card>

      </div>

      {/* Forms Tabs */}
      {/* Approve Confirm Dialog */}
      <Dialog open={openConfirmDialog} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ຢືນຢັນການອະນຸມັດ</DialogTitle>
            <DialogDescription>
              ອະນຸມັດຄໍາຮ້ອງຂໍຂອງ <strong>{pendingApproveItem?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <label htmlFor="confirm-approve" className="flex items-start gap-3 py-2 cursor-pointer select-none rounded-lg border p-3 hover:bg-muted/50 transition-colors">
            <Checkbox id="confirm-approve" checked={confirmLeave} onCheckedChange={handleConfirmLeaveChange} className="mt-0.5 shrink-0" />
            <span className="text-sm leading-relaxed">
              ຂ້ອຍໄດ້ກວດສອບຂໍ້ມູນແລ້ວ ແລະ ຢືນຢັນການອະນຸມັດ
            </span>
          </label>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isApproving}>ຍົກເລີກ</Button>
            </DialogClose>
            <Button onClick={handleConfirmApprove} disabled={!confirmLeave || isApproving}>
              {isApproving ? 'ກຳລັງອະນຸມັດ...' : 'ອະນຸມັດ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Offsite Approve/Reject Confirm Dialog */}
      <Dialog open={openOffsiteDialog} onOpenChange={handleOffsiteDialogOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {offsiteAction === 'approve' ? 'ຢືນຢັນການອະນຸມັດ' : 'ຢືນຢັນການປະຕິເສດ'}
            </DialogTitle>
            <DialogDescription>
              {offsiteAction === 'approve' ? 'ອະນຸມັດ' : 'ປະຕິເສດ'}ຄໍາຮ້ອງຂໍຂອງ{' '}
              <strong>{pendingOffsiteItem?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <label htmlFor="confirm-offsite" className="flex items-start gap-3 py-2 cursor-pointer select-none rounded-lg border p-3 hover:bg-muted/50 transition-colors">
            <Checkbox
              id="confirm-offsite"
              checked={confirmOffsite}
              onCheckedChange={(v) => setConfirmOffsite(v === true)}
              className="mt-0.5 shrink-0"
            />
            <span className="text-sm leading-relaxed">
              ຂ້ອຍໄດ້ກວດສອບຂໍ້ມູນແລ້ວ ແລະ ຢືນຢັນການ
              {offsiteAction === 'approve' ? 'ອະນຸມັດ' : 'ປະຕິເສດ'}
            </span>
          </label>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isProcessingOffsite}>ຍົກເລີກ</Button>
            </DialogClose>
            <Button
              variant={offsiteAction === 'reject' ? 'destructive' : 'default'}
              onClick={handleConfirmOffsiteAction}
              disabled={!confirmOffsite || isProcessingOffsite}
            >
              {isProcessingOffsite
                ? 'ກຳລັງດຳເນີນການ...'
                : offsiteAction === 'approve' ? 'ອະນຸມັດ' : 'ປະຕິເສດ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="leave" className="gap-2">
            <Palmtree className="w-4 h-4" />
            ລາຍການຂໍລາພັກ
          </TabsTrigger>
          <TabsTrigger value="offsite" className="gap-2">
            <MapPin className="w-4 h-4" />
            ລາຍການອອກວຽກນອກ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leave" className="mt-4">
          <div className='w-full flex justify-end mb-4'>
           <Button onClick={() => router.push('/dashboard/approv/leave/instead')}>ລາພັກແທນ</Button>
          
          
          
          
          </div>
          <LeaveTable data={leaveTableData} onApprove={handleApprove} />
        </TabsContent>

        <TabsContent value="offsite" className="mt-4">
          <OffsiteTable
            data={offsiteTableData}
            canApproveBranch={canApproveBranch}
            onApprove={handleOffsiteApprove}
            onReject={handleOffsiteReject}
            onViewDetail={(item) => router.push(`/dashboard/approv/wrok-off-site?id=${item.id}`)}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}