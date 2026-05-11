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
  roleInTrip: RoleInTrip
  photoUrl?: string
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
  }
  activityType: { code: ActivityCode; name: string }
  subject: string
  details: string
  customerName: string
  location: string
  workLocationUid: string
  startDate: string
  endDate: string
  durationDays: number
  monthKey: string
  estimatedCost: number
  teammateTitle: number
  teammate: TeammateEntry[]
  participantIds: string[]
  participantCount: number
  status: RequestStatus
  requiredApprovers: ['departmentHead', 'hr', 'manager']
  approvals: [
    { role: 'departmentHead'; decision: 'pending' },
    { role: 'hr'; decision: 'pending' },
    { role: 'manager'; decision: 'pending' },
  ]
  rejectReason: null | string
  createdAt: string
  createdBy: string
  createdByUid: string
  updatedAt: string
  updatedBy: string
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
  status?: string
  profileImage?: string
  photo3x4Url?: string
}
