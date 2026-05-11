'use client'

import { MoreHorizontal, Eye, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusBadge } from './StatusBadge'
import { ActivityTypeBadge } from './ActivityTypeBadge'
import { formatDateRange, formatKip } from '@/lib/format'
import type { OffsiteRequestDoc } from '@/types/workOutside'

interface Props {
  doc: OffsiteRequestDoc
  currentUid: string
  onView: (doc: OffsiteRequestDoc) => void
  onEdit: (doc: OffsiteRequestDoc) => void
  onCancel: (doc: OffsiteRequestDoc) => void
}

function AvatarGroup({ names, total }: { names: string[]; total: number }) {
  const shown = names.slice(0, 3)
  const extra = total - shown.length
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((name, i) => {
        const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
        return (
          <div
            key={i}
            title={name}
            className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold ring-1 ring-background shrink-0"
          >
            {initials}
          </div>
        )
      })}
      {extra > 0 && (
        <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-semibold ring-1 ring-background shrink-0">
          +{extra}
        </div>
      )}
    </div>
  )
}

// ── Desktop table row ──────────────────────────────────────────────────────

export function OffsiteRequestRow({ doc, currentUid, onView, onEdit, onCancel }: Props) {
  const isOwner = doc.createdByUid === currentUid
  const canModify = isOwner && doc.status === 'pending'
  const allNames = [doc.requester.fullNameLo, ...doc.teammate.map((t) => t.fullNameLo)]

  return (
    <tr className="border-b border-border hover:bg-muted/40 transition-colors">
      {/* requestNo */}
      <td className="px-3 py-3 align-top">
        <button
          onClick={() => onView(doc)}
          className="font-mono text-xs font-semibold text-primary hover:underline block"
          aria-label={`ເບິ່ງລາຍລະອຽດ ${doc.requestNo}`}
        >
          {doc.requestNo}
        </button>
        {isOwner ? (
          <span className="mt-0.5 inline-flex items-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0 text-[10px] font-medium">
            ຜູ້ສະເໜີ
          </span>
        ) : (
          <span className="mt-0.5 inline-flex items-center rounded-full bg-muted text-muted-foreground px-1.5 py-0 text-[10px] font-medium">
            ສະມາຊິກ
          </span>
        )}
      </td>

      {/* activity */}
      <td className="px-3 py-3 align-middle">
        <ActivityTypeBadge code={doc.activityType.code} />
      </td>

      {/* subject */}
      <td className="px-3 py-3 align-middle max-w-48">
        <p className="text-sm truncate" title={doc.subject}>
          {doc.subject}
        </p>
        {doc.customerName && (
          <p className="text-xs text-muted-foreground truncate">{doc.customerName}</p>
        )}
      </td>

      {/* date range */}
      <td className="px-3 py-3 align-middle whitespace-nowrap">
        <p className="text-sm">{formatDateRange(doc.startDate, doc.endDate)}</p>
        <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 font-medium">
          {doc.durationDays} ມື້
        </span>
      </td>

      {/* participants */}
      <td className="px-3 py-3 align-middle">
        <div className="flex flex-col gap-1">
          <AvatarGroup names={allNames} total={doc.participantCount} />
          <span className="text-xs text-muted-foreground">{doc.participantCount} ຄົນ</span>
        </div>
      </td>

      {/* status */}
      <td className="px-3 py-3 align-middle">
        <StatusBadge status={doc.status} />
      </td>

      {/* estimatedCost */}
      <td className="px-3 py-3 align-middle text-right whitespace-nowrap">
        <span className="text-sm font-medium">{formatKip(doc.estimatedCost)}</span>
      </td>

      {/* actions */}
      <td className="px-3 py-3 align-middle">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="ຕົວເລືອກ"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(doc)}>
              <Eye className="w-4 h-4 mr-2" />
              ເບິ່ງລາຍລະອຽດ
            </DropdownMenuItem>
            {canModify && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onEdit(doc)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  ແກ້ໄຂ
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onCancel(doc)}
                  className="text-destructive focus:text-destructive"
                >
                  <X className="w-4 h-4 mr-2" />
                  ຍົກເລີກ
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  )
}

// ── Mobile card ────────────────────────────────────────────────────────────

export function OffsiteRequestCard({ doc, currentUid, onView, onEdit, onCancel }: Props) {
  const isOwner = doc.createdByUid === currentUid
  const canModify = isOwner && doc.status === 'pending'

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <button
            onClick={() => onView(doc)}
            className="font-mono text-xs font-semibold text-primary hover:underline"
          >
            {doc.requestNo}
          </button>
          {isOwner ? (
            <span className="ml-1.5 inline-flex items-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 text-[10px] font-medium">
              ຜູ້ສະເໜີ
            </span>
          ) : (
            <span className="ml-1.5 inline-flex items-center rounded-full bg-muted text-muted-foreground px-1.5 text-[10px] font-medium">
              ສະມາຊິກ
            </span>
          )}
          <p className="text-sm font-medium mt-1 truncate">{doc.subject}</p>
          {doc.customerName && (
            <p className="text-xs text-muted-foreground truncate">{doc.customerName}</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="ຕົວເລືອກ">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(doc)}>
              <Eye className="w-4 h-4 mr-2" />
              ເບິ່ງລາຍລະອຽດ
            </DropdownMenuItem>
            {canModify && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onEdit(doc)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  ແກ້ໄຂ
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onCancel(doc)}
                  className="text-destructive focus:text-destructive"
                >
                  <X className="w-4 h-4 mr-2" />
                  ຍົກເລີກ
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        <ActivityTypeBadge code={doc.activityType.code} />
        <StatusBadge status={doc.status} />
        <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 font-medium">
          {doc.durationDays} ມື້
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatDateRange(doc.startDate, doc.endDate)}</span>
        <span className="font-medium text-foreground">{formatKip(doc.estimatedCost)}</span>
      </div>

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>{doc.participantCount} ຄົນ</span>
      </div>
    </div>
  )
}
