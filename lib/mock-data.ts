import type { Employee, AttendanceRecord, LeaveRequest, OffsiteRequest, LeaveBalance, LateRecord, GeoFence } from './types'

export const mockEmployee: Employee = {
  id: '1',
  email: 'john.doe@company.com',
  firstName: 'John',
  lastName: 'Doe',
  department: 'Engineering',
  position: 'Senior Developer',
  employeeId: 'EMP-2024-001',
  phone: '+1 234 567 8900',
  joinDate: '2022-03-15',
  manager: 'Jane Smith'
}

export const mockLeaveBalance: LeaveBalance = {
  annual: 15,
  annualUsed: 5,
  sick: 10,
  sickUsed: 2,
  personal: 5,
  personalUsed: 1
}

export const mockLateRecords: LateRecord[] = [
  { date: '2024-01-15', minutes: 15, fine: 50 },
  { date: '2024-01-22', minutes: 30, fine: 100 },
  { date: '2024-02-05', minutes: 10, fine: 25 },
]

export const mockAttendanceHistory: AttendanceRecord[] = [
  { id: '1', date: '2024-02-01', checkIn: '08:55', checkOut: '17:30', status: 'present', workHours: 8.5 },
  { id: '2', date: '2024-02-02', checkIn: '09:15', checkOut: '17:45', status: 'late', workHours: 8.5 },
  { id: '3', date: '2024-02-03', checkIn: undefined, checkOut: undefined, status: 'leave', workHours: 0 },
  { id: '4', date: '2024-02-04', checkIn: '08:50', checkOut: '17:20', status: 'present', workHours: 8.5 },
  { id: '5', date: '2024-02-05', checkIn: '09:10', checkOut: '18:00', status: 'late', workHours: 8.8 },
  { id: '6', date: '2024-02-06', checkIn: '08:45', checkOut: '17:15', status: 'present', workHours: 8.5 },
  { id: '7', date: '2024-02-07', checkIn: '08:58', checkOut: '17:30', status: 'present', workHours: 8.5 },
]

export const mockLeaveRequests: LeaveRequest[] = [
  {
    id: '1',
    type: 'annual',
    startDate: '2024-03-15',
    endDate: '2024-03-20',
    reason: 'Family vacation',
    status: 'approved',
    createdAt: '2024-02-20',
    reviewedBy: 'Jane Smith',
    reviewedAt: '2024-02-22'
  },
  {
    id: '2',
    type: 'sick',
    startDate: '2024-02-10',
    endDate: '2024-02-11',
    reason: 'Medical appointment',
    status: 'approved',
    createdAt: '2024-02-08',
    reviewedBy: 'Jane Smith',
    reviewedAt: '2024-02-09'
  },
  {
    id: '3',
    type: 'personal',
    startDate: '2024-04-01',
    endDate: '2024-04-01',
    reason: 'Personal matters',
    status: 'pending',
    createdAt: '2024-03-01'
  }
]

export const mockOffsiteRequests: OffsiteRequest[] = [
  {
    id: '1',
    date: '2024-02-15',
    location: 'Client Office - Downtown',
    reason: 'Client meeting and project review',
    status: 'approved',
    createdAt: '2024-02-10',
    reviewedBy: 'Jane Smith',
    reviewedAt: '2024-02-12'
  },
  {
    id: '2',
    date: '2024-03-05',
    location: 'Home Office',
    reason: 'Equipment delivery at home',
    status: 'pending',
    createdAt: '2024-02-28'
  }
]

export const mockGeoFenceLPB: GeoFence = {
  lat: 19.897718807272657,
  lng: 102.15378424680168,
  radius: 50, // ໄລຍະສະແກນ 50 ແມັດ
  name: 'SSMI LPB'
};
