'use client'

import { useState, Fragment } from 'react'
import { Briefcase, Plus, RefreshCw, ChevronLeft, ChevronRight, MapPin, CalendarDays, Users, Banknote, FileText, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { OffsiteRequestRow, OffsiteRequestCard } from './OffsiteRequestRow'
import { StatusBadge } from './StatusBadge'
import { ActivityTypeBadge } from './ActivityTypeBadge'
import { formatDateRange, formatKip } from '@/lib/format'
import type { OffsiteRequestDoc } from '@/types/workOutside'

const PAGE_SIZE = 20

const TABLE_HEADERS = [
  { label: 'ເລກທີ', className: 'w-28' },
  { label: 'ປະເພດ', className: 'w-36' },
  { label: 'ຫົວຂໍ້', className: '' },
  { label: 'ວັນທີ', className: 'w-44' },
  { label: 'ຜູ້ຮ່ວມ', className: 'w-24' },
  { label: 'ສະຖານະ', className: 'w-24' },
  { label: 'ຄ່າໃຊ້ຈ່າຍ', className: 'w-32 text-right' },
  { label: '', className: 'w-12' },
]

interface Props {
  docs: OffsiteRequestDoc[]
  isLoading: boolean
  error: Error | null
  currentUid: string
  onCreateNew: () => void
  onEdit: (doc: OffsiteRequestDoc) => void
  onCancel: (doc: OffsiteRequestDoc) => void
  onRetry: () => void
}

function SkeletonRows() {
  return (
    <>
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {TABLE_HEADERS.map((h, i) => (
                <th key={i} className={`px-3 py-2.5 text-left text-xs font-medium text-muted-foreground ${h.className}`}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-border">
                <td className="px-3 py-3"><Skeleton className="h-4 w-24" /></td>
                <td className="px-3 py-3"><Skeleton className="h-5 w-28 rounded-full" /></td>
                <td className="px-3 py-3"><Skeleton className="h-4 w-40" /></td>
                <td className="px-3 py-3"><Skeleton className="h-4 w-32" /></td>
                <td className="px-3 py-3"><Skeleton className="h-6 w-16 rounded-full" /></td>
                <td className="px-3 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                <td className="px-3 py-3 text-right"><Skeleton className="h-4 w-24 ml-auto" /></td>
                <td className="px-3 py-3"><Skeleton className="h-8 w-8 rounded-md" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sm:hidden space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </>
  )
}

export function OffsiteRequestList({
  docs,
  isLoading,
  error,
  currentUid,
  onCreateNew,
  onEdit,
  onCancel,
  onRetry,
}: Props) {
  const [page, setPage] = useState(1)
  const [viewDoc, setViewDoc] = useState<OffsiteRequestDoc | null>(null)

  const totalPages = Math.max(1, Math.ceil(docs.length / PAGE_SIZE))
  const pageDocs = docs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleView(doc: OffsiteRequestDoc) {
    setViewDoc(doc)
  }

  if (isLoading) return <SkeletonRows />

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 flex items-center justify-between gap-4">
        <p className="text-sm text-destructive">ໂຫຼດຂໍ້ມູນລົ້ມເຫລວ: {error.message}</p>
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5 shrink-0">
          <RefreshCw className="w-3.5 h-3.5" />
          ລອງໃໝ່
        </Button>
      </div>
    )
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Briefcase className="w-8 h-8 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-base font-semibold">ຍັງບໍ່ມີຄຳຂໍ</h3>
          <p className="text-sm text-muted-foreground mt-1">
            ກົດປຸ່ມລຸ່ມເພື່ອສ້າງຄຳຂໍອອກປະຕິບັດງານນອກສະຖານທີ່
          </p>
        </div>
        <Button onClick={onCreateNew} className="gap-2 mt-2">
          <Plus className="w-4 h-4" />
          ສ້າງຄຳຂໍໃໝ່
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {TABLE_HEADERS.map((h, i) => (
                  <th
                    key={i}
                    className={`px-3 py-2.5 text-left text-xs font-medium text-muted-foreground ${h.className}`}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageDocs.map((doc) => (
                <Fragment key={doc.id}>
                  <OffsiteRequestRow
                    doc={doc}
                    currentUid={currentUid}
                    onView={handleView}
                    onEdit={onEdit}
                    onCancel={onCancel}
                  />
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden space-y-3">
          {pageDocs.map((doc) => (
            <OffsiteRequestCard
              key={doc.id}
              doc={doc}
              currentUid={currentUid}
              onView={handleView}
              onEdit={onEdit}
              onCancel={onCancel}
            />
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              ກ່ອນໜ້າ
            </Button>
            <span className="text-sm text-muted-foreground">
              ໜ້າ {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="gap-1"
            >
              ຕໍ່ໄປ
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* View detail popup */}
      <Dialog open={!!viewDoc} onOpenChange={(open) => { if (!open) setViewDoc(null) }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {viewDoc && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-semibold text-primary">{viewDoc.requestNo}</span>
                  <StatusBadge status={viewDoc.status} />
                </div>
                <DialogTitle className="text-base mt-1">{viewDoc.subject}</DialogTitle>
                {viewDoc.customerName && (
                  <p className="text-sm text-muted-foreground">{viewDoc.customerName}</p>
                )}
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {/* Activity + duration */}
                <div className="flex items-center gap-2 flex-wrap">
                  <ActivityTypeBadge code={viewDoc.activityType.code} />
                  <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-medium">
                    {viewDoc.durationDays} ມື້
                  </span>
                </div>

                <Separator />

                {/* Info rows */}
                <div className="space-y-3">
                  <InfoRow icon={CalendarDays} label="ວັນທີ">
                    {formatDateRange(viewDoc.startDate, viewDoc.endDate)}
                  </InfoRow>
                  <InfoRow icon={MapPin} label="ສະຖານທີ່">
                    {viewDoc.location || '—'}
                  </InfoRow>
                  <InfoRow icon={User} label="ຜູ້ສະເໜີ">
                    {viewDoc.requester.fullNameLo || viewDoc.requester.fullNameEn}
                  </InfoRow>
                  {viewDoc.details && (
                    <InfoRow icon={FileText} label="ລາຍລະອຽດ">
                      {viewDoc.details}
                    </InfoRow>
                  )}
                  <InfoRow icon={Banknote} label="ຄ່າໃຊ້ຈ່າຍ">
                    {formatKip(viewDoc.estimatedCost)}
                  </InfoRow>
                </div>

                {/* Teammates */}
                {viewDoc.teammate.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">ທີມງານ ({viewDoc.participantCount} ຄົນ)</span>
                      </div>
                      <div className="space-y-1.5">
                        {viewDoc.teammate.map((t) => (
                          <div key={t.uid} className="flex items-center justify-between text-sm">
                            <span>{t.fullNameLo || t.fullNameEn}</span>
                            <span className="text-xs text-muted-foreground">{t.roleInTrip}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Reject reason */}
                {viewDoc.status === 'rejected' && viewDoc.rejectReason && (
                  <>
                    <Separator />
                    <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                      <p className="text-xs font-medium text-destructive mb-1">ເຫດຜົນປະຕິເສດ</p>
                      <p className="text-sm">{viewDoc.rejectReason}</p>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3">
      <div className="flex items-start gap-1.5 w-28 shrink-0">
        <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm flex-1">{children}</span>
    </div>
  )
}
