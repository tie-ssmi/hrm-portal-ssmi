'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchLeavesForApproval, updateLeaveApproval } from '@/services/leaves'
import { toast } from 'sonner'
import type { LeaveTableItem } from '@/components/leaveTable'
import FormsSkeleton from '@/components/skeletons/formsSkeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Palmtree, MapPin } from 'lucide-react'
import LeaveTable from '@/components/leaveTable'
import OffsiteTable from '@/components/offSiteTable'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Checkbox } from "@/components/ui/checkbox"

const demoOffsiteData = [
  {
    id: 'OS-001',
    name: 'ນາງ ຈັນສະໝອນ ອິນທະວົງ',
    position: 'Sales Executive',
    department: 'Sales',
    reason: 'ເຂົ້າພົບລູກຄ້າປະຈໍາເດືອນ',
    successor: 'ທ້າວ ຄໍາແພງ ແກ້ວສະຫວັດ',
    startDate: '2026-04-14',
    endDate: '2026-04-14',
    status: 'pending' as const,
  },
  {
    id: 'OS-002',
    name: 'ທ້າວ ວິຊານ ສຸວັນນະວົງ',
    position: 'HR Officer',
    department: 'HR',
    reason: 'ອອກໄປສໍາພາດພະນັກງານໃໝ່',
    successor: 'ນາງ ກິດສະດາ ອິນທະລາ',
    startDate: '2026-04-16',
    endDate: '2026-04-16',
    status: 'approved' as const,
  },
]

export default function ApprovePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, isLoading } = useAuth()

  const loggedInUserUuid = user?.uid || user?.id || ''
  const departmentUuid = typeof user?.department === 'object' ? (user.department as { uuid?: string })?.uuid : undefined
  const workLocationUuid = typeof user?.workLocation === 'object' ? (user.workLocation as { uuid?: string })?.uuid : undefined

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

  const workOutSide = demoOffsiteData.length
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [pendingApproveItem, setPendingApproveItem] = useState<LeaveTableItem | null>(null)
  const [isApproving, setIsApproving] = useState(false)

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
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-chart-2/20 bg-chart-2/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Palmtree className="h-3.5 w-3.5 text-chart-2" />
              leave
            </p>
            <p className="text-lg font-bold text-foreground">{leaveTableData.length} list</p>
          </CardContent>
        </Card>
        <Card className="border-chart-1/20 bg-chart-1/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-chart-1" />
              offsite
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

      <Tabs defaultValue="leave" className="w-full">
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
          
          <OffsiteTable data={demoOffsiteData} />
        </TabsContent>
      </Tabs>
    </div>
  )
}