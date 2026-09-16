// ** third party
import { collection, doc, getDocs, query, runTransaction, where, type DocumentData } from 'firebase/firestore'

// ** config / utils / types / hooks
import { db } from '@/lib/firebase'
import { getVientianeIsoDate } from '@/lib/server-time'
import type { OffsiteRequestDoc, WorkOutsideRecord } from '@/types/workOutside'

// ** services
import { logAudit } from '@/services/audit-log'
import {
  getOffsiteApprovalBlock,
  OffsiteApprovalError,
  resolveOffsiteStatus,
  type OffsiteApprover,
} from '@/services/offsite-approval'

export async function fetchAllTodayOffsite(): Promise<OffsiteRequestDoc[]> {
  // Vientiane, not UTC — toISOString() still said yesterday until 07:00 local.
  const today = getVientianeIsoDate()

  // A request active today must not have ended yet — bound on endDate so this
  // doesn't download every approved offsite request the company has ever had.
  try {
    const snap = await getDocs(
      query(
        collection(db, 'workOutside'),
        where('status', '==', 'approved'),
        where('endDate', '>=', today),
      )
    )
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as OffsiteRequestDoc))
      .filter(r => r.startDate <= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  } catch {
    // Composite index missing/still building — fall back to the un-scoped scan.
    const snap = await getDocs(
      query(collection(db, 'workOutside'), where('status', '==', 'approved'))
    )
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as OffsiteRequestDoc))
      .filter(r => r.startDate <= today && r.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  }
}

export async function fetchTodayOffsiteByWorkLocation(workLocationUid: string): Promise<OffsiteRequestDoc[]> {
  if (!workLocationUid) return []

  // Vientiane, not UTC — toISOString() still said yesterday until 07:00 local.
  const today = getVientianeIsoDate()
  const col = collection(db, 'workOutside')

  try {
    const snap = await getDocs(
      query(
        col,
        where('requester.workLocation.uuid', '==', workLocationUid),
        where('status', '==', 'approved'),
        where('endDate', '>=', today),
      ),
    )
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as OffsiteRequestDoc))
      .filter((r) => r.startDate <= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  } catch {
    const snap = await getDocs(
      query(col, where('requester.workLocation.uuid', '==', workLocationUid), where('status', '==', 'approved')),
    )
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as OffsiteRequestDoc))
      .filter((r) => r.startDate <= today && r.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  }
}

type OffsiteApprovalEntry = WorkOutsideRecord['approvals'][number]

// The portal's ONLY write path for an offsite decision — the approval list and
// the detail page both call this. It fills the `departmentHead` slot; `hr` and
// `manager` are decided in the admin app.
//
// Everything is checked against the live document inside one transaction,
// because both pages act on a cached copy that can be stale:
//   - the requester may have cancelled since the page loaded — rejecting it
//     anyway overwrote `cancelled` and emailed them a rejection;
//   - notifyNewOffsiteRequest alerts BOTH approveBranch and approveDepartment
//     holders for the same slot, so two approvers can decide it at once, and the
//     second used to write its stale array over the first decision.
// Throws OffsiteApprovalError when the live document refuses; show it with
// offsiteApprovalErrorMessage.
export async function updateOffsiteApproval(params: {
  requestId: string
  decision: 'approved' | 'rejected'
  approver: OffsiteApprover
  reviewedBy: string
  rejectReason?: string
  actorRoleUuid?: string
  actorRoleName?: string
  workLocation?: { code?: string; nameLo?: string; uuid?: string }
}): Promise<void> {
  const {
    requestId, decision, approver, reviewedBy, rejectReason,
    actorRoleUuid, actorRoleName, workLocation,
  } = params
  const action = decision === 'approved' ? 'offsite.request.approve' : 'offsite.request.reject'
  const ref = doc(db, 'workOutside', requestId)

  try {
    const { before, after, targetName } = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists()) throw new OffsiteApprovalError('not_found')

      const data = snap.data() as WorkOutsideRecord
      if (data.status !== 'pending') throw new OffsiteApprovalError('not_pending')

      const block = getOffsiteApprovalBlock(data, approver)
      if (block) throw new OffsiteApprovalError(block)

      // Null entries are kept in place, not compacted: the admin app addresses
      // hr / manager by array index ([1] / [2]).
      const approvals = (data.approvals ?? []) as (OffsiteApprovalEntry | null)[]
      const index = approvals.findIndex((a) => a?.role === 'departmentHead')
      // No slot used to fall through to `status = decision`, deciding the whole
      // request and skipping HR / manager. Refuse instead.
      if (index < 0) throw new OffsiteApprovalError('no_slot')
      if (approvals[index]?.decision !== 'pending') throw new OffsiteApprovalError('already_decided')

      const now = new Date().toISOString()
      const updatedApprovals = approvals.map((a, i) =>
        a && i === index ? { ...a, decision, reviewedBy, reviewedAt: now } : a,
      )
      const status = resolveOffsiteStatus(updatedApprovals)

      const update: DocumentData = {
        approvals: updatedApprovals,
        updatedAt: now,
        updatedBy: reviewedBy,
        ...(status !== 'pending' ? { status } : {}),
        ...(decision === 'rejected' && rejectReason ? { rejectReason } : {}),
      }
      tx.update(ref, update)

      return {
        before: { status: data.status, approvals },
        after: update,
        targetName: data.requester?.fullNameLo || data.requester?.fullNameEn,
      }
    })

    await logAudit({
      action,
      actorUid: approver.uid,
      actorName: reviewedBy,
      actorRoleUuid: actorRoleUuid ?? '',
      actorRoleName,
      workLocation,
      targetType: 'workOutside',
      targetId: requestId,
      targetName,
      before,
      after,
      reason: decision === 'rejected' ? rejectReason : undefined,
      status: 'SUCCESS',
    })
  } catch (error) {
    await logAudit({
      action,
      actorUid: approver.uid,
      actorName: reviewedBy,
      actorRoleUuid: actorRoleUuid ?? '',
      actorRoleName,
      workLocation,
      targetType: 'workOutside',
      targetId: requestId,
      status: 'FAILED',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
