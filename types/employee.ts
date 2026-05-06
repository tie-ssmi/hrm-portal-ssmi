export interface EmployeeWorkLocation {
  uuid: string;
  nameLo: string;
  code: string;
}

export interface EmployeeDepartment {
  department: string;
  uuid: string;
  title: string;
}

export interface Employee {
  uid: string;
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
  employeeType: string;
  department: EmployeeDepartment;
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
  name: string;
  department: string;
  successor: string;
  startDate: string;
  endDate: string;
  reason: string;
  position: string; // Added this field
  note: string; // This acts as the "Note"
  type: LeaveType; // Added this field
}