'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { doc, getDoc, updateDoc, type DocumentData } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
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
import { StatusBadge } from '@/components/offsite/StatusBadge'
import { ActivityTypeBadge } from '@/components/offsite/ActivityTypeBadge'
import { formatDateRange, formatKip, formatLaoDate } from '@/lib/format'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Banknote,
  Briefcase,
  Building2,
  CalendarRange,
  Check,
  FileText,
  Hash,
  MapPin,
  Users,
  X,
} from 'lucide-react'
import type { OffsiteRequestDoc } from '@/types/workOutside'

function InfoField({
  label,
  value,
  icon,
}: {
  label: string
  value: React.ReactNode
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-1.5 inline-flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-sm font-medium text-foreground">{value || '—'}</p>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="space-y-6 pb-8">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-32 rounded-lg" />
    </div>
  )
}

export default function OffsiteDetailClient() {
  const router = useRouter()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''

  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const { data: record, isLoading, error } = useQuery<OffsiteRequestDoc | null>({
    queryKey: ['workOutside', id],
    queryFn: async () => {
      if (!id) return null
      const snap = await getDoc(doc(db, 'workOutside', id))
      if (!snap.exists()) return null
      return { id: snap.id, ...snap.data() } as OffsiteRequestDoc
    },
    enabled: !!id,
  })

  const canApproveDept = user?.rolePermissions?.approveDepartment ?? false
  const canApproveBranch = user?.rolePermissions?.approveBranch ?? false
  const canAct = (canApproveDept || canApproveBranch) && record?.status === 'pending'

  async function handleConfirm() {
    if (!action || !confirmed || !record) return
    const reviewedBy = [user?.firstNameLo || user?.firstName, user?.lastNameLo || user?.lastName]
      .filter(Boolean).join(' ') || user?.uid || ''
    const now = new Date().toISOString()

    setIsProcessing(true)
    try {
      // Determine which approval entry belongs to the current approver's role
      const approvalRole = canApproveDept ? 'departmentHead' : 'manager'
      const approvalIndex = record.approvals.findIndex((ap) => ap.role === approvalRole)
      const decision = action === 'approve' ? 'approved' : 'rejected'

      const payload: Record<string, unknown> = {
        ...(decision === 'rejected' && { status: 'rejected' }),
        updatedAt: now,
        updatedBy: reviewedBy,
      }

      if (approvalIndex >= 0) {
        const updatedApprovals = record.approvals.map((ap, i) =>
          i === approvalIndex ? { ...ap, decision, reviewedBy, reviewedAt: now } : ap
        )
        payload.approvals = updatedApprovals
      }

      await updateDoc(doc(db, 'workOutside', record.id), payload as DocumentData)
      await queryClient.invalidateQueries({ queryKey: ['workOutside', id] })
      toast.success(action === 'approve' ? 'ອະນຸມັດສຳເລັດ' : 'ປະຕິເສດສຳເລັດ')
      setAction(null)
      setConfirmed(false)
    } catch {
      toast.error('ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່')
    } finally {
      setIsProcessing(false)
    }
  }

  if (isLoading) return <PageSkeleton />

  if (error || !record) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          ກັບຄືນ
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-semibold">ບໍ່ພົບຂໍ້ມູນ</p>
            <p className="mt-1 text-sm text-muted-foreground">ຄຳຂໍ ID: {id}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Button type="button" variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2 mb-1">
              <ArrowLeft className="mr-2 h-4 w-4" />
              ກັບຄືນ
            </Button>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-muted-foreground">{record.requestNo}</span>
              <ActivityTypeBadge code={record.activityType.code} />
              <StatusBadge status={record.status} />
            </div>
            <h1 className="text-xl font-bold mt-1">{record.subject}</h1>
          </div>

          {/* Approve / Reject buttons */}
          {canAct && (
            <div className="flex gap-2 shrink-0">
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={() => { setAction('reject'); setConfirmed(false) }}
              >
                <X className="w-4 h-4" />
                ປະຕິເສດ
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => { setAction('approve'); setConfirmed(false) }}
              >
                <Check className="w-4 h-4" />
                ອະນຸມັດ
              </Button>
            </div>
          )}
        </div>

        {/* Requester */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">ຜູ້ຍື່ນຄຳຂໍ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <InfoField
                label="ຊື່ ແລະ ນາມສະກຸນ"
                value={record.requester.fullNameLo || record.requester.fullNameEn}
                icon={<Users className="h-3.5 w-3.5" />}
              />
              <InfoField
                label="ຕໍາແໜ່ງ"
                value={record.requester.jobTitle}
                icon={<Briefcase className="h-3.5 w-3.5" />}
              />
              <InfoField
                label="ພະແນກ"
                value={record.requester.department.title || record.requester.department.department}
                icon={<Building2 className="h-3.5 w-3.5" />}
              />
            </div>
          </CardContent>
        </Card>

        {/* Trip Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">ລາຍລະອຽດການເດີນທາງ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <InfoField
                label="ສະຖານທີ່"
                value={record.location}
                icon={<MapPin className="h-3.5 w-3.5" />}
              />
              <InfoField
                label="ວັນທີ"
                value={`${formatDateRange(record.startDate, record.endDate)} (${record.durationDays} ມື້)`}
                icon={<CalendarRange className="h-3.5 w-3.5" />}
              />
              <InfoField
                label="ຄ່າໃຊ້ຈ່າຍ"
                value={formatKip(record.estimatedCost)}
                icon={<Banknote className="h-3.5 w-3.5" />}
              />
              {record.customerName && (
                <InfoField
                  label="ລູກຄ້າ / ຄູ່ຄ້າ"
                  value={record.customerName}
                  icon={<Users className="h-3.5 w-3.5" />}
                />
              )}
            </div>

            <Separator />

            <div className="rounded-lg border p-4">
              <p className="mb-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                ລາຍລະອຽດ
              </p>
              <p className="text-sm leading-6 whitespace-pre-wrap">{record.details || '—'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Teammates */}
        {record.teammate.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">ສະມາຊິກທີມ ({record.teammate.length} ຄົນ)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {record.teammate.map((tm) => (
                  <div key={tm.uid} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{tm.fullNameLo || tm.fullNameEn}</p>
                      <p className="text-xs text-muted-foreground">{tm.jobTitle}</p>
                    </div>
                    <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                      {tm.roleInTrip}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Approvals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">ສະຖານະການອະນຸມັດ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {record.approvals.map((ap) => {
                const roleLabel: Record<string, string> = {
                  departmentHead: 'ຫົວໜ້າພະແນກ',
                  hr: 'ຝ່າຍ HR',
                  manager: 'ຜູ້ຈັດການ',
                }
                return (
                  <div key={ap.role} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span className="text-sm">{roleLabel[ap.role] ?? ap.role}</span>
                    <StatusBadge status={ap.decision} />
                  </div>
                )
              })}
            </div>
            {record.rejectReason && (
              <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                ເຫດຜົນປະຕິເສດ: {record.rejectReason}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Meta */}
        <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground flex items-center gap-2">
          <Hash className="h-3.5 w-3.5 shrink-0" />
          {record.requestNo} · ສ້າງໂດຍ {record.createdBy} · {formatLaoDate(record.createdAt.slice(0, 10))}
        </div>
      </div>

      {/* Confirm Dialog */}
      <Dialog
        open={!!action}
        onOpenChange={(open) => { if (!open) { setAction(null); setConfirmed(false) } }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {action === 'approve' ? 'ຢືນຢັນການອະນຸມັດ' : 'ຢືນຢັນການປະຕິເສດ'}
            </DialogTitle>
            <DialogDescription>
              {action === 'approve' ? 'ອະນຸມັດ' : 'ປະຕິເສດ'}ຄຳຂໍ{' '}
              <span className="font-mono font-semibold">{record.requestNo}</span>
            </DialogDescription>
          </DialogHeader>

          <label
            htmlFor="confirm-action"
            className="flex items-start gap-3 cursor-pointer select-none rounded-lg border p-3 hover:bg-muted/50 transition-colors"
          >
            <Checkbox
              id="confirm-action"
              checked={confirmed}
              onCheckedChange={(v) => setConfirmed(v === true)}
              className="mt-0.5 shrink-0"
            />
            <span className="text-sm leading-relaxed">
              ຂ້ອຍໄດ້ກວດສອບຂໍ້ມູນແລ້ວ ແລະ ຢືນຢັນການ
              {action === 'approve' ? 'ອະນຸມັດ' : 'ປະຕິເສດ'}
            </span>
          </label>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isProcessing}>ຍົກເລີກ</Button>
            </DialogClose>
            <Button
              variant={action === 'reject' ? 'destructive' : 'default'}
              onClick={handleConfirm}
              disabled={!confirmed || isProcessing}
            >
              {isProcessing
                ? 'ກຳລັງດຳເນີນການ...'
                : action === 'approve' ? 'ອະນຸມັດ' : 'ປະຕິເສດ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
