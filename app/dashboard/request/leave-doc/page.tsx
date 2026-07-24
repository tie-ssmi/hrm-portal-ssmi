'use client'

// ** core
import { useState } from 'react'

// ** assets / icons
import { FileText, X, Calendar, Send } from 'lucide-react'

// ** shared components
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

// ** third party
import { toast } from 'sonner'

// ** config / utils / types / hooks
import { useAuth } from '@/lib/auth-context'
import { usePendingDocLeaves, useAttachLeaveDocument } from '@/lib/use-leave-queries'
import type { Employee, LeaveRequest } from '@/lib/types'

// ** services
import { uploadLeaveDocument } from '@/services/leaves'
import { extractWorkLocationLog } from '@/services/audit-log'

// ** components
import FileUpload from '@/components/fileUpload'

const statusLabel: Record<string, string> = {
  pending: 'ລໍຖ້າອະນຸມັດ',
  approved: 'ອະນຸມັດແລ້ວ',
}

function PendingDocCard({
  leave,
  userUuid,
  actor,
}: {
  leave: LeaveRequest
  userUuid: string
  actor: Employee | null
}) {
  const [file, setFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const attachDocument = useAttachLeaveDocument()

  const handleSubmit = async () => {
    if (!file) { toast.error('ກະລຸນາເລືອກໄຟລ໌ເອກະສານ'); return }
    try {
      setUploadProgress(0)
      const docLink = await uploadLeaveDocument(file, userUuid, setUploadProgress)
      await attachDocument.mutateAsync({
        leaveId: leave.id,
        docLink,
        userUuid,
        actorName:
          [actor?.firstNameLo || actor?.firstName, actor?.lastNameLo || actor?.lastName]
            .filter(Boolean).join(' ') || undefined,
        actorRoleUuid: actor?.rolesUid,
        actorRoleName: actor?.rolesName,
        workLocation: extractWorkLocationLog(actor?.workLocation),
      })
      toast.success('ສົ່ງເອກະສານສຳເລັດ')
      setFile(null)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'ສົ່ງເອກະສານລົ້ມເຫລວ ກະລຸນາລອງໃໝ່'
      toast.error(msg)
    } finally {
      setUploadProgress(null)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{leave.policyName || leave.type}</p>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 shrink-0" />
              <span>{leave.startDate} – {leave.endDate}</span>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0 text-xs">
            {statusLabel[leave.status] ?? leave.status}
          </Badge>
        </div>

        {leave.reason && (
          <p className="text-xs text-muted-foreground line-clamp-2">{leave.reason}</p>
        )}

        <div className="space-y-2">
          <FileUpload file={file} onFileSelect={setFile} />
          {file && (
            <button
              type="button"
              onClick={() => setFile(null)}
              className="flex items-center gap-1 text-xs text-destructive hover:underline"
            >
              <X className="h-3 w-3" /> ລຶບໄຟລ໌
            </button>
          )}
        </div>

        {uploadProgress !== null && (
          <div className="space-y-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-right text-xs text-muted-foreground">{uploadProgress}%</p>
          </div>
        )}

        <Button
          type="button"
          className="w-full"
          size="sm"
          disabled={!file || attachDocument.isPending || uploadProgress !== null}
          onClick={handleSubmit}
        >
          {uploadProgress !== null ? <Spinner className="mr-2" /> : <Send className="mr-2 h-4 w-4" />}
          {uploadProgress !== null ? `ກຳລັງສົ່ງ... ${uploadProgress}%` : 'ສົ່ງເອກະສານ'}
        </Button>
      </CardContent>
    </Card>
  )
}

export default function LeaveDocPage() {
  const { user } = useAuth()
  const userUuid = user?.uuid || user?.uid || ''
  const { data: leaves = [], isLoading } = usePendingDocLeaves(userUuid)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">ສົ່ງເອກະສານລາພັກ</h1>
        <p className="text-muted-foreground text-sm">ລາຍການລາພັກທີ່ທ່ານເລືອກສົ່ງເອກະສານພາຍຫຼັງ</p>
      </div>

      {!userUuid || isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Spinner /> ກຳລັງໂຫຼດ...
        </div>
      ) : leaves.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">ບໍ່ມີລາຍການທີ່ຕ້ອງສົ່ງເອກະສານ</p>
            <p className="text-xs text-muted-foreground">ລາຍການລາພັກທີ່ທ່ານເລືອກ &ldquo;ສົ່ງເອກະສານພາຍຫຼັງ&rdquo; ຈະສະແດງຢູ່ບ່ອນນີ້</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {leaves.map((leave) => (
            <PendingDocCard key={leave.id} leave={leave} userUuid={userUuid} actor={user} />
          ))}
        </div>
      )}
    </div>
  )
}
