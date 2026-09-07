"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEmployeesWithRoleFlag = resolveEmployeesWithRoleFlag;
exports.resolveLeaveDepartmentHeadDocs = resolveLeaveDepartmentHeadDocs;
exports.resolveLeaveHrDocs = resolveLeaveHrDocs;
exports.emailsFromEmployeeDocs = emailsFromEmployeeDocs;
exports.resolveLeaveApplicant = resolveLeaveApplicant;
/**
 * Employees holding `flag`, scoped to a work location and — when
 * `departmentUid` is given — to that department too.
 */
async function resolveEmployeesWithRoleFlag(db, flag, workLocationUid, departmentUid) {
    const rolesSnap = await db.collection("roles").get();
    const roleIds = rolesSnap.docs
        .filter((d) => { var _a, _b; return ((_b = (_a = d.data()) === null || _a === void 0 ? void 0 : _a.role) === null || _b === void 0 ? void 0 : _b[flag]) === true; })
        .map((d) => d.id);
    if (roleIds.length === 0)
        return [];
    const uids = new Set();
    // `in` takes at most 30 values per query.
    for (let i = 0; i < roleIds.length; i += 30) {
        const batch = roleIds.slice(i, i + 30);
        const snap = await db
            .collection("userRoles")
            .where("roleId", "in", batch)
            .get();
        snap.docs.forEach((d) => uids.add(d.id));
    }
    if (uids.size === 0)
        return [];
    const empRefs = [...uids].map((uid) => db.collection("employees").doc(uid));
    const empDocs = await db.getAll(...empRefs);
    return empDocs.filter((d) => {
        var _a, _b;
        if (!d.exists)
            return false;
        const data = d.data();
        if (((_a = data.workLocation) === null || _a === void 0 ? void 0 : _a.uuid) !== workLocationUid)
            return false;
        if (departmentUid && ((_b = data.department) === null || _b === void 0 ? void 0 : _b.uuid) !== departmentUid)
            return false;
        return true;
    });
}
function dedupeExcludingApplicant(docLists, leave) {
    const applicantUid = leave.leaveUserUuid || leave.createdByUid;
    const seen = new Set();
    const result = [];
    for (const docs of docLists) {
        for (const d of docs) {
            if (d.id === applicantUid || seen.has(d.id))
                continue;
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
async function resolveLeaveDepartmentHeadDocs(db, leave) {
    if (!leave.workLocationUid)
        return [];
    const [branchDocs, deptDocs] = await Promise.all([
        resolveEmployeesWithRoleFlag(db, "approveBranch", leave.workLocationUid),
        leave.departmentUid
            ? resolveEmployeesWithRoleFlag(db, "approveDepartment", leave.workLocationUid, leave.departmentUid)
            : Promise.resolve([]),
    ]);
    return dedupeExcludingApplicant([branchDocs, deptDocs], leave);
}
/**
 * Step 2 approvers — HR, identified by `manageLeave`, scoped to the
 * applicant's branch.
 */
async function resolveLeaveHrDocs(db, leave) {
    if (!leave.workLocationUid)
        return [];
    const hrDocs = await resolveEmployeesWithRoleFlag(db, "manageLeave", leave.workLocationUid);
    return dedupeExcludingApplicant([hrDocs], leave);
}
/** Lowercased, de-duplicated addresses for a set of employee documents. */
function emailsFromEmployeeDocs(docs) {
    var _a;
    const emails = new Set();
    for (const d of docs) {
        const email = (_a = d.data()) === null || _a === void 0 ? void 0 : _a.email;
        if (typeof email === "string" && email.includes("@")) {
            emails.add(email.trim().toLowerCase());
        }
    }
    return [...emails];
}
function employeeDisplayName(data) {
    const lo = [data.firstNameLo, data.lastNameLo].filter(Boolean).join(" ").trim();
    if (lo)
        return lo;
    const en = [data.firstNameEn, data.lastNameEn].filter(Boolean).join(" ").trim();
    return en || data.email || "";
}
/**
 * The applicant themselves. Looks the employee up by document id first (the
 * repo's convention) and falls back to the `uid` field for the legacy docs
 * whose id doesn't match it.
 */
async function resolveLeaveApplicant(db, leave) {
    var _a;
    const applicantUid = leave.leaveUserUuid || leave.createdByUid;
    if (!applicantUid)
        return null;
    let data;
    const direct = await db.collection("employees").doc(applicantUid).get();
    if (direct.exists) {
        data = direct.data();
    }
    else {
        const byField = await db
            .collection("employees")
            .where("uid", "==", applicantUid)
            .limit(1)
            .get();
        data = (_a = byField.docs[0]) === null || _a === void 0 ? void 0 : _a.data();
    }
    const email = data === null || data === void 0 ? void 0 : data.email;
    if (typeof email !== "string" || !email.includes("@"))
        return null;
    return {
        email: email.trim().toLowerCase(),
        name: employeeDisplayName(data),
    };
}
//# sourceMappingURL=leave-recipient-resolver.js.map