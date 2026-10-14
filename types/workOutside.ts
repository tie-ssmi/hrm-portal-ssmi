// The 5 form types the portal offers. formType and activityType.code pair 1:1
// (see ACTIVITY_TYPES in lib/offsite-form-types.ts). A doc with no formType is
// a pre-4-type request — read it as 'workOutside'.
export type FormType = 'workOutside' | 'overtime' | 'training' | 'audit' | 'visit'
export type CurrentActivityCode = 'GENERAL' | 'OVERTIME' | 'TRAINING' | 'AUDIT' | 'VISIT'
// Codes from the old 6-type form. No longer selectable, but still on old docs.
// TRAINING existed in both sets and is listed once, in CurrentActivityCode.
export type LegacyActivityCode = 'MEET_CLIENT' | 'MEETING' | 'BOOTH' | 'PROMO' | 'OTHERS'
export type ActivityCode = CurrentActivityCode | LegacyActivityCode

// One row holds one currency; the other is null.
export interface CostItem {
  no: number
  item: string
  lak: number | null
  usd: number | null
  remark?: string
}

export interface CostTotals {
  lak: number
  usd: number
  usdConvertedToLak: number
  grandTotalLak: number
}

export interface Coordinator {
  name: string
  phone: string
}

export interface DocumentChecklistGroup {
  group: string
  items: { no: number; item: string; remark?: string }[]
}

export interface Department {
  uuid: string
  title: string
  department: string
}

export interface WorkLocation {
  uuid: string
  code: string
  nameLo: string
  nameEn?: string
}

export interface TeammateEntry {
  uid: string
  fullNameEn: string
  fullNameLo: string
  email: string
  jobTitle: string
  jobTitleLo?: string
  department: Department
  position: string
  remark: string
  photoUrl?: string
}

export interface ScheduleTimelineEntry {
  time: string
  details: string
}

export interface ScheduleDay {
  date: string
  dateIso?: string
  timeline: ScheduleTimelineEntry[]
}

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface WorkOutsideRecord {
  requestNo: string
  requester: {
    uid: string
    fullNameEn: string
    fullNameLo: string
    email: string
    jobTitle: string
    department: Department
    workLocation: WorkLocation
    photoUrl?: string
  }
  activityType: { code: ActivityCode; name: string }
  subject: string
  references: string[]
  objective: string
  scheduleDetails: ScheduleDay[]
  equipmentUsed: string
  departmentUid: string
  requesterWorkLocationUid: string
  startDate: string
  endDate: string
  durationDays: number
  monthKey: string
  teammateTitle: number
  teammate: TeammateEntry[]
  participantIds: (string | {
    uid: string
    fullNameEn: string
    fullNameLo: string
    department?: { uuid: string; title: string; department: string }
    image?: string | null
  })[]
  participantUids?: string[]
  participantCount: number
  status: RequestStatus
  requiredApprovers: string[]
  approvals: { role: string; decision: string; reviewedAt?: string; reviewedBy?: string }[]
  rejectReason: null | string
  createdAt: string
  createdBy: string
  createdByUid: string
  updatedAt: string
  updatedBy: string
  docLink?: string | null

  // ── Per-type fields. All optional so pre-4-type docs still type-check. ──
  formType?: FormType
  location?: string
  details?: string
  customerName?: string
  startTime?: string // "HH:mm"
  endTime?: string // "HH:mm"
  totalHours?: number // overtime
  estimatedCost?: number // LAK; equals costTotals.grandTotalLak when costItems exist
  costItems?: CostItem[]
  exchangeRate?: { lakPerUsd: number }
  costTotals?: CostTotals
  organizer?: string
  registrationDeadline?: string // "YYYY-MM-DD"
  coordinators?: Coordinator[]
  documentChecklist?: DocumentChecklistGroup[]
  notes?: string[]
  // Set only on docs imported from paper forms; the portal never writes them.
  documentDate?: string
  documentPlace?: string
}

export type OffsiteRequestDoc = WorkOutsideRecord & { id: string }

export interface WorkLocationDoc {
  uuid: string
  code: string
  nameLo: string
  nameEn?: string
  deletedAt?: string | null
}

export interface EmployeeDoc {
  uid: string
  firstNameEn: string
  lastNameEn: string
  firstNameLo: string
  lastNameLo: string
  email: string
  jobTitle: string
  jobTitleLo?: string
  department: Department
  workLocation?: WorkLocation | string
  workLocationUid?: string
  status?: string
  profileImage?: string
  photo3x4Url?: string
}
