'use client'

// ** assets / icons
import { Search, X } from 'lucide-react'

// ** shared components
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ** config / utils / types / hooks
import { formatMonthKey } from '@/lib/format'
import type { OffsiteFilters } from '@/hooks/useMyOffsiteRequests'
import type { ActivityCode } from '@/types/workOutside'

const ACTIVITY_OPTIONS: { code: ActivityCode; label: string }[] = [
  { code: 'MEET_CLIENT', label: 'ພົບລູກຄ້າ' },
  { code: 'MEETING', label: 'ປະຊຸມພາຍນອກ' },
  { code: 'BOOTH', label: 'ອອກບູດງານ' },
  { code: 'PROMO', label: 'ໂປຣໂມຊັນ' },
  { code: 'TRAINING', label: 'ຝຶກອົບຮົມ' },
]

interface Props {
  filters: OffsiteFilters
  onFiltersChange: (f: OffsiteFilters) => void
  availableMonths: string[]
}

export function OffsiteListFilterBar({ filters, onFiltersChange, availableMonths }: Props) {
  const hasActive =
    !!filters.status || !!filters.activityCode || !!filters.monthKey || !!filters.search

  function set<K extends keyof OffsiteFilters>(key: K, value: OffsiteFilters[K]) {
    onFiltersChange({ ...filters, [key]: value })
  }

  function clearAll() {
    onFiltersChange({ status: '', activityCode: '', monthKey: '', search: '' })
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Select
        value={filters.status || '_all'}
        onValueChange={(v) => set('status', v === '_all' ? '' : v)}
      >
        <SelectTrigger className="w-32 h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">ທັງໝົດ</SelectItem>
          <SelectItem value="pending">ລໍຖ້າ</SelectItem>
          <SelectItem value="approved">ອະນຸມັດ</SelectItem>
          <SelectItem value="rejected">ປະຕິເສດ</SelectItem>
          <SelectItem value="cancelled">ຍົກເລີກ</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.activityCode || '_all'}
        onValueChange={(v) => set('activityCode', v === '_all' ? '' : v)}
      >
        <SelectTrigger className="w-40 h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">ທຸກປະເພດ</SelectItem>
          {ACTIVITY_OPTIONS.map((o) => (
            <SelectItem key={o.code} value={o.code}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.monthKey || '_all'}
        onValueChange={(v) => set('monthKey', v === '_all' ? '' : v)}
      >
        <SelectTrigger className="w-28 h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">ທຸກເດືອນ</SelectItem>
          {availableMonths.map((mk) => (
            <SelectItem key={mk} value={mk}>
              {formatMonthKey(mk)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative flex-1 min-w-44">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder="ຄົ້ນຫາ ຫົວຂໍ້, ລູກຄ້າ, ເລກທີ..."
          className="pl-8 h-9"
          aria-label="ຄົ້ນຫາ"
        />
      </div>

      {hasActive && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="h-9 gap-1 text-muted-foreground"
          aria-label="ລ້າງ filter"
        >
          <X className="w-4 h-4" />
          ລ້າງ
        </Button>
      )}
    </div>
  )
}
