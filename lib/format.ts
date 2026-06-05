import { parseISO } from 'date-fns'
import type { ActivityCode } from '@/types/workOutside'

const LAO_MONTHS: Record<number, string> = {
  1: 'ມ.ກ', 2: 'ກ.ພ', 3: 'ມ.ນ', 4: 'ເມ.ຍ',
  5: 'ພ.ພ', 6: 'ມິ.ຖ', 7: 'ກ.ລ', 8: 'ສ.ຫ',
  9: 'ກ.ຍ', 10: 'ຕ.ລ', 11: 'ພ.ຈ', 12: 'ທ.ວ',
}

export function formatLaoDate(isoDate: string): string {
  const d = parseISO(isoDate)
  return `${d.getDate()} ${LAO_MONTHS[d.getMonth() + 1]} ${d.getFullYear()}`
}

export function formatDateRange(start: string, end: string): string {
  if (start === end) return formatLaoDate(start)
  const s = parseISO(start)
  const e = parseISO(end)
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()} - ${e.getDate()} ${LAO_MONTHS[e.getMonth() + 1]} ${e.getFullYear()}`
  }
  return `${formatLaoDate(start)} – ${formatLaoDate(end)}`
}

export function formatKip(amount: number): string {
  return `${amount.toLocaleString('en-US')} ກີບ`
}

export function formatKipText(amount: number): string {
  return amount >= 1000000 ? `${(amount / 1000000).toLocaleString('en-US', { maximumFractionDigits: 2 })} ລ້ານ` : `${amount.toLocaleString('en-US')} ກີບ`
}

export function formatMonthKey(mk: string): string {
  const [m, y] = mk.split('-')
  const monthMap: Record<string, string> = {
    '01': 'ມ.ກ', '02': 'ກ.ພ', '03': 'ມ.ນ', '04': 'ເມ.ຍ',
    '05': 'ພ.ພ', '06': 'ມິ.ຖ', '07': 'ກ.ລ', '08': 'ສ.ຫ',
    '09': 'ກ.ຍ', '10': 'ຕ.ລ', '11': 'ພ.ຈ', '12': 'ທ.ວ',
  }
  return `${monthMap[m] ?? m} ${y}`
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'pending': return 'ລໍຖ້າ'
    case 'approved': return 'ອະນຸມັດ'
    case 'rejected': return 'ປະຕິເສດ'
    case 'cancelled': return 'ຍົກເລີກ'
    default: return status
  }
}

export function activityLabel(code: ActivityCode | string): string {
  switch (code) {
    case 'MEET_CLIENT': return 'ພົບລູກຄ້າ'
    case 'MEETING': return 'ປະຊຸມພາຍນອກ'
    case 'BOOTH': return 'ອອກບູດງານ'
    case 'PROMO': return 'ໂປຣໂມຊັນ'
    case 'TRAINING': return 'ຝຶກອົບຮົມ'
    default: return code
  }
}
