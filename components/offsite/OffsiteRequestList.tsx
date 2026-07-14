'use client'

// ** core
import { useState, Fragment } from 'react'

// ** assets / icons
import { Briefcase, Plus, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'

// ** shared components
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { OffsiteRequestRow, OffsiteRequestCard } from './OffsiteRequestRow'

// ** config / utils / types / hooks
import type { OffsiteRequestDoc } from '@/types/workOutside'

const PAGE_SIZE = 20

const TABLE_HEADERS = [
  { label: 'ເລກທີ', className: 'w-28' },
  { label: 'ປະເພດ', className: 'w-36' },
  { label: 'ຫົວຂໍ້', className: '' },
  { label: 'ວັນທີ', className: 'w-44' },
  { label: 'ຜູ້ຮ່ວມ', className: 'w-24' },
  { label: 'ສະຖານະ', className: 'w-24' },
  { label: '', className: 'w-12' },
]

interface Props {
  docs: OffsiteRequestDoc[]
  isLoading: boolean
  error: Error | null
  currentUid: string
  onCreateNew: () => void
  onView: (doc: OffsiteRequestDoc) => void
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
  onView,
  onEdit,
  onCancel,
  onRetry,
}: Props) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(docs.length / PAGE_SIZE))
  const pageDocs = docs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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
                  onView={onView}
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
            onView={onView}
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
  )
}
