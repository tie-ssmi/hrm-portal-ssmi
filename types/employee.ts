export interface EmployeeWorkLocation {
  uuid: string;
  nameLo: string;
  code: string;
}

export interface EmployeeDepartment {
  department: string;
  uuid: string;
  title: string;
  nameLo?: string;
  nameEn?: string;
}

export interface Employee {
  id?: string
  uid: string;
  uuid?: string;
  profileImage?: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameLo: string;
  lastNameLo: string;
  gender: string;
  dateOfBirth: string;
  cityOfBirth: string;
  provinceOfBirth: string;
  placeOfBirth: string;
  bloodType: string;
  maritalStatus: string;
  numberOfFamilyMembers: string;
  education: string;
  graduatedFrom: string;
  major: string;
  jobTitle: string;
  jobTitleLo?: string;
  employeeType: string;
  department?: string | EmployeeDepartment;
  departmentUid ?: string;
  workLocation: EmployeeWorkLocation;
  salary: number;
  tel: string;
  email: string;
  emergencyContactNumber: string;
  ethnicity: string;
  religion: string;
  role: string;
  drivingLicenseType: string;
  
  createdAt: {
    __time__: string;
  };
  idCardPhotoUrl?: string;
  photo3x4Url?: string;
  status?: string;
}

export interface LeaveType {
  id: string;   // Map this ID to your image file (e.g., "01.png")
  name: string; // The display name
}

export interface LeaveData {
  leaveUserUuid?: string;
  name: string;
  departmentUid ?: string;
  department ?: string;
  successor: string;
  startDate: string;
  endDate: string;
  startPeriod?: 'morning' | 'afternoon';
  endPeriod?: 'morning' | 'afternoon';
  duration?: number;
  reason: string;
  position: string;
  note: string;
  type: LeaveType;
  leaveImage?: string | null;
}