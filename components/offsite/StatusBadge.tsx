// ** config / utils / types / hooks
import { cn } from '@/lib/utils'
import { statusLabel } from '@/lib/format'

interface Props {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: Props) {
  const colorClass =
    status === 'approved'
      ? 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
      : status === 'rejected'
        ? 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
        : status === 'cancelled'
          ? 'bg-muted text-muted-foreground border border-border'
          : 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        colorClass,
        className,
      )}
    >
      {statusLabel(status)}
    </span>
  )
}
