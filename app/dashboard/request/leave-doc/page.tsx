'use client'

import { useRef, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { usePendingDocLeaves, useAttachLeaveDocument } from '@/lib/use-leave-queries'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { FileText, Upload, X, Calendar, Send } from 'lucide-react'
import type { LeaveRequest } from '@/lib/types'

const statusLabel: Record<string, string> = {
  pending: 'ລໍຖ້າອະນຸມັດ',
  approved: 'ອະນຸມັດແລ້ວ',
}

function PendingDocCard({
  leave,
  userUuid,
}: {
  leave: LeaveRequest
  userUuid: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const attachDocument = useAttachLeaveDocument()

  const handleSubmit = async () => {
    if (!file) { toast.error('ກະລຸນາເລືອກໄຟລ໌ເອກະສານ'); return }
    try {
      const ext = file.name.split('.').pop() ?? 'file'
      const storageRef = ref(storage, `leaves/${userUuid}/${Date.now()}.${ext}`)
      const snapshot = await uploadBytes(storageRef, file)
      const docLink = await getDownloadURL(snapshot.ref)
      await attachDocument.mutateAsync({ leaveId: leave.id, docLink, userUuid })
      toast.success('ສົ່ງເອກະສານສຳເລັດ')
      setFile(null)
    } catch {
      toast.error('ສົ່ງເອກະສານລົ້ມເຫລວ ກະລຸນາລອງໃໝ່')
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
          <label
            htmlFor={`doc-file-${leave.id}`}
            className="block"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 cursor-pointer transition-colors active:bg-primary/10',
              file ? 'border-primary bg-primary/5' : 'border-input hover:bg-muted'
            )}>
              <Upload className="h-5 w-5 text-muted-foreground" />
              {file ? (
                <div className="text-center">
                  <p className="text-sm font-medium text-primary truncate max-w-[14rem]">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">ກົດເພື່ອເລືອກໄຟລ໌ເອກະສານ</p>
                  <p className="text-xs text-muted-foreground">PDF, JPG, PNG (ສູງສຸດ 10MB)</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                id={`doc-file-${leave.id}`}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </label>
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

        <Button
          type="button"
          className="w-full"
          size="sm"
          disabled={!file || attachDocument.isPending}
          onClick={handleSubmit}
        >
          {attachDocument.isPending ? <Spinner className="mr-2" /> : <Send className="mr-2 h-4 w-4" />}
          ສົ່ງເອກະສານ
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

      {isLoading ? (
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
            <PendingDocCard key={leave.id} leave={leave} userUuid={userUuid} />
          ))}
        </div>
      )}
    </div>
  )
}
