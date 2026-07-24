import { collection, getDocs, limit, orderBy, query, where, type QueryConstraint } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import app, { db } from '@/lib/firebase'
import type { AuditLog, WorkLocationInfo } from '@/lib/types'

let _fns: ReturnType<typeof getFunctions> | null = null
function fns() {
  if (!_fns) _fns = getFunctions(app, 'asia-southeast1')
  return _fns
}

// Employee.workLocation is either a plain string (legacy data, no structured
// info to log) or the full WorkLocationInfo object — only the latter has
// enough to fill AuditLog.workLocation.
export function extractWorkLocationLog(
  workLocation: string | WorkLocationInfo | undefined | null,
): { code?: string; nameLo?: string; uuid?: string } | undefined {
  if (!workLocation || typeof workLocation === 'string') return undefined
  const { code, nameLo, uuid } = workLocation
  if (!code && !nameLo && !uuid) return undefined
  return { code, nameLo, uuid }
}

// actorUid is accepted here for call-site convenience (matches AuditLog shape)
// but the Cloud Function ignores it and stamps the real one from the verified
// auth token instead — a client can't forge who an entry is attributed to.
// before/after stay optional here for callers (e.g. login/logout, or a plain
// create with no prior state) — logAudit() normalizes them to {} so every
// stored AuditLog document always has both fields present.
export type AuditLogInput = Omit<AuditLog, 'id' | 'createdAt' | 'userAgent' | 'requestUrl' | 'ipAddress' | 'systemType' | 'before' | 'after'> & {
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}

function diffChangedFields(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return Array.from(keys).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
}

// Best-effort — a failed audit write must never block the action it's logging,
// so failures are swallowed here rather than thrown back to the caller. Routed
// through logAuditEvent (Cloud Function) rather than a direct Firestore write
// so ipAddress/userAgent come from the real request and actorUid can't be spoofed.
export async function logAudit(entry: AuditLogInput): Promise<void> {
  try {
    const before = entry.before ?? {}
    const after = entry.after ?? {}
    const changedFields = entry.changedFields ?? diffChangedFields(before, after)

    const { actorUid: _ignoredActorUid, ...rest } = entry

    const payload = {
      ...rest,
      before,
      after,
      changedFields,
      requestUrl: typeof window !== 'undefined' ? window.location.pathname : undefined,
    }

    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined)
    )

    const logAuditEvent = httpsCallable(fns(), 'logAuditEvent')
    await logAuditEvent(cleanPayload)
  } catch (error) {
    console.error('Audit log write failed:', error)
  }
}

export async function fetchAuditLogs(params?: {
  targetType?: string
  targetId?: string
  max?: number
}): Promise<AuditLog[]> {
  const constraints: QueryConstraint[] = []
  if (params?.targetType) constraints.push(where('targetType', '==', params.targetType))
  if (params?.targetId) constraints.push(where('targetId', '==', params.targetId))
  constraints.push(orderBy('createdAt', 'desc'))
  constraints.push(limit(params?.max ?? 50))

  const snap = await getDocs(query(collection(db, 'auditLogs'), ...constraints))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) }))
}
