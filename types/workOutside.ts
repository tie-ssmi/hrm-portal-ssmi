export type ActivityCode = 'MEET_CLIENT' | 'MEETING' | 'BOOTH' | 'PROMO' | 'TRAINING'
export type RoleInTrip = 'Lead' | 'Support' | 'Presenter' | 'Coordinator' | 'Observer'

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
  details: string
  references: string[]
  objective: string
  scheduleDetails: ScheduleDay[]
  equipmentUsed: string
  customerName: string
  location: string
  workLocationUid: string
  startDate: string
  startTime?: string
  endDate: string
  endTime?: string
  durationDays: number
  monthKey: string
  estimatedCost: number
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
  department: Department
  workLocation?: WorkLocation | string
  workLocationUid?: string
  status?: string
  profileImage?: string
  photo3x4Url?: string
}
