export interface TripStaffEntry {
  userUuid: string
  userName: string
  jobTitle: string
  departmentUid: string
  departmentNameLo: string
  departmentNameEn: string
  workLocationUid: string
  workLocationNameLo: string
  image: string | null
}

export interface TripRecord {
  reason: string
  startDate: string
  endDate: string
  status: string
  staff: TripStaffEntry[]
  departmentUid: string
  departmentNameLo: string
  departmentNameEn: string
  workLocationUid: string
  jobTitle: string
  createdAt: string
  createdBy: string
  createdByUid: string
  updatedAt: string
  updatedBy: string
}

export type TripDoc = TripRecord & { id: string }
