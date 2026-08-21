import type { User as FirebaseUser } from "firebase/auth";

export interface RolePermissions {
  AuditDashboard: boolean;
  CLive: boolean;
  LPB: boolean;
  approveBranch: boolean;
  approveDepartment: boolean;
  dashboard: boolean;
  filter: boolean;
  highDashboard: boolean;
  highManageLeave: boolean;
  highManageOffsite: boolean;
  housekeeper: boolean;
  loginAdmin: boolean;
  manageEmployee: boolean;
  manageLeave: boolean;
  manageNews: boolean;
  manageOffsite: boolean;
  managePolicy: boolean;
  manageRole: boolean;
  secretaty: boolean;
  viewEmployee: boolean;
  viewLeave: boolean;
  viewNews: boolean;
  viewOffsite: boolean;
  viewPolicy: boolean;
  viewRole: boolean;
}

export interface DepartmentInfo {
  department?: string;
  title?: string;
  uuid?: string;
  nameLo?: string;
  nameEn?: string;
}

export interface WorkLocationInfo {
  uuid?: string;
  name?: string;
  nameLo?: string;
  code?: string;
}

export interface EducationEntry {
  education?: string;
  graduatedFrom?: string;
  major?: string;
}

export interface DocEntry {
  name: string;
  url: string;
  addAt: string;
}

export interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  department: string | DepartmentInfo;
  position: string;
  employeeId: string;
  phone: string;
  joinDate: string;
  manager?: string;
  // Extended employee data from Firestore
  uuid?: string;
  uid?: string;
  firstNameEn?: string;
  firstNameLo?: string;
  lastNameEn?: string;
  lastNameLo?: string;
  tel?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodType?: string;
  maritalStatus?: string;
  religion?: string;
  ethnicity?: string;
  placeOfBirth?: string;
  cityOfBirth?: string;
  provinceOfBirth?: string;
  numberOfFamilyMembers?: string;
  emergencyContactNumber?: string;
  educations?: EducationEntry[];
  education?: string;
  graduatedFrom?: string;
  major?: string;
  drivingLicenseType?: string;
  jobTitle?: string;
  jobTitleLo?: string;
  role?: string;
  rolesUid?: string;
  rolesName?: string;
  rolePermissions?: RolePermissions;
  employeeType?: string;
  workLocation?: string | WorkLocationInfo;
  salary?: string;
  profileImage?: string;
  photo3x4Url?: string;
  idCardPhotoUrl?: string;
  criminalRecordUrl?: string;
  declarationUrl?: string;
  docs?: DocEntry[];
  createdAt?: any;
  // Written by the admin repo (HRM-System-SSMI) — employment lifecycle
  hireDate?: string;
  employmentStatus?: string;
  statusHistory?: EmploymentStatusEntry[];
  managerUid?: string;
  workCalendarId?: string;
  isActive?: boolean;
  resignedAt?: string | null;
}

export interface EmploymentStatusEntry {
  status: string;
  from: string;
  to: string | null;
}

export interface AttendanceRecord {
  id: string;
  _id?: string;
  date: string;
  checkIn?: string;
  checkInTime?: string;
  checkOut?: string;
  checkOutTime?: string | null;
  status:
    | "present"
    | "late"
    | "absent"
    | "leave"
    | "offsite"
    | "not_check_in"
    | "not_checked_in"
    | "trip";
  checkInLocation?: {
    lat: number;
    lng: number;
    address?: string;
  };
  checkOutLocation?: {
    lat: number;
    lng: number;
    address?: string;
  };
  // GPS accuracy (meters), source IP, and non-blocking spoofing-suspicion
  // flags captured server-side for later admin review — see recordCheckIn/
  // recordCheckOut in functions/src/index.ts. Never used to block a request.
  checkInAccuracy?: number;
  checkOutAccuracy?: number;
  checkInIp?: string;
  checkOutIp?: string;
  checkInUserAgent?: string;
  checkOutUserAgent?: string;
  checkInLocationFlags?: string[];
  checkOutLocationFlags?: string[];
  isOffsite?: boolean;
  checkInImageURL?: string;
  checkOutImageURL?: string;
  workHours?: number;
  uid?: string;
  userUuid?: string;
  fullNameEn?: string;
  fullNameLo?: string;
  employeeImage?: string;
  jobTitle?: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  note?: string | null;
  department?: {
    name: string;
    uid: string;
  };
  workLocation?: {
    code?: string;
    name: string;
    uid?: string;
  };
}

export type LeaveApproverRole = "departmentHead" | "hr" | "manager";

export interface LeaveApprovalStep {
  role: LeaveApproverRole;
  decision: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface TaskDelegation {
  responsibilities: boolean;
  documentSigning: boolean;
  o9Approval: boolean;
  other: boolean;
  otherReason: string | null;
}

export interface LeaveRequest {
  id: string;
  leaveUserUuid?: string;
  leaveUserName?: string;
  leaveImage?: string | null;
  species?: "owner" | "instead";
  type: string;
  policyUuid?: string;
  policyId?: string;
  policyName?: string;
  createdBy?: string;
  createdByUid?: string;
  startDate: string;
  startPeriod?: "morning" | "afternoon";
  endDate: string;
  endPeriod?: "morning" | "afternoon";
  duration?: number;
  reason: string;
  departmentUid?: string;
  departmentNameLo?: string;
  departmentNameEn?: string;
  workLocationUid?: string;
  workLocationNameLo?: string;
  // Formal salutation line for the printed/PDF leave doc — who the request
  // is addressed to. Computed at submission time from duration + LPB scope,
  // see getLeaveRecipientText in services/leave-approval.ts.
  to?: string;
  // Remaining balance for this policy at submission time, BEFORE this
  // request's own duration is subtracted — a snapshot, not the post-
  // deduction figure (e.g. 15 days available, request 5 -> saves 15).
  remainingDaysBeforeRequest?: number;
  successorUid?: string;
  successorNameLo?: string;
  successorNameEn?: string;
  taskDelegation?: TaskDelegation;
  jobTitle?: string;
  jobTitleLo?: string;
  doc?: string;
  docLink?: string;
  docStatus?: "now" | "later" | null;
  requiredApprovers?: LeaveApproverRole[];
  approvals?: LeaveApprovalStep[];
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface OffsiteRequest {
  id: string;
  date: string;
  location: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdBy?: string;
}

export interface ProfileUpdateRequest {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface LeaveBalance {
  annual: number;
  annualUsed: number;
  sick: number;
  sickUsed: number;
  personal: number;
  personalUsed: number;
}

export interface LeavePolicy {
  annual: number;
  sick: number;
  personal: number;
}

export type EmploymentStatus = "intern" | "probation95" | "permanent";
export type PolicyRuleLimitType = "month" | "year" | "event" | "unlimited";

export interface PolicyRule {
  employmentStatus: EmploymentStatus;
  eligible: boolean;
  limitType?: PolicyRuleLimitType;
  limitDay?: number;
  reason?: string;
}

export interface PolicyRecord {
  id: string;
  uuid?: string;
  role?: string | null;
  name?: string;
  description?: string;
  note?: string;
  days?: number;
  limitDay?: number;
  limitType?: string;
  requestType: string;
  leavePolicy: LeavePolicy;
  documentRequired?: "yes" | "option" | "no";
  countMode?: "workingDays" | "calendarDays";
  active?: boolean;
  rules?: PolicyRule[];
}

// Authoritative per-employee, per-policy, per-period balance — written by the
// admin repo's runLeaveBalanceSummaryV2 (HRM-System-SSMI/functions/src/index.ts).
// Doc id is "{period}_{uid}_{policyId}" where period is "YYYY" (year policies)
// or "YYYY-MM" (month policies). Coexists in the same `leaveBalance` collection
// as the older LeaveBalanceRecord docs above — distinguish via schemaVersion.
export interface LeaveBalanceV2 {
  id: string;
  uid: string;
  policyId: string;
  policyUuid: string;
  policyName: string;
  periodType: "month" | "year";
  period: string;
  periodStart: string; // "YYYY-MM-DD"
  periodEnd: string; // "YYYY-MM-DD"
  employmentStatusAtGrant: EmploymentStatus;
  countMode: "workingDays" | "calendarDays";
  entitlement: number;
  adjustment: number;
  available: number;
  used: number;
  pending: number;
  remaining: number;
  locked: boolean;
  schemaVersion: number;
}

export interface LateRecord {
  date: string;
  minutes: number;
  fine: number;
}

export interface GeoFence {
  lat: number;
  lng: number;
  radius: number; // in meters
  name: string;
}

export interface GoogleLoginOutcome {
  success: boolean;
  error?: string;
  requiresPasswordLink?: boolean;
  requiresPasswordSetup?: boolean;
  email?: string;
}

export interface AuthContextType {
  user: Employee | null;
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: (linkPassword?: string) => Promise<GoogleLoginOutcome>;
  // Populated when Google sign-in completes via a full-page redirect (iOS
  // standalone PWA — see shouldUseGoogleRedirect in auth-context.tsx) instead
  // of a popup, since the outcome can't be returned directly from a button
  // click handler after the page reloads. LoginForm applies it the same way
  // it applies loginWithGoogle's return value, then clears it.
  googleRedirectOutcome: GoogleLoginOutcome | null;
  clearGoogleRedirectOutcome: () => void;
  setupPasswordForCurrentUser: (
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (
    email: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (updates: Partial<Employee>) => void;
}

export interface HRMContextType {
  todayAttendance: AttendanceRecord | null;
  attendanceHistory: AttendanceRecord[];
  checkIn: (location?: {
    lat: number;
    lng: number;
  }) => Promise<{ success: boolean; message: string }>;
  checkOut: (location?: {
    lat: number;
    lng: number;
  }) => Promise<{ success: boolean; message: string }>;
  leaveBalance: LeaveBalance;
  leaveRequests: LeaveRequest[];
  submitLeaveRequest: (
    request: Omit<LeaveRequest, "id" | "status" | "createdAt">,
    options?: { autoApproveDeptHead?: boolean; autoApproveManager?: boolean; reviewedBy?: string },
  ) => Promise<void>;
  reviewLeaveRequest: (
    requestId: string,
    role: LeaveApproverRole,
    decision: "approved" | "rejected",
    reviewedBy?: string,
  ) => Promise<void>;
  offsiteRequests: OffsiteRequest[];
  submitOffsiteRequest: (
    request: Omit<OffsiteRequest, "id" | "status" | "createdAt">,
  ) => Promise<void>;
  profileUpdateRequests: ProfileUpdateRequest[];
  submitProfileUpdate: (
    request: Omit<ProfileUpdateRequest, "id" | "status" | "createdAt">,
  ) => Promise<void>;
  lateRecords: LateRecord[];
  totalFines: number;
  isWithinGeofence: (lat: number, lng: number) => boolean;
  distanceToOffice: (lat: number, lng: number) => number | null;
  geoFenceStatus: "loading" | "found" | "no_coordinates" | "not_found";
  // The signed-in user's work location coordinates, when configured — null
  // while loading or when the work location has no GPS set (geoFenceStatus
  // covers which). Used e.g. by WeatherWidget instead of a hardcoded city.
  geoFence: GeoFence | null;
}

export interface AuditLog {
  id: string; // Firestore doc id

  // Which system wrote this entry — stamped server-side in logAuditEvent, not
  // client-supplied. This app is always "portal"; other values are reserved
  // for other systems (e.g. the separate admin project) that may write to the
  // same auditLogs collection in the future.
  systemType: string;

  // "domain.entity.action" — e.g. "leave.request.approve", "auth.forceLogout.trigger"
  action: string;

  // Actor (ຜູ້ກະທຳ)
  actorUid: string;
  actorName: string;
  actorRoleUuid: string;
  actorRoleName?: string;
  workLocation?: {
    code?: string;
    nameLo?: string;
    uuid?: string;
  };

  // Target / resource affected
  targetType: string; // "employees" | "leaves" | "workOutside" | "systemSettings" ...
  targetId: string;
  targetName?: string;

  // Change tracking — always present (stamped {} server-side when an action
  // has no natural prior/new state, e.g. login/logout, so every stored entry
  // has both fields rather than sometimes omitting them).
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  changedFields?: string[];

  // Intent + outcome
  reason?: string;
  status: "SUCCESS" | "FAILED";
  errorMessage?: string;

  // Technical context — only what's obtainable from a static-export client app;
  // ipAddress/requestMethod stay undefined unless a future Cloud Function populates them.
  ipAddress?: string;
  userAgent?: string;
  requestUrl?: string;
  requestMethod?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

  // Multi-tenancy — unused today (single-tenant SSMI portal) but reserved for
  // if the app ever splits by company/branch.
  companyId?: string;
  branchId?: string;

  createdAt: string; // ISO 8601
}
