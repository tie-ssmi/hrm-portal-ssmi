import type { User as FirebaseUser } from 'firebase/auth'

export interface RolePermissions {
  AuditDashboard: boolean
  LPB: boolean
  approveBranch: boolean
  approveDepartment: boolean
  dashboard: boolean
  filter: boolean
  highDashboard: boolean
  highManageLeave: boolean
  highManageOffsite: boolean
  housekeeper: boolean
  loginAdmin: boolean
  manageEmployee: boolean
  manageLeave: boolean
  manageNews: boolean
  manageOffsite: boolean
  managePolicy: boolean
  manageRole: boolean
  viewEmployee: boolean
  viewLeave: boolean
  viewNews: boolean
  viewOffsite: boolean
  viewPolicy: boolean
  viewRole: boolean
}

export interface DepartmentInfo {
  department?: string
  title?: string
  uuid?: string
  nameLo?: string
  nameEn?: string
}

export interface WorkLocationInfo {
  uuid?: string
  name?: string
  nameLo?: string
  code?: string
}

export interface EducationEntry {
  education?: string
  graduatedFrom?: string
  major?: string
}

export interface Employee {
  id: string
  email: string
  firstName: string
  lastName: string
  avatar?: string
  department: string | DepartmentInfo
  position: string
  employeeId: string
  phone: string
  joinDate: string
  manager?: string
  // Extended employee data from Firestore
  uuid?: string
  uid?: string
  firstNameEn?: string
  firstNameLo?: string
  lastNameEn?: string
  lastNameLo?: string
  tel?: string
  dateOfBirth?: string
  gender?: string
  bloodType?: string
  maritalStatus?: string
  religion?: string
  ethnicity?: string
  placeOfBirth?: string
  cityOfBirth?: string
  provinceOfBirth?: string
  numberOfFamilyMembers?: string
  emergencyContactNumber?: string
  educations?: EducationEntry[]
  education?: string
  graduatedFrom?: string
  major?: string
  drivingLicenseType?: string
  jobTitle?: string
  role?: string
  rolesUid?: string
  rolesName?: string
  rolePermissions?: RolePermissions
  employeeType?: string
  workLocation?: string | WorkLocationInfo
  salary?: string
  profileImage?: string
  photo3x4Url?: string
  createdAt?: any
}

export interface AttendanceRecord {
  id: string
  _id?: string
  date: string
  checkIn?: string
  checkInTime?: string
  checkOut?: string
  checkOutTime?: string | null
  status: 'present' | 'late' | 'absent' | 'leave' | 'offsite' | 'not_check_in' | 'not_checked_in'
  location?: {
    lat: number
    lng: number
    address?: string
  }
  isOffsite?: boolean
  checkInImageURL?: string
  checkOutImageURL?: string
  workHours?: number
  uid?: string
  userUuid?: string
  fullNameEn?: string
  fullNameLo?: string
  employeeImage?: string
  jobTitle?: string
  createdAt?: string
  createdBy?: string
  updatedAt?: string
  updatedBy?: string
  note?: string | null
  department?: {
    name: string
    uid: string
  }
  workLocation?: {
    code?: string
    name: string
    uid?: string
  }
}

export type LeaveApproverRole = 'departmentHead' | 'hr' | 'manager'

export interface LeaveApprovalStep {
  role: LeaveApproverRole
  decision: 'pending' | 'approved' | 'rejected'
  reviewedBy?: string
  reviewedAt?: string
}

export interface LeaveRequest {
  id: string
  leaveUserUuid?: string
  leaveUserName?: string
  leaveImage?: string | null
  species?: 'owner' | 'instead'
  type: string
  policyUuid?: string
  policyId?: string
  policyName?: string
  createdBy?: string
  createdByUid?: string
  startDate: string
  startPeriod?: 'morning' | 'afternoon'
  endDate: string
  endPeriod?: 'morning' | 'afternoon'
  duration?: number
  reason: string
  departmentUid?: string
  departmentNameLo?: string
  departmentNameEn?: string
  workLocationUid?: string
  successorUid?: string
  successorNameLo?: string
  successorNameEn?: string
  jobTitle?: string
  doc?: string
  docLink?: string
  docStatus?: 'now' | 'later' | null
  requiredApprovers?: LeaveApproverRole[]
  approvals?: LeaveApprovalStep[]
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  reviewedBy?: string
  reviewedAt?: string
}

export interface OffsiteRequest {
  id: string
  date: string
  location: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  reviewedBy?: string
  reviewedAt?: string
  createdBy?: string
}

export interface ProfileUpdateRequest {
  id: string
  field: string
  oldValue: string
  newValue: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  reviewedBy?: string
  reviewedAt?: string
}

export interface LeaveBalance {
  annual: number
  annualUsed: number
  sick: number
  sickUsed: number
  personal: number
  personalUsed: number
}

export interface LeavePolicy {
  annual: number
  sick: number
  personal: number
}

export interface PolicyRecord {
  id: string
  uuid?: string
  role?: string | null
  name?: string
  description?: string
  note?: string
  days?: number
  limitDay?: number
  limitType?: string
  requestType: string
  leavePolicy: LeavePolicy
  documentRequired?: 'yes' | 'option' | 'no'
}

export interface LateRecord {
  date: string
  minutes: number
  fine: number
}

export interface GeoFence {
  lat: number
  lng: number
  radius: number // in meters
  name: string
}

export interface AuthContextType {
  user: Employee | null
  firebaseUser: FirebaseUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<boolean>
  loginWithGoogle: (linkPassword?: string) => Promise<{
    success: boolean
    error?: string
    requiresPasswordLink?: boolean
    requiresPasswordSetup?: boolean
    email?: string
  }>
  setupPasswordForCurrentUser: (password: string) => Promise<{ success: boolean; error?: string }>
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  updateProfile: (updates: Partial<Employee>) => void
}

export interface HRMContextType {
  todayAttendance: AttendanceRecord | null
  attendanceHistory: AttendanceRecord[]
  checkIn: (location?: { lat: number; lng: number }) => Promise<{ success: boolean; message: string }>
  checkOut: (location?: { lat: number; lng: number }) => Promise<{ success: boolean; message: string }>
  leaveBalance: LeaveBalance
  leaveRequests: LeaveRequest[]
  submitLeaveRequest: (request: Omit<LeaveRequest, 'id' | 'status' | 'createdAt'>, options?: { autoApproveDeptHead?: boolean }) => Promise<void>
  reviewLeaveRequest: (
    requestId: string,
    role: LeaveApproverRole,
    decision: 'approved' | 'rejected',
    reviewedBy?: string
  ) => Promise<void>
  offsiteRequests: OffsiteRequest[]
  submitOffsiteRequest: (request: Omit<OffsiteRequest, 'id' | 'status' | 'createdAt'>) => Promise<void>
  profileUpdateRequests: ProfileUpdateRequest[]
  submitProfileUpdate: (request: Omit<ProfileUpdateRequest, 'id' | 'status' | 'createdAt'>) => Promise<void>
  lateRecords: LateRecord[]
  totalFines: number
  isWithinGeofence: (lat: number, lng: number) => boolean
  distanceToOffice: (lat: number, lng: number) => number | null
  geoFenceStatus: 'loading' | 'found' | 'no_coordinates' | 'not_found'
}
