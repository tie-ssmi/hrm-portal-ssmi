import type { User as FirebaseUser } from 'firebase/auth'

export interface DepartmentInfo {
  department?: string
  title?: string
  uuid?: string
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
  employeeType?: string
  workLocation?: string
  salary?: string
  profileImage?: string
  photo3x4Url?: string
  createdAt?: any
}

export interface AttendanceRecord {
  id: string
  date: string
  checkIn?: string
  checkOut?: string
  status: 'present' | 'late' | 'absent' | 'leave' | 'offsite'
  location?: {
    lat: number
    lng: number
    address?: string
  }
  workHours?: number
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
  userUuid?: string
  type: string
  policyUuid?: string
  policyId?: string
  policyName?: string
  startDate: string
  startPeriod?: 'morning' | 'afternoon'
  endDate: string
  endPeriod?: 'morning' | 'afternoon'
  duration?: number
  requiredApprovers?: LeaveApproverRole[]
  approvals?: LeaveApprovalStep[]
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  createdBy?: string
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
  loginWithGoogle: () => Promise<boolean>
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
  submitLeaveRequest: (request: Omit<LeaveRequest, 'id' | 'status' | 'createdAt'>) => Promise<void>
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
}
