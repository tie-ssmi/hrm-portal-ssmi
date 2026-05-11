import { Handshake, Users, Store, Megaphone, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { activityLabel } from '@/lib/format'
import type { ActivityCode } from '@/types/workOutside'

type IconComponent = React.ComponentType<{ className?: string }>

const ICON_MAP: Record<ActivityCode, IconComponent> = {
  MEET_CLIENT: Handshake,
  MEETING: Users,
  BOOTH: Store,
  PROMO: Megaphone,
  TRAINING: BookOpen,
}

const COLOR_MAP: Record<ActivityCode, string> = {
  MEET_CLIENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  MEETING: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  BOOTH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  PROMO: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  TRAINING: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
}

interface Props {
  code: ActivityCode
  className?: string
}

export function ActivityTypeBadge({ code, className }: Props) {
  const Icon = ICON_MAP[code]
  const colorClass = COLOR_MAP[code] ?? 'bg-muted text-muted-foreground'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        colorClass,
        className,
      )}
    >
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      {activityLabel(code)}
    </span>
  )
}
