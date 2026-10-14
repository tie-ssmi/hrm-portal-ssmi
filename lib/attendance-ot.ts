// Client mirror of functions/src/attendance-ot.ts — decides whether to show
// the OT tab. The server re-checks with its own copy before any punch, so
// this one only affects what the page offers. Keep the two in step.

type OTRequestLike = {
  formType?: string
  status?: string
  startDate?: string
  endDate?: string
  startTime?: string
  teammate?: ({ uid?: string } | null)[]
}

export function pickTodayOTRequest<T extends OTRequestLike>(
  requests: T[],
  uid: string,
  isoDate: string,
): T | null {
  const matches = requests.filter(
    (r) =>
      r.formType === 'overtime' &&
      r.status === 'approved' &&
      !!r.startDate &&
      r.startDate <= isoDate &&
      isoDate <= (r.endDate || r.startDate) &&
      (r.teammate ?? []).some((t) => t?.uid === uid),
  )
  matches.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
  return matches[0] ?? null
}
