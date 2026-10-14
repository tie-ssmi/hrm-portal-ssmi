// ** assets / icons
import {
  Handshake,
  Users,
  Store,
  Megaphone,
  Plus,
  Briefcase,
  Clock,
  GraduationCap,
  ClipboardCheck,
  MapPinned,
} from 'lucide-react'

// ** config / utils / types / hooks
import { cn } from '@/lib/utils'
import { activityLabel } from '@/lib/format'
import type { ActivityCode } from '@/types/workOutside'

type IconComponent = React.ComponentType<{ className?: string }>

const ICON_MAP: Record<ActivityCode, IconComponent> = {
  GENERAL: Briefcase,
  OVERTIME: Clock,
  TRAINING: GraduationCap,
  AUDIT: ClipboardCheck,
  VISIT: MapPinned,
  // Old 6-type codes, still on older requests
  MEET_CLIENT: Handshake,
  MEETING: Users,
  BOOTH: Store,
  PROMO: Megaphone,
  OTHERS: Plus,
}

const COLOR_MAP: Record<ActivityCode, string> = {
  GENERAL: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  OVERTIME: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  TRAINING: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  AUDIT: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  VISIT: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  MEET_CLIENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  MEETING: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  BOOTH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  PROMO: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  OTHERS: 'bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300',
}

interface Props {
  code: ActivityCode
  // The doc's stored activityType.name — shown when the code isn't one we
  // know, so an unexpected code never renders as a bare id.
  name?: string
  className?: string
}

export function ActivityTypeBadge({ code, name, className }: Props) {
  const Icon = ICON_MAP[code]
  const colorClass = COLOR_MAP[code] ?? 'bg-muted text-muted-foreground'
  const label = code in ICON_MAP ? activityLabel(code) : name || activityLabel(code)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        colorClass,
        className,
      )}
    >
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      {label}
    </span>
  )
}
