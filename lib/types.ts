export interface Employee {
  id: string
  email: string
  firstName: string
  lastName: string
  avatar?: string
  department: string
  position: string
  employeeId: string
  phone: string
  joinDate: string
  manager?: string
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

export interface LeaveRequest {
  id: string
  type: 'annual' | 'sick' | 'personal' | 'unpaid'
  startDate: string
  endDate: string
  reason: string
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
