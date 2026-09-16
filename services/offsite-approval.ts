// Pure helpers for the workOutside approval flow — no Firestore access, same
// role as services/leave-approval.ts for leaves. Shared by the approval list
// (app/dashboard/approv/page.tsx), the detail page, and updateOffsiteApproval
// in services/workOutside.ts, so all three apply exactly the same rules.

type ApprovalEntryLike = { decision?: string } | null | undefined

// True while no approver has decided anything yet. This is the only window in
// which the requester may edit a request: `status` stays 'pending' after the
// department head approves (HR / manager still to go), so gating edits on
// status alone let the requester change dates, teammates and schedule after
// their department head had signed off — and HR then approved something the
// department head never saw. Mirrored in firestore.rules
// (workOutsideNoDecisionYet) — keep the two in step.
//
// Entries can be null: the admin app pads a 2-step `approvals` array to
// length 3 with null when it writes the HR decision.
export function hasNoOffsiteDecisionYet(
  approvals: ReadonlyArray<ApprovalEntryLike> | null | undefined,
): boolean {
  return (approvals ?? []).every((a) => !a || a.decision === 'pending')
}

// Overall status from the approval slots. Null entries (admin padding) are
// ignored rather than counted as "not approved".
export function resolveOffsiteStatus(
  approvals: ReadonlyArray<ApprovalEntryLike>,
): 'pending' | 'approved' | 'rejected' {
  const entries = approvals.filter((a): a is { decision?: string } => !!a)
  if (entries.some((a) => a.decision === 'rejected')) return 'rejected'
  if (entries.length > 0 && entries.every((a) => a.decision === 'approved')) return 'approved'
  return 'pending'
}

export type OffsiteApprover = {
  uid: string
  workLocationUuid?: string
  departmentUuid?: string
  canApproveDepartment: boolean
  canApproveBranch: boolean
}

type OffsiteScopeSource = {
  createdByUid?: string
  requester?: {
    uid?: string
    workLocation?: { uuid?: string } | null
    department?: { uuid?: string } | null
  }
  participantIds?: ReadonlyArray<string | { uid?: string } | null>
  participantUids?: ReadonlyArray<string>
  teammate?: ReadonlyArray<{ uid?: string } | null>
}

export type OffsiteApprovalBlock = 'own_request' | 'participant' | 'out_of_scope'

export const OFFSITE_APPROVAL_BLOCK_MESSAGE: Record<OffsiteApprovalBlock, string> = {
  own_request: 'ທ່ານບໍ່ສາມາດອະນຸມັດຄຳຂໍຂອງຕົນເອງໄດ້',
  participant: 'ທ່ານເປັນສະມາຊິກທີມໃນຄຳຂໍນີ້ ຈຶ່ງບໍ່ສາມາດອະນຸມັດໄດ້',
  out_of_scope: 'ຄຳຂໍນີ້ຢູ່ນອກຂອບເຂດການອະນຸມັດຂອງທ່ານ',
}

function isParticipant(record: OffsiteScopeSource, uid: string): boolean {
  if (record.participantUids?.includes(uid)) return true
  // participantIds holds bare uids on older docs and objects on newer ones.
  if (record.participantIds?.some((p) => (typeof p === 'string' ? p : p?.uid) === uid)) return true
  return !!record.teammate?.some((t) => t?.uid === uid)
}

// Why this approver may NOT decide on this request, or null if they may.
//
// The approval list gets scope for free from its Firestore query, but the
// detail page is reachable by direct URL with any id, and `workOutside` read
// is open to every approver regardless of branch — so the same checks have to
// run on the page and again inside the write transaction.
//
// Scope uses the exact fields the list query filters on
// (requester.workLocation.uuid / requester.department.uuid): approveBranch →
// same work location, any department; approveDepartment → same location AND
// same department. A doc missing either field is out of scope, which is how an
// equality `where` already treats it in the list.
export function getOffsiteApprovalBlock(
  record: OffsiteScopeSource,
  approver: OffsiteApprover,
): OffsiteApprovalBlock | null {
  const { uid } = approver
  if (!uid) return 'out_of_scope'

  if (record.createdByUid === uid || record.requester?.uid === uid) return 'own_request'

  // A teammate is going on the trip being approved — a conflict of interest the
  // old creator-only check missed.
  if (isParticipant(record, uid)) return 'participant'

  const requestLocation = record.requester?.workLocation?.uuid
  const requestDepartment = record.requester?.department?.uuid
  const inLocation = !!approver.workLocationUuid && requestLocation === approver.workLocationUuid
  const inScope =
    inLocation &&
    (approver.canApproveBranch ||
      (approver.canApproveDepartment &&
        !!approver.departmentUuid &&
        requestDepartment === approver.departmentUuid))

  return inScope ? null : 'out_of_scope'
}

export type OffsiteApprovalErrorCode =
  | OffsiteApprovalBlock
  | 'not_found'
  | 'not_pending'
  | 'no_slot'
  | 'already_decided'

const ERROR_MESSAGE: Record<OffsiteApprovalErrorCode, string> = {
  ...OFFSITE_APPROVAL_BLOCK_MESSAGE,
  not_found: 'ບໍ່ພົບຄຳຂໍນີ້',
  not_pending: 'ຄຳຂໍນີ້ບໍ່ຢູ່ໃນສະຖານະລໍຖ້າອະນຸມັດແລ້ວ (ອາດຖືກຍົກເລີກ ຫຼື ຕັດສິນແລ້ວ)',
  no_slot: 'ບໍ່ພົບຂັ້ນຕອນຫົວໜ້າພະແນກໃນຄຳຂໍນີ້',
  already_decided: 'ຂັ້ນຕອນນີ້ຖືກດຳເນີນການໄປແລ້ວໂດຍຜູ້ອະນຸມັດອື່ນ',
}

// Thrown by updateOffsiteApproval when the LIVE document refuses the decision.
export class OffsiteApprovalError extends Error {
  readonly code: OffsiteApprovalErrorCode

  constructor(code: OffsiteApprovalErrorCode) {
    super(`Offsite approval refused: ${code}`)
    this.name = 'OffsiteApprovalError'
    this.code = code
  }
}

export function offsiteApprovalErrorMessage(error: unknown): string {
  return error instanceof OffsiteApprovalError
    ? ERROR_MESSAGE[error.code]
    : 'ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່'
}
