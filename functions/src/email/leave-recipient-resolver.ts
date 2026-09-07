// =========================================================================
// 👥 Leave notification recipients
//
// Resolves *who* gets told about a leave request at each step. Permissions
// are read the way firestore.rules reads them — roles → userRoles →
// employees — never off an `employees.rolePermissions` / `employees.role`
// field: nothing in this repo or the admin repo ever writes those, so a
// direct query on them silently matches zero documents (the same bug that
// kept approver push notifications from ever firing).
// =========================================================================

export type RoleFlag = "approveBranch" | "approveDepartment" | "manageLeave";

export type LeaveRecipientSource = {
  leaveUserUuid?: string;
  createdByUid?: string;
  workLocationUid?: string;
  departmentUid?: string;
};

export type ApplicantContact = {
  email: string;
  name: string;
};

/**
 * Employees holding `flag`, scoped to a work location and — when
 * `departmentUid` is given — to that department too.
 */
export async function resolveEmployeesWithRoleFlag(
  db: FirebaseFirestore.Firestore,
  flag: RoleFlag,
  workLocationUid: string,
  departmentUid?: string,
): Promise<FirebaseFirestore.DocumentSnapshot[]> {
  const rolesSnap = await db.collection("roles").get();
  const roleIds = rolesSnap.docs
    .filter((d) => d.data()?.role?.[flag] === true)
    .map((d) => d.id);
  if (roleIds.length === 0) return [];

  const uids = new Set<string>();
  // `in` takes at most 30 values per query.
  for (let i = 0; i < roleIds.length; i += 30) {
    const batch = roleIds.slice(i, i + 30);
    const snap = await db
      .collection("userRoles")
      .where("roleId", "in", batch)
      .get();
    snap.docs.forEach((d) => uids.add(d.id));
  }
  if (uids.size === 0) return [];

  const empRefs = [...uids].map((uid) => db.collection("employees").doc(uid));
  const empDocs = await db.getAll(...empRefs);

  return empDocs.filter((d) => {
    if (!d.exists) return false;
    const data = d.data()!;
    if (data.workLocation?.uuid !== workLocationUid) return false;
    if (departmentUid && data.department?.uuid !== departmentUid) return false;
    return true;
  });
}

function dedupeExcludingApplicant(
  docLists: FirebaseFirestore.DocumentSnapshot[][],
  leave: LeaveRecipientSource,
): FirebaseFirestore.DocumentSnapshot[] {
  const applicantUid = leave.leaveUserUuid || leave.createdByUid;
  const seen = new Set<string>();
  const result: FirebaseFirestore.DocumentSnapshot[] = [];
  for (const docs of docLists) {
    for (const d of docs) {
      if (d.id === applicantUid || seen.has(d.id)) continue;
      seen.add(d.id);
      result.push(d);
    }
  }
  return result;
}

/**
 * Step 1 approvers — the `departmentHead` slot. `approveBranch` covers every
 * department in the branch; `approveDepartment` is confined to the
 * applicant's own department. Both approve at the same slot, so both are
 * notified. The applicant is never notified about their own request.
 */
export async function resolveLeaveDepartmentHeadDocs(
  db: FirebaseFirestore.Firestore,
  leave: LeaveRecipientSource,
): Promise<FirebaseFirestore.DocumentSnapshot[]> {
  if (!leave.workLocationUid) return [];

  const [branchDocs, deptDocs] = await Promise.all([
    resolveEmployeesWithRoleFlag(db, "approveBranch", leave.workLocationUid),
    leave.departmentUid
      ? resolveEmployeesWithRoleFlag(
          db,
          "approveDepartment",
          leave.workLocationUid,
          leave.departmentUid,
        )
      : Promise.resolve([]),
  ]);

  return dedupeExcludingApplicant([branchDocs, deptDocs], leave);
}

/**
 * Step 2 approvers — HR, identified by `manageLeave`, scoped to the
 * applicant's branch.
 */
export async function resolveLeaveHrDocs(
  db: FirebaseFirestore.Firestore,
  leave: LeaveRecipientSource,
): Promise<FirebaseFirestore.DocumentSnapshot[]> {
  if (!leave.workLocationUid) return [];

  const hrDocs = await resolveEmployeesWithRoleFlag(
    db,
    "manageLeave",
    leave.workLocationUid,
  );

  return dedupeExcludingApplicant([hrDocs], leave);
}

/** Lowercased, de-duplicated addresses for a set of employee documents. */
export function emailsFromEmployeeDocs(
  docs: FirebaseFirestore.DocumentSnapshot[],
): string[] {
  const emails = new Set<string>();
  for (const d of docs) {
    const email = d.data()?.email;
    if (typeof email === "string" && email.includes("@")) {
      emails.add(email.trim().toLowerCase());
    }
  }
  return [...emails];
}

function employeeDisplayName(data: FirebaseFirestore.DocumentData): string {
  const lo = [data.firstNameLo, data.lastNameLo].filter(Boolean).join(" ").trim();
  if (lo) return lo;
  const en = [data.firstNameEn, data.lastNameEn].filter(Boolean).join(" ").trim();
  return en || data.email || "";
}

/**
 * The applicant themselves. Looks the employee up by document id first (the
 * repo's convention) and falls back to the `uid` field for the legacy docs
 * whose id doesn't match it.
 */
export async function resolveLeaveApplicant(
  db: FirebaseFirestore.Firestore,
  leave: LeaveRecipientSource,
): Promise<ApplicantContact | null> {
  const applicantUid = leave.leaveUserUuid || leave.createdByUid;
  if (!applicantUid) return null;

  let data: FirebaseFirestore.DocumentData | undefined;

  const direct = await db.collection("employees").doc(applicantUid).get();
  if (direct.exists) {
    data = direct.data();
  } else {
    const byField = await db
      .collection("employees")
      .where("uid", "==", applicantUid)
      .limit(1)
      .get();
    data = byField.docs[0]?.data();
  }

  const email = data?.email;
  if (typeof email !== "string" || !email.includes("@")) return null;

  return {
    email: email.trim().toLowerCase(),
    name: employeeDisplayName(data!),
  };
}
