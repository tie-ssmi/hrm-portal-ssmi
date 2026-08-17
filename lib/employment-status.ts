import type { EmploymentStatus, EmploymentStatusEntry } from '@/lib/types'

// Mirrors HRM-System-SSMI/functions/src/index.ts resolveEmploymentStatusV2 —
// same priority order, so both apps agree on an employee's tier: stamped
// employmentStatus field (kept in sync by the admin repo's Cloud Function
// trigger) > a single open statusHistory entry (race-condition fallback,
// trigger hasn't run yet) > derive from the legacy employeeType field
// (employee never migrated to statusHistory at all).
function findOpenStatusEntry(history?: EmploymentStatusEntry[]): EmploymentStatusEntry | null {
  const open = history?.filter((h) => h.to === null) ?? []
  return open.length === 1 ? open[0] : null
}

function deriveEmploymentStatusFromType(employeeType?: string): EmploymentStatus {
  if (employeeType === 'Intern') return 'intern'
  if (employeeType === '95') return 'probation95'
  return 'permanent'
}

export function resolveEmployeeEmploymentStatus(employee: {
  employmentStatus?: string
  statusHistory?: EmploymentStatusEntry[]
  employeeType?: string
}): EmploymentStatus {
  if (employee.employmentStatus) return employee.employmentStatus as EmploymentStatus
  const open = findOpenStatusEntry(employee.statusHistory)
  if (open?.status) return open.status as EmploymentStatus
  return deriveEmploymentStatusFromType(employee.employeeType)
}

function monthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  if (to.getDate() < from.getDate()) months -= 1
  return Math.max(0, months)
}

function formatYearsMonths(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  if (years === 0) return `${months} ເດືອນ`
  if (months === 0) return `${years} ປີ`
  return `${years} ປີ ${months} ເດືອນ`
}

// "ອາຍຸການ" label for the profile page — duration since the employee's
// CURRENT statusHistory stage began (e.g. "ຝຶກງານ 2 ເດືອນ", "95 1 ເດືອນ",
// "2 ປີ 1 ເດືອນ" once permanent), not total career tenure.
export function resolveTenureLabel(
  employee: { statusHistory?: EmploymentStatusEntry[] },
  now: Date = new Date(),
): string | null {
  const history = employee.statusHistory
  if (!history?.length) return null
  const open = findOpenStatusEntry(history)
  if (!open) return null

  const fromDate = new Date(open.from)
  if (Number.isNaN(fromDate.getTime())) return null
  const duration = formatYearsMonths(monthsBetween(fromDate, now))

  if (open.status === 'intern') return `ຝຶກງານ ${duration}`
  if (open.status === 'probation95') return `95 : ${duration}`
  return duration
}
