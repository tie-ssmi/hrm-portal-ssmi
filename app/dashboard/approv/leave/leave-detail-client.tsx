'use client'

// ** core
import { memo, useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// ** assets / icons
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarRange,
  CheckCircle2,
  ExternalLink,
  FileText,
  ShieldUser,
  Timer,
  UserRound,
  XCircle,
} from 'lucide-react'

// ** shared components
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'

// ** third party
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

// ** config / utils / types / hooks
import { useAuth } from '@/lib/auth-context'
import type { LeaveApprovalStep, LeaveApproverRole } from '@/lib/types'

// ** services
import { fetchLeaveById, updateLeaveApproval } from '@/services/leaves'

const roleLabel: Record<LeaveApproverRole, string> = {
  departmentHead: 'ຫົວໜ້າພະແນກ',
  hr: 'ຝ່າຍ HR',
  manager: 'ຜູ້ຈັດການ',
}

const periodLabel: Record<string, string> = {
  morning: 'ເຊົ້າ',
  afternoon: 'ບ່າຍ',
  monning: 'ເຊົ້າ',
}

function canActForRole(role: LeaveApproverRole, permissions: Record<string, boolean> | undefined): boolean {
  if (!permissions) return false
  if (role === 'departmentHead') return !!permissions.approveDepartment
  if (role === 'manager') return !!permissions.approveBranch
  if (role === 'hr') return !!permissions.manageLeave
  return false
}

const ICON_USER_ROUND = <UserRound className="h-4 w-4" />
const ICON_BRIEFCASE = <Briefcase className="h-4 w-4" />
const ICON_BUILDING2 = <Building2 className="h-4 w-4" />
const ICON_SHIELD_USER = <ShieldUser className="h-4 w-4" />
const ICON_CALENDAR_RANGE = <CalendarRange className="h-4 w-4" />
const ICON_TIMER = <Timer className="h-4 w-4" />

const ApprovalStepRow = memo(function ApprovalStepRow({
  step, index, total,
}: {
  step: LeaveApprovalStep
  index: number
  total: number
}) {
  const isApproved = step.decision === 'approved'
  const isRejected = step.decision === 'rejected'
  const isPending = step.decision === 'pending'

  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold
          ${isApproved ? 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-950' : ''}
          ${isRejected ? 'border-destructive bg-destructive/10 text-destructive' : ''}
          ${isPending ? 'border-muted-foreground/30 bg-muted text-muted-foreground' : ''}
        `}>
          {isApproved ? <CheckCircle2 className="h-4 w-4" /> : isRejected ? <XCircle className="h-4 w-4" /> : <span>{index + 1}</span>}
        </div>
        {index < total - 1 && <div className={`mt-1 h-6 w-0.5 ${isApproved ? 'bg-emerald-300' : 'bg-muted'}`} />}
      </div>

      <div className="flex-1 pb-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{roleLabel[step.role]}</p>
          <Badge
            variant={isApproved ? 'default' : isRejected ? 'destructive' : 'secondary'}
            className={`text-xs ${isApproved ? 'bg-emerald-600 hover:bg-emerald-600' : ''}`}
          >
            {isApproved ? 'ອະນຸມັດແລ້ວ' : isRejected ? 'ປະຕິເສດ' : 'ລໍຖ້າ'}
          </Badge>
        </div>
        {step.reviewedBy && <p className="mt-0.5 text-xs text-muted-foreground">ໂດຍ: {step.reviewedBy}</p>}
        {step.reviewedAt && (
          <p className="text-xs text-muted-foreground">
            {new Date(step.reviewedAt).toLocaleDateString('lo-LA', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        )}
        {isRejected && step.rejectReason && (
          <p className="mt-0.5 text-xs text-destructive/80">ເຫດຜົນ: {step.rejectReason}</p>
        )}
        {isPending && <p className="mt-0.5 text-xs text-muted-foreground/60">ຍັງບໍ່ໄດ້ດຳເນີນການ</p>}
      </div>
    </div>
  )
})

const InfoRow = memo(function InfoRow({
  icon, label, value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground break-words">{value || '-'}</p>
      </div>
    </div>
  )
})

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  )
}

export default function LeaveDetailClient({ leaveId }: { leaveId?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const id = useMemo(
    () => leaveId || searchParams.get('id') || '',
    [leaveId, searchParams],
  )

  const { data: leave, isLoading } = useQuery({
    queryKey: ['leave', id],
    queryFn: () => fetchLeaveById(id),
    enabled: !!id,
  })

  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { pendingIndex, canAct } = useMemo(() => {
    const pendingStep = leave?.approvals?.find((a) => a?.decision === 'pending')
    const pendingIndex = leave?.approvals?.findIndex((a) => a?.decision === 'pending') ?? -1
    const canAct =
      leave?.status === 'pending' &&
      !!pendingStep &&
      canActForRole(pendingStep.role, user?.rolePermissions as Record<string, boolean> | undefined)
    return { pendingIndex, canAct }
  }, [leave, user])

  const { reviewedBy, reviewedByUid } = useMemo(() => ({
    reviewedBy: [user?.firstNameLo || user?.firstName, user?.lastNameLo || user?.lastName]
      .filter(Boolean).join(' ') || user?.uid || user?.id || '',
    reviewedByUid: user?.uid || user?.id || '',
  }), [user])

  const { validApprovals, startLabel, endLabel } = useMemo(() => {
    if (!leave) return { validApprovals: [], startLabel: '', endLabel: '' }
    return {
      validApprovals: (leave.approvals ?? []).filter((a): a is LeaveApprovalStep => !!a),
      startLabel: periodLabel[leave.startPeriod ?? ''] ?? '',
      endLabel: periodLabel[leave.endPeriod ?? ''] ?? '',
    }
  }, [leave])

  const handleBack = useCallback(() => router.back(), [router])
  const handleOpenApprove = useCallback(() => setApproveOpen(true), [])
  const handleOpenReject = useCallback(() => setRejectOpen(true), [])

  const handleApproveDialogChange = useCallback((o: boolean) => {
    setApproveOpen(o)
    if (!o) setConfirmChecked(false)
  }, [])

  const handleRejectDialogChange = useCallback((o: boolean) => {
    setRejectOpen(o)
    if (!o) setRejectReason('')
  }, [])

  const handleConfirmCheckedChange = useCallback((v: boolean | 'indeterminate') => {
    setConfirmChecked(v === true)
  }, [])

  const handleRejectReasonChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setRejectReason(e.target.value)
  }, [])

  const handleConfirmApprove = useCallback(async () => {
    if (!leave || !confirmChecked) return
    setIsSubmitting(true)
    try {
      await updateLeaveApproval({ leaveId: leave.id, approvalIndex: pendingIndex, decision: 'approved', reviewedBy, reviewedByUid })
      await queryClient.invalidateQueries({ queryKey: ['leave', id] })
      await queryClient.invalidateQueries({ queryKey: ['leaves'] })
      toast.success('ອະນຸມັດສຳເລັດ')
      setApproveOpen(false)
      setConfirmChecked(false)
    } catch {
      toast.error('ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່')
    } finally {
      setIsSubmitting(false)
    }
  }, [leave, confirmChecked, pendingIndex, reviewedBy, reviewedByUid, queryClient, id])

  const handleConfirmReject = useCallback(async () => {
    if (!leave) return
    setIsSubmitting(true)
    try {
      await updateLeaveApproval({
        leaveId: leave.id,
        approvalIndex: pendingIndex,
        decision: 'rejected',
        reviewedBy,
        reviewedByUid,
        rejectReason: rejectReason.trim() || undefined,
      })
      await queryClient.invalidateQueries({ queryKey: ['leave', id] })
      await queryClient.invalidateQueries({ queryKey: ['leaves'] })
      toast.success('ປະຕິເສດສຳເລັດ')
      setRejectOpen(false)
      setRejectReason('')
    } catch {
      toast.error('ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່')
    } finally {
      setIsSubmitting(false)
    }
  }, [leave, pendingIndex, reviewedBy, reviewedByUid, rejectReason, queryClient, id])

  if (isLoading) return <DetailSkeleton />

  if (!leave) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="outline" size="sm" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> ກັບຄືນ
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-semibold">ບໍ່ພົບຂໍ້ມູນ</p>
            <p className="mt-1 text-sm text-muted-foreground">ID: {id}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const overallStatus = leave.status

  return (
    <>
      <div className="space-y-4 pb-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">ລາຍລະອຽດຄໍາຂໍລາພັກ</p>
            <h1 className="text-lg font-bold leading-tight truncate">{leave.leaveUserName || leave.createdBy}</h1>
          </div>
          <Badge
            variant={overallStatus === 'approved' ? 'default' : overallStatus === 'rejected' ? 'destructive' : 'secondary'}
            className={`shrink-0 ${overallStatus === 'approved' ? 'bg-emerald-600 hover:bg-emerald-600' : ''}`}
          >
            {overallStatus === 'approved' ? 'ອະນຸມັດແລ້ວ' : overallStatus === 'rejected' ? 'ປະຕິເສດ' : 'ລໍຖ້າອະນຸມັດ'}
          </Badge>
        </div>

        {/* Leave Type Banner */}
        <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/8 to-background p-4">
          <p className="text-xs text-muted-foreground">ປະເພດລາພັກ</p>
          <p className="mt-0.5 text-base font-semibold text-foreground">{leave.policyName || leave.type}</p>
          {leave.createdAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              ຍື່ນວັນທີ: {new Date(leave.createdAt).toLocaleDateString('lo-LA', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <InfoRow icon={ICON_USER_ROUND} label="ພະນັກງານ" value={leave.leaveUserName || leave.createdBy || ''} />
          <InfoRow icon={ICON_BRIEFCASE} label="ຕໍາແໜ່ງ" value={leave.jobTitle || ''} />
          <InfoRow icon={ICON_BUILDING2} label="ພະແນກ" value={leave.departmentNameLo || leave.departmentNameEn || ''} />
          <InfoRow icon={ICON_SHIELD_USER} label="ຜູ້ຮັບວຽກຕໍ່" value={leave.successorNameLo || leave.successorNameEn || ''} />
          <InfoRow
            icon={ICON_CALENDAR_RANGE}
            label="ວັນເລີ່ມ"
            value={`${leave.startDate}${startLabel ? ` (${startLabel})` : ''}`}
          />
          <InfoRow
            icon={ICON_CALENDAR_RANGE}
            label="ວັນສິ້ນສຸດ"
            value={`${leave.endDate}${endLabel ? ` (${endLabel})` : ''}`}
          />
          <div className="col-span-2">
            <InfoRow
              icon={ICON_TIMER}
              label="ຈຳນວນວັນ"
              value={leave.duration != null ? (leave.duration === 0.5 ? '0.5 ວັນ' : `${leave.duration} ວັນ`) : '-'}
            />
          </div>
        </div>

        {/* Reason */}
        <div className="rounded-lg border p-3">
          <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5" /> ເຫດຜົນ
          </p>
          <p className="text-sm leading-6 text-foreground">{leave.reason || '-'}</p>
        </div>

        {/* Document */}
        {(leave.docStatus === 'now' || leave.docLink) && (
          leave.docLink ? (
            <a href={leave.docLink} target="_blank" rel="noopener noreferrer">
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary hover:bg-primary/10 transition-colors">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">ເບິ່ງເອກະສານທີ່ແນບ</span>
                <ExternalLink className="h-4 w-4 shrink-0" />
              </div>
            </a>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/30 p-3 text-sm text-muted-foreground">
              <FileText className="h-4 w-4 shrink-0" />
              <span>ເອກະສານຖືກແນບມາ (ລໍຖ້າໂຫລດ...)</span>
            </div>
          )
        )}

        {/* Approval Timeline */}
        {validApprovals.length > 0 && (
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">ຂັ້ນຕອນການອະນຸມັດ</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 px-4 pb-2">
              {validApprovals.map((step, i) => (
                <ApprovalStepRow key={step.role} step={step} index={i} total={validApprovals.length} />
              ))}
            </CardContent>
          </Card>
        )}

        {canAct && (
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleOpenReject}
              disabled={isSubmitting}
            >
              <XCircle className="h-4 w-4" /> ປະຕິເສດ
            </Button>
            <Button
              type="button"
              className="flex-1 gap-2"
              onClick={handleOpenApprove}
              disabled={isSubmitting}
            >
              <CheckCircle2 className="h-4 w-4" /> ອະນຸມັດ
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground/40">ID: {leave.id}</p>
      </div>

      {/* Approve Dialog */}
      <Dialog open={approveOpen} onOpenChange={handleApproveDialogChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ຢືນຢັນການອະນຸມັດ</DialogTitle>
            <DialogDescription>
              ອະນຸມັດຄໍາຮ້ອງຂໍຂອງ <strong>{leave.leaveUserName || leave.createdBy}</strong>
            </DialogDescription>
          </DialogHeader>
          <label htmlFor="detail-confirm-approve" className="flex cursor-pointer select-none items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
            <Checkbox
              id="detail-confirm-approve"
              checked={confirmChecked}
              onCheckedChange={handleConfirmCheckedChange}
              className="mt-0.5 shrink-0"
            />
            <span className="text-sm leading-relaxed">ຂ້ອຍໄດ້ກວດສອບຂໍ້ມູນແລ້ວ ແລະ ຢືນຢັນການອະນຸມັດ</span>
          </label>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isSubmitting}>ຍົກເລີກ</Button>
            </DialogClose>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConfirmApprove}
              disabled={!confirmChecked || isSubmitting}
            >
              {isSubmitting ? 'ກຳລັງອະນຸມັດ...' : 'ອະນຸມັດ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={handleRejectDialogChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ຢືນຢັນການປະຕິເສດ</DialogTitle>
            <DialogDescription>
              ປະຕິເສດຄໍາຮ້ອງຂໍຂອງ <strong>{leave.leaveUserName || leave.createdBy}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">ເຫດຜົນການປະຕິເສດ (ທາງເລືອກ)</p>
            <Textarea
              placeholder="ລະບຸເຫດຜົນ..."
              value={rejectReason}
              onChange={handleRejectReasonChange}
              rows={3}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isSubmitting}>ຍົກເລີກ</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'ກຳລັງດຳເນີນການ...' : 'ປະຕິເສດ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
