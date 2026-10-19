import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";
import webpush from "web-push";
import { sendResendEmail } from "./email/resend";
import { assertCallerOwnsAttendance } from "./attendance-auth";
import {
  calcWorkHours,
  computeOTCheckInStatus,
  pickTodayOTRequest,
  type OTRequestLike,
} from "./attendance-ot";
import {
  computeBaseCheckInStatus,
  minutesToHhmm,
  pickActivePolicies,
  resolveCheckIn,
  resolveCheckOutCutoff,
  resolvePolicyTimes,
  type PolicyChoice,
  type ResolvedPolicy,
  type SpecialPolicyLike,
} from "./special-policy";
import {
  employeeAudienceKeys,
  gradeAnswers,
  isInAudience,
  toShowResult,
  validateAnswers,
  type AnswerKey,
  type AudienceEmployee,
  type FormSection,
  type QuizScore,
  type ShowResult,
} from "./forms";
import {
  ADMIN_LEAVE_URL,
  APPROVER_ROLE_LABEL,
  PORTAL_APPROVAL_URL,
  PORTAL_DASHBOARD_URL,
  renderLeaveEmailHtml,
  type LeaveDecider,
  type LeaveEmailData,
  type LeaveEmailType,
} from "./email/portal-leave-email";
import {
  emailsFromEmployeeDocs,
  resolveEmployeesWithRoleFlag,
  resolveLeaveApplicant,
  resolveLeaveDepartmentHeadDocs,
  resolveLeaveHrDocs,
} from "./email/leave-recipient-resolver";
import {
  PORTAL_APPROVAL_OFFSITE_URL,
  PORTAL_REQUEST_OFFSITE_URL,
  renderOffsiteEmailHtml,
  type OffsiteEmailType,
} from "./email/portal-offsite-email";
import {
  resolveOffsiteRequesterRecipient,
  resolveOffsiteTeammateRecipients,
  type EmailRecipient,
  type OffsiteRecipientSource,
} from "./email/offsite-recipient-resolver";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

// VAPID keys ພ້ອມໃຊ້ທີ່ module level ໃນ Cloud Functions v2 (process.env ຖືກ inject ກ່ອນ function run)
// ເອີ້ນຄັ້ງດຽວທີ່ module level — ບໍ່ຕ້ອງເອີ້ນຊ້ຳທຸກ invocation
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:admin@ssmi-hrm.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

const TIMEZONE = "Asia/Vientiane";

// ໃຊ້ 'not_check_in' ໃຫ້ສອດຄ່ອງກັນກັບຄ່າທີ່ computeCheckInStatus ສົ່ງກັບ
type CheckInStatus = "present" | "late" | "not_check_in";

type ServerTimeResult = {
  date: string; // ວັນ-ເດືອນ-ປີ (DD-MM-YYYY)
  isoDate: string; // ປີ-ເດືອນ-ວັນ (YYYY-MM-DD)
  checkTime: string; // ຊົ່ວໂມງ:ນາທີ (HH:mm)
  status: CheckInStatus;
  isLate: boolean;
  timestamp: number;
};

function getVientianeParts(): Omit<ServerTimeResult, "isLate" | "timestamp"> {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "00";

  const day = get("day");
  const month = get("month");
  const year = get("year");
  const hour = get("hour");
  const minute = get("minute");

  return {
    date: `${day}-${month}-${year}`,
    isoDate: `${year}-${month}-${day}`,
    checkTime: `${hour}:${minute}`,
    status: "present",
  };
}

function toMinuteOfDay(hour: number, minute: number): number {
  return hour * 60 + minute;
}

// ເສັ້ນຕັດຢູ່ special-policy.ts (baseCheckInThresholds):
//   ລາພັກເຄິ່ງເຊົ້າ: ທັນ <= 12:30 | ສາຍ 12:31–14:00 | ບໍ່ check-in > 14:00
//   ອອກວຽກນອກ:    ທັນ < 09:00  | ສາຍ 09:00–09:59 | ບໍ່ check-in >= 10:00
//   ປົກກະຕິ:       ທັນ <= 08:15 | ສາຍ 08:16–09:59 | ບໍ່ check-in >= 10:00
function computeCheckInStatus(
  nowMinutes: number,
  hasMorningLeaveEndToday: boolean,
  isOffsite?: boolean,
): CheckInStatus {
  return computeBaseCheckInStatus(
    nowMinutes,
    hasMorningLeaveEndToday ? "morningLeave" : isOffsite ? "offsite" : "normal",
  );
}

type LeaveLike = {
  startDate?: string;
  endDate?: string;
  startPeriod?: string;
  endPeriod?: string;
  status?: string;
};

const callableCorsOrigins: Array<string | RegExp> = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://hrmapp.ssmilaos.com", // Production web app
  "https://demohrm.ssmilaos.com", // Staging
  /^https:\/\/.*\.web\.app$/,
  /^https:\/\/.*\.firebaseapp\.com$/,
];

// ຄຳນວນ leave status ສຳລັບວັນ isoDate ໜຶ່ງ:
//   'blocked'      — ລາພັກທັງໝົດ, ຫ້າມ Check-In
//   'morning_leave'— ລາພັກເຄິ່ງເຊົ້າ, Check-In ໄດ້ ແຕ່ threshold ຊ້ານານຂຶ້ນ (ທັນ ≤12:30)
//   'none'         — ວັນທຳມະດາ
async function getDayLeaveStatus(
  userUuid: string | undefined,
  isoDate: string,
): Promise<"blocked" | "morning_leave" | "none"> {
  if (!userUuid) return "none";

  const snapshot = await admin
    .firestore()
    .collection("leaves")
    .where("leaveUserUuid", "==", userUuid)
    .where("status", "==", "approved")
    .get();

  for (const d of snapshot.docs) {
    const leave = d.data() as LeaveLike;
    const startDate = leave.startDate ?? "";
    const endDate = leave.endDate ?? "";
    const startPeriod = (leave.startPeriod ?? "morning").toLowerCase();
    // ຮັກສາ 'monning' ໄວ້ເພື່ອ compatibility ກັບຂໍ້ມູນເກົ່າ
    const rawEnd = (leave.endPeriod ?? "afternoon").toLowerCase();
    const endPeriod = rawEnd === "monning" ? "morning" : rawEnd;

    if (!startDate || !endDate || isoDate < startDate || isoDate > endDate)
      continue;

    // ວັນກາງ — ລາພັກທັງໝົດ
    if (isoDate > startDate && isoDate < endDate) return "blocked";

    if (isoDate === startDate && isoDate === endDate) {
      if (startPeriod === "morning" && endPeriod === "afternoon")
        return "blocked";
      if (endPeriod === "morning") return "morning_leave";
      continue; // ລາພັກບ່າຍ — Check-In ປົກກະຕິ
    }

    if (isoDate === startDate) {
      if (startPeriod === "morning") return "blocked";
      continue; // ເລີ່ມບ່າຍ — Check-In ໄດ້
    }

    // isoDate === endDate (isoDate > startDate)
    return endPeriod === "afternoon" ? "blocked" : "morning_leave";
  }

  return "none";
}

// ຮັກສາ backward-compat ສຳລັບ getServerTime endpoint
async function hasMorningLeaveEndingToday(
  userUuid: string | undefined,
  isoDate: string,
): Promise<boolean> {
  return (await getDayLeaveStatus(userUuid, isoDate)) === "morning_leave";
}

// ນະໂຍບາຍພິເສດ (specialPolicy) ທີ່ຄຸ້ມ uid ໃນວັນ isoDate, ລວມເປັນອັນດຽວແລ້ວ. query ດ້ວຍ
// array-contains ຢ່າງດຽວ ແລ້ວກັ່ນ status/ວັນທີ ໃນໂຄ້ດ — ບໍ່ຕ້ອງມີ composite index
// (ຄືກັບ findTodayOTRequest). ອ່ານບໍ່ໄດ້ → ຖືວ່າບໍ່ມີນະໂຍບາຍ (ເວລາປົກກະຕິ).
async function getTodaySpecialPolicy(
  uid: string,
  isoDate: string,
): Promise<ResolvedPolicy | null> {
  try {
    const snap = await admin
      .firestore()
      .collection("specialPolicy")
      .where("staffUuids", "array-contains", uid)
      .get();
    const policies = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<SpecialPolicyLike, "id">) }),
    );
    return resolvePolicyTimes(pickActivePolicies(policies, uid, isoDate));
  } catch (err) {
    console.warn(`[specialPolicy] failed to resolve policy for ${uid}`, err);
    return null;
  }
}

// field ທີ່ບັນທຶກລົງ attendance ເມື່ອມີນະໂຍບາຍ — ໃຫ້ recordCheckOut / ລາຍງານ ອ່ານຄືນໄດ້
// ໂດຍບໍ່ຕ້ອງອີງໃສ່ນະໂຍບາຍທີ່ອາດຖືກແກ້/ລຶບພາຍຫຼັງ
function policyAttendanceFields(
  policy: ResolvedPolicy | null,
  policyChoice: PolicyChoice | undefined,
): Record<string, string> {
  // custom ທີ່ບໍ່ມີ choice (check-in ຫຼັງ lateUntil) = ບໍ່ໄດ້ໃຊ້ນະໂຍບາຍ — ບໍ່ບັນທຶກ ເພື່ອບໍ່ໃຫ້
  // penalty / ເວລາເລີກ ອ່ານ policyLateUntil / policyLeaveFrom ໄປໃຊ້
  if (!policy || (policy.isCustom && !policyChoice)) return {};
  return {
    specialPolicyId: policy.policyId,
    ...(policy.lateUntilMin != null ? { policyLateUntil: minutesToHhmm(policy.lateUntilMin) } : {}),
    ...(policy.leaveFromMin != null ? { policyLeaveFrom: minutesToHhmm(policy.leaveFromMin) } : {}),
    ...(policyChoice ? { policyChoice } : {}),
  };
}

// =========================================================================
// 🌐 1. ດຶງເວລາ Server
// =========================================================================
export const getServerTime = onCall(
  { region: "asia-southeast1", cors: callableCorsOrigins, invoker: "public" },
  async (request): Promise<ServerTimeResult> => {
    const { date, checkTime, isoDate } = getVientianeParts();
    const [hourStr, minuteStr] = checkTime.split(":");
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const userUuid =
      typeof request.data?.userUuid === "string"
        ? request.data.userUuid
        : undefined;
    const morningLeaveEndToday = await hasMorningLeaveEndingToday(
      userUuid,
      isoDate,
    );
    const status = computeCheckInStatus(
      toMinuteOfDay(hour, minute),
      morningLeaveEndToday,
    );
    const isLate = status === "late";

    return { date, isoDate, checkTime, status, isLate, timestamp: Date.now() };
  },
);

// =========================================================================
// 🔐 1b. SYNC userRoles/{uid} + employeeCompensation/{uid} FROM employees/{uid}
//
// employees/{uid} stays client-writable (within the security-rules field
// allowlist) and the admin repo (HRM-System-SSMI) is still the only place
// that assigns `rolesUid` or edits `salary` — this function does not change
// that. It mirrors those two fields into collections that firestore.rules
// trusts for permission checks (userRoles) and that are properly access-
// scoped for pay data (employeeCompensation), without requiring the admin
// repo to change how or where it writes. Deleting `salary`/`rolesUid` from
// employees entirely is a follow-up that needs the admin repo updated in
// lockstep (see the migration plan's hand-off checklist).
// =========================================================================
export const syncEmployeeMirrors = onDocumentWritten(
  { document: "employees/{docId}", region: "asia-southeast1" },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    // Some legacy employee docs have a Firestore doc ID that doesn't match
    // their `uid` field (see the fallback query in lib/employees.ts
    // resolveEmployeeDocRef) — the `uid` field, not the doc ID, is this
    // codebase's primary key convention, so mirrors must be keyed by it or
    // client-side lookups keyed by the real auth uid would miss them.
    const uid: string | undefined = after?.uid || before?.uid || event.params.docId;
    if (!uid) return;
    const db = admin.firestore();

    // Document deleted — clean up the mirrors too.
    if (!after) {
      await Promise.all([
        db.collection("userRoles").doc(uid).delete(),
        db.collection("employeeCompensation").doc(uid).delete(),
      ]);
      return;
    }

    const writes: Promise<unknown>[] = [];

    // The `uid` field gets repointed at a different Firebase Auth user
    // whenever an account is re-linked — lib/employees.ts
    // updateEmployeeUidByEmail used to do exactly that after an email change
    // (removed: the portal now requires auth uid === employees doc id and HR
    // relinks with HRM-System-SSMI/functions/scripts/relink-auth-uid.js), when
    // the person signs in with a Google account the old uid never belonged
    // to. Both mirrors are keyed by uid, so that rename used to orphan
    // userRoles/{oldUid} and — since rolesUid/salary themselves did not
    // change — nothing ever created userRoles/{newUid}. The employee could
    // then sign in but resolve no role at all (no menus, no approval rights).
    // Treat a uid change as "move both mirrors to the new key".
    const previousUid: string | undefined = before?.uid;
    const uidChanged = !!previousUid && previousUid !== uid;

    if (uidChanged) {
      writes.push(
        db.collection("userRoles").doc(previousUid).delete(),
        db.collection("employeeCompensation").doc(previousUid).delete(),
      );
    }

    if (uidChanged || after.rolesUid !== before?.rolesUid) {
      writes.push(
        after.rolesUid
          ? db
              .collection("userRoles")
              .doc(uid)
              .set({
                uid,
                roleId: after.rolesUid,
                syncedAt: admin.firestore.FieldValue.serverTimestamp(),
              })
          : db.collection("userRoles").doc(uid).delete(),
      );
    }

    if (uidChanged || after.salary !== before?.salary) {
      writes.push(
        after.salary != null
          ? db
              .collection("employeeCompensation")
              .doc(uid)
              .set(
                {
                  uid,
                  currency: "LAK",
                  current: { baseSalary: after.salary },
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true },
              )
          : db.collection("employeeCompensation").doc(uid).delete(),
      );
    }

    await Promise.all(writes);
  },
);

// =========================================================================
// 🔐 1c. ONE-TIME BACKFILL — userRoles/{uid} + employeeCompensation/{uid}
//        FOR EMPLOYEES THAT PRE-DATE syncEmployeeMirrors
//
// syncEmployeeMirrors only writes on a rolesUid/salary *change* — it never
// retroactively creates mirrors for existing employees whose role hasn't
// been touched since it was deployed. This callable does that one-time
// catch-up. Safe to re-run (set(), not create()).
//
// Admin-gated the same way firestore.rules' isAdmin() resolves it — off
// employees/{uid}.rolesUid directly, not userRoles — so this doesn't
// depend on the very collection it's backfilling.
// =========================================================================
export const backfillUserRoleMirrors = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }
    const db = admin.firestore();

    const callerDoc = await db.collection("employees").doc(request.auth.uid).get();
    const callerRolesUid = callerDoc.data()?.rolesUid as string | undefined;
    const callerRoleDoc = callerRolesUid
      ? await db.collection("roles").doc(callerRolesUid).get()
      : null;
    if (!callerRoleDoc?.data()?.role?.loginAdmin) {
      throw new HttpsError("permission-denied", "Admin only");
    }

    const employeesSnap = await db.collection("employees").get();

    let batch = db.batch();
    let opsInBatch = 0;
    let userRolesWritten = 0;
    let compensationWritten = 0;
    const BATCH_LIMIT = 400; // Firestore hard cap is 500 writes/batch

    const flushIfNeeded = async () => {
      if (opsInBatch >= BATCH_LIMIT) {
        await batch.commit();
        batch = db.batch();
        opsInBatch = 0;
      }
    };

    for (const doc of employeesSnap.docs) {
      const data = doc.data();
      const uid: string | undefined = data.uid || doc.id;
      if (!uid) continue;

      if (data.rolesUid) {
        batch.set(db.collection("userRoles").doc(uid), {
          uid,
          roleId: data.rolesUid,
          syncedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        opsInBatch++;
        userRolesWritten++;
        await flushIfNeeded();
      }

      if (data.salary != null) {
        batch.set(
          db.collection("employeeCompensation").doc(uid),
          {
            uid,
            currency: "LAK",
            current: { baseSalary: data.salary },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        opsInBatch++;
        compensationWritten++;
        await flushIfNeeded();
      }
    }

    if (opsInBatch > 0) {
      await batch.commit();
    }

    return {
      employeesScanned: employeesSnap.size,
      userRolesWritten,
      compensationWritten,
    };
  },
);

// =========================================================================
// 🔔 2. ກວດສອບ + ສົ່ງ Push Notification ແຈ້ງເຕືອນ
// =========================================================================
const PUSH_BATCH_SIZE = 20;

// Sends to one device doc under employees/{uid}/devices — replaces the old
// single pushSubscription field so an employee with a phone + a desktop
// gets notified on both, not just whichever logged in most recently. On a
// dead subscription (410/404), only that one device doc is removed.
async function sendToDevice(
  db: FirebaseFirestore.Firestore,
  employeeUid: string,
  deviceDoc: FirebaseFirestore.QueryDocumentSnapshot,
  payload: string,
  tag: string,
): Promise<boolean> {
  const data = deviceDoc.data();
  const subscription = {
    endpoint: data.endpoint,
    keys: data.keys,
    expirationTime: data.expirationTime ?? null,
  };
  if (!subscription.endpoint || !subscription.keys) return false;

  return webpush
    .sendNotification(subscription, payload)
    .then(() => true)
    .catch(async (err: any) => {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await db
          .collection("employees")
          .doc(employeeUid)
          .collection("devices")
          .doc(deviceDoc.id)
          .delete();
        console.warn(
          `[${tag}]: removed stale device ${deviceDoc.id} for ${employeeUid}`,
        );
      } else {
        console.error(
          `[${tag}]: failed to notify ${employeeUid}/${deviceDoc.id}:`,
          err,
        );
      }
      return false;
    });
}

async function sendAttendanceReminder(tag: string) {
  const { isoDate } = getVientianeParts();
  console.log(`[Cron ${tag}]: checking not-checked-in for ${isoDate}`);

  const db = admin.firestore();

  const snapshot = await db
    .collection("attendance")
    .where("dateKey", "==", isoDate)
    .where("status", "==", "not_checked_in")
    .get();

  if (snapshot.empty) {
    console.log(`[Cron ${tag}]: all employees checked in today.`);
    return;
  }

  const payload = JSON.stringify({
    title: "🚨 ເຕືອນ Check-in ເຂົ້າວຽກ!",
    body: "ຮອດເວລາແລ້ວ! ກະລຸນາກົດບັນທຶກເວລາເຂົ້າວຽກຂອງທ່ານຕອນນີ້.",
    icon: "/apple-icon.png",
    badge: "/SSMI.svg",
    url: "/dashboard/attendance",
  });

  const userUids = [
    ...new Set(
      snapshot.docs.map((d) => d.data().uid as string).filter(Boolean),
    ),
  ];

  const employeeRefs = userUids.map((uid) =>
    db.collection("employees").doc(uid),
  );
  const employeeDocs = await db.getAll(...employeeRefs);

  // ຜູ້ທີ່ມີນະໂຍບາຍພິເສດມື້ນີ້ ໃຫ້ມາທັນຫຼັງ 08:15 — ບໍ່ແຈ້ງ "ໃກ້ຈະສາຍ" ຜິດໆ.
  // ອ່ານ specialPolicy ທັງໝົດຄັ້ງດຽວ (ບໍ່ query ຕໍ່ຄົນ). ອ່ານບໍ່ໄດ້ → ແຈ້ງເຕືອນທຸກຄົນຄືເກົ່າ
  const lateMorningUids = new Set<string>();
  try {
    const policySnap = await db.collection("specialPolicy").get();
    const policies = policySnap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<SpecialPolicyLike, "id">) }),
    );
    for (const uid of userUids) {
      const policy = resolvePolicyTimes(pickActivePolicies(policies, uid, isoDate));
      if (policy?.lateUntilMin != null && policy.lateUntilMin > 8 * 60 + 15) {
        lateMorningUids.add(uid);
      }
    }
  } catch (err) {
    console.warn(`[Cron ${tag}]: failed to read specialPolicy`, err);
  }

  // ກັ່ນກອງ employee ທີ່ແຈ້ງເຕືອນແລ້ວໃນ tag ນີ້ (ກັນແຈ້ງເຕືອນຊ້ຳ)
  const notifiedField = `notified_${tag}`;
  const eligibleDocs = employeeDocs.filter((empDoc) => {
    if (!empDoc.exists) return false;
    if (lateMorningUids.has(empDoc.id)) return false;
    const data = empDoc.data();
    if (data?.[notifiedField] === isoDate) return false;
    return true;
  });

  const allResults: boolean[] = [];
  for (let i = 0; i < eligibleDocs.length; i += PUSH_BATCH_SIZE) {
    const batchDocs = eligibleDocs.slice(i, i + PUSH_BATCH_SIZE);
    const batchResults = await Promise.all(
      batchDocs.map(async (empDoc) => {
        const devicesSnap = await db
          .collection("employees")
          .doc(empDoc.id)
          .collection("devices")
          .get();
        if (devicesSnap.empty) return false;

        const deviceResults = await Promise.all(
          devicesSnap.docs.map((deviceDoc) =>
            sendToDevice(db, empDoc.id, deviceDoc, payload, tag),
          ),
        );
        const anySent = deviceResults.some(Boolean);
        if (anySent) {
          await db
            .collection("employees")
            .doc(empDoc.id)
            .update({ [notifiedField]: isoDate });
        }
        return anySent;
      }),
    );
    allResults.push(...batchResults);
  }

  const notified = allResults.filter(Boolean).length;
  console.log(
    `[Cron ${tag}]: Notified ${notified} / ${eligibleDocs.length} eligible (${snapshot.size} not checked in)`,
  );
}

// =========================================================================
// ⏰ 3. CRON JOB 08:00 (ຈັນ–ສຸກ)
// =========================================================================
export const checkAttendanceAt800 = onSchedule(
  { schedule: "0 8 * * 1-5", timeZone: TIMEZONE, region: "asia-southeast1" },
  async () => {
    await sendAttendanceReminder("0800");
  },
);

// =========================================================================
// ⏰ 4. CRON JOB 08:14 (ຈັນ–ສຸກ)
// =========================================================================
export const checkAttendanceAt814 = onSchedule(
  { schedule: "14 8 * * 1-5", timeZone: TIMEZONE, region: "asia-southeast1" },
  async () => {
    await sendAttendanceReminder("0814");
  },
);

// =========================================================================
// 🔔 4b. ແຈ້ງເຕືອນ APPROVER ເມື່ອມີໃບລາພັກ / ຄຳຂໍອອກນອກສະຖານທີ່ໃໝ່
// (real server push — ໄດ້ຮັບເຖິງແມ່ນປິດແອັບ, ຕ່າງຈາກ client-side Notification
// ໃນ NotificationProvider.tsx ທີ່ໄດ້ຮັບສະເພາະຕອນເປີດແທັບຄ້າງໄວ້)
// =========================================================================

async function sendPushToEmployeeDocs(
  employeeDocs: FirebaseFirestore.DocumentSnapshot[],
  payload: string,
  tag: string,
): Promise<number> {
  const db = admin.firestore();
  let notified = 0;

  for (let i = 0; i < employeeDocs.length; i += PUSH_BATCH_SIZE) {
    const batchDocs = employeeDocs.slice(i, i + PUSH_BATCH_SIZE);
    const results = await Promise.all(
      batchDocs.map(async (empDoc) => {
        const devicesSnap = await db
          .collection("employees")
          .doc(empDoc.id)
          .collection("devices")
          .get();
        if (devicesSnap.empty) return false;

        const deviceResults = await Promise.all(
          devicesSnap.docs.map((deviceDoc) =>
            sendToDevice(db, empDoc.id, deviceDoc, payload, tag),
          ),
        );
        return deviceResults.some(Boolean);
      }),
    );
    notified += results.filter(Boolean).length;
  }

  return notified;
}

// Role resolution used to live here as resolveApproversForFlag. It now sits
// in ./email/leave-recipient-resolver so the push path and the email path
// share one implementation — see that file for why permissions are read via
// roles → userRoles → employees rather than off an employees field.
const resolveApproversForFlag = resolveEmployeesWithRoleFlag;

type LeaveCreatedDoc = {
  status?: string;
  type?: string;
  policyName?: string;
  duration?: number;
  startDate?: string;
  endDate?: string;
  leaveUserUuid?: string;
  leaveUserName?: string;
  createdByUid?: string;
  reason?: string;
  workLocationUid?: string;
  departmentUid?: string;
};

type LeaveApprovalStep = {
  role?: string;
  decision?: string;
  reviewedBy?: string;
  reviewedAt?: string;
};

/** A leave document as the update trigger sees it — the chain included. */
type LeaveDoc = LeaveCreatedDoc & {
  approvals?: LeaveApprovalStep[];
  rejectReason?: string;
};

function approvalSlot(leave: LeaveDoc, role: string): LeaveApprovalStep | undefined {
  return leave.approvals?.find((a) => a?.role === role);
}

/** Employee docs → the {email, name} pairs sendLeaveEmails expects. */
function recipientsFromDocs(
  docs: FirebaseFirestore.DocumentSnapshot[],
): { email: string; name: string }[] {
  return docs
    .map((d) => ({
      email: String(d.data()?.email ?? "").trim().toLowerCase(),
      name: employeeNameFromDoc(d),
    }))
    .filter((r) => r.email.includes("@"));
}

/** Narrows a leave document to just the fields the email template renders. */
function toLeaveEmailData(leave: LeaveCreatedDoc): LeaveEmailData {
  return {
    leaveUserName: leave.leaveUserName,
    type: leave.type,
    policyName: leave.policyName,
    duration: leave.duration,
    startDate: leave.startDate,
    endDate: leave.endDate,
    reason: leave.reason,
  };
}

/**
 * One email per recipient so the greeting can be personalised and so no
 * recipient sees the others' addresses. Sends run in parallel and each is
 * independently failure-tolerant — sendResendEmail never throws.
 */
async function sendLeaveEmails(params: {
  recipients: { email: string; name?: string }[];
  subject: string;
  leave: LeaveCreatedDoc;
  actionUrl: string;
  type: LeaveEmailType;
  rejectReason?: string;
  decidedBy?: LeaveDecider;
  approvers?: LeaveDecider[];
  tag: string;
}): Promise<number> {
  const {
    recipients, subject, leave, actionUrl, type, rejectReason, decidedBy, approvers, tag,
  } = params;
  if (recipients.length === 0) {
    console.log(`[email ${tag}]: no recipients resolved — skipped`);
    return 0;
  }

  const results = await Promise.all(
    recipients.map((recipient) =>
      sendResendEmail({
        to: [recipient.email],
        subject,
        html: renderLeaveEmailHtml({
          recipientName: recipient.name,
          applicantName: leave.leaveUserName,
          leave: toLeaveEmailData(leave),
          actionUrl,
          type,
          rejectReason,
          decidedBy,
          approvers,
        }),
        tag,
      }),
    ),
  );

  return results.filter(Boolean).length;
}

export const notifyNewLeaveRequest = onDocumentCreated(
  { document: "leaves/{leaveId}", region: "asia-southeast1" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const leave = snap.data() as LeaveCreatedDoc;

    if (leave.status !== "pending" || !leave.workLocationUid) return;

    const db = admin.firestore();
    // Same resolution the email path uses — one round of role lookups feeds
    // both the push and the email below.
    const approverDocs = await resolveLeaveDepartmentHeadDocs(db, leave);

    if (approverDocs.length === 0) return;

    const payload = JSON.stringify({
      title: "🔔 ມີໃບລາພັກໃໝ່!",
      body: `ພະນັກງານ: ${leave.leaveUserName || "ບໍ່ມີຊື່"} ສົ່ງຄຳຂໍລາພັກ`,
      icon: "/apple-icon.png",
      badge: "/SSMI.svg",
      url: "/dashboard/approv",
    });

    const notified = await sendPushToEmployeeDocs(approverDocs, payload, "leave-new");
    console.log(
      `[leave-new]: notified ${notified}/${approverDocs.length} approvers for ${event.params.leaveId}`,
    );

    // Touchpoint 1 — email the departmentHead approvers. Runs after the push
    // and never rethrows, so a mail problem cannot affect the request itself.
    const emailed = await sendLeaveEmails({
      recipients: recipientsFromDocs(approverDocs),
      subject: `[ລໍຖ້າອະນຸມັດ] ໃບລາພັກໃໝ່: ${leave.leaveUserName || "ບໍ່ມີຊື່"} (${leave.duration ?? "?"} ວັນ)`,
      leave,
      actionUrl: PORTAL_APPROVAL_URL,
      type: "departmentHead",
      tag: "leave-email-new",
    });
    console.log(
      `[leave-email-new]: emailed ${emailed} approver(s) for ${event.params.leaveId}`,
    );
  },
);

/** Lao name first, English second, address last — matches the push payloads. */
function employeeNameFromDoc(doc: FirebaseFirestore.DocumentSnapshot): string {
  const data = doc.data() ?? {};
  const lo = [data.firstNameLo, data.lastNameLo].filter(Boolean).join(" ").trim();
  if (lo) return lo;
  const en = [data.firstNameEn, data.lastNameEn].filter(Boolean).join(" ").trim();
  return en || String(data.email ?? "");
}

// =========================================================================
// 📧 Touchpoint 2 — the departmentHead slot gets decided
//
// Driven by the Firestore write rather than by the portal's click handler:
// the portal is a static export with no server, so a Resend key placed in
// page.tsx would ship to every browser (and Resend refuses browser origins
// anyway). Watching the document also means the mail fires no matter which
// client made the decision.
// =========================================================================
export const notifyLeaveDecisionEmail = onDocumentUpdated(
  { document: "leaves/{leaveId}", region: "asia-southeast1" },
  async (event) => {
    const before = event.data?.before?.data() as LeaveDoc | undefined;
    const after = event.data?.after?.data() as LeaveDoc | undefined;
    if (!before || !after) return;

    const db = admin.firestore();
    const leaveId = event.params.leaveId;

    // ── Step 1 cleared → hand the request to HR ──────────────────────────
    // Keyed on the slot rather than on `status`, because the request stays
    // `pending` until the whole chain signs off.
    const dhBefore = approvalSlot(before, "departmentHead")?.decision;
    const dhAfter = approvalSlot(after, "departmentHead")?.decision;
    if (dhBefore === "pending" && dhAfter === "approved") {
      const hrDocs = await resolveLeaveHrDocs(db, after);
      const emailed = await sendLeaveEmails({
        recipients: recipientsFromDocs(hrDocs),
        subject: `[ລໍຖ້າກວດສອບ HR] ໃບລາພັກ: ${after.leaveUserName || "ບໍ່ມີຊື່"} (ຫົວໜ້າພະແນກອະນຸມັດແລ້ວ)`,
        leave: after,
        actionUrl: ADMIN_LEAVE_URL,
        type: "hr",
        tag: "leave-email-hr",
      });
      console.log(
        `[leave-email-hr]: emailed ${emailed}/${emailsFromEmployeeDocs(hrDocs).length} HR for ${leaveId}`,
      );
    }

    // ── Applicant notices ────────────────────────────────────────────────
    // Driven by `status`, which services/leave-approval.ts recomputes from
    // the whole chain: any rejection anywhere → 'rejected', every slot
    // approved → 'approved'. So these fire for an HR or manager decision
    // too, not only the departmentHead's, and only on the transition — a
    // later write to the same document cannot re-send them.
    const becameApproved = before.status !== "approved" && after.status === "approved";
    const becameRejected = before.status !== "rejected" && after.status === "rejected";
    if (!becameApproved && !becameRejected) return;

    const applicant = await resolveLeaveApplicant(db, after);
    if (!applicant) {
      console.error(
        `[leave-email-applicant]: no applicant email resolved for ${leaveId}`,
      );
      return;
    }
    const recipients = [{ email: applicant.email, name: applicant.name }];

    if (becameApproved) {
      const emailed = await sendLeaveEmails({
        recipients,
        subject: `✅ ໃບລາພັກຂອງທ່ານໄດ້ຮັບການອະນຸມັດແລ້ວ (${after.duration ?? "?"} ວັນ)`,
        leave: after,
        actionUrl: PORTAL_DASHBOARD_URL,
        type: "approved",
        // The full chain, so the applicant sees every signature.
        approvers: (after.approvals ?? [])
          .filter((a) => a?.decision === "approved")
          .map((a) => ({ role: a.role, name: a.reviewedBy, at: a.reviewedAt })),
        tag: "leave-email-approved",
      });
      console.log(`[leave-email-approved]: emailed ${emailed} applicant for ${leaveId}`);
      return;
    }

    // Rejected: name the decider. The last rejected slot is the one that
    // ended the chain.
    const rejecter = [...(after.approvals ?? [])]
      .reverse()
      .find((a) => a?.decision === "rejected");

    const emailed = await sendLeaveEmails({
      recipients,
      subject: `❌ ໃບລາພັກຂອງທ່ານບໍ່ໄດ້ຮັບການອະນຸມັດ${
        rejecter?.role ? ` (${APPROVER_ROLE_LABEL[rejecter.role] ?? rejecter.role})` : ""
      }`,
      leave: after,
      actionUrl: PORTAL_DASHBOARD_URL,
      type: "rejected",
      rejectReason: after.rejectReason,
      decidedBy: rejecter
        ? { role: rejecter.role, name: rejecter.reviewedBy, at: rejecter.reviewedAt }
        : undefined,
      tag: "leave-email-reject",
    });
    console.log(`[leave-email-reject]: emailed ${emailed} applicant for ${leaveId}`);
  },
);

type WorkOutsideCreatedDoc = {
  status?: string;
  createdByUid?: string;
  createdBy?: string;
  subject?: string;
  departmentUid?: string;
  requesterWorkLocationUid?: string;
  requester?: { workLocation?: { uid?: string; uuid?: string; id?: string } };
};

export const notifyNewOffsiteRequest = onDocumentCreated(
  { document: "workOutside/{requestId}", region: "asia-southeast1" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const work = snap.data() as WorkOutsideCreatedDoc;

    if (work.status !== "pending") return;

    const workLocationUid =
      work.requesterWorkLocationUid ||
      work.requester?.workLocation?.uid ||
      work.requester?.workLocation?.uuid ||
      work.requester?.workLocation?.id;
    if (!workLocationUid) return;

    const db = admin.firestore();
    const [branchDocs, deptDocs] = await Promise.all([
      resolveApproversForFlag(db, "approveBranch", workLocationUid),
      work.departmentUid
        ? resolveApproversForFlag(
            db,
            "approveDepartment",
            workLocationUid,
            work.departmentUid,
          )
        : Promise.resolve([]),
    ]);

    const seen = new Set<string>();
    const approverDocs: FirebaseFirestore.DocumentSnapshot[] = [];
    for (const d of [...branchDocs, ...deptDocs]) {
      if (d.id === work.createdByUid || seen.has(d.id)) continue;
      seen.add(d.id);
      approverDocs.push(d);
    }

    if (approverDocs.length === 0) return;

    const payload = JSON.stringify({
      title: "🚗 ມີຄຳຂໍອອກນອກສະຖານທີ່ໃໝ່!",
      body: `ພະນັກງານ: ${work.createdBy || "ບໍ່ມີຊື່"} — ${work.subject || "ບໍ່ລະບຸ"}`,
      icon: "/apple-icon.png",
      badge: "/SSMI.svg",
      url: "/dashboard/approv?tab=offsite",
    });

    const notified = await sendPushToEmployeeDocs(approverDocs, payload, "offsite-new");
    console.log(
      `[offsite-new]: notified ${notified}/${approverDocs.length} approvers for ${event.params.requestId}`,
    );

    // Email the same departmentHead approvers. Runs after the push and never
    // rethrows, so a mail problem cannot affect the request itself.
    const offsite = work as OffsiteDoc;
    const requestNo = offsite.requestNo || event.params.requestId;
    const emailed = await sendOffsiteEmails({
      recipients: recipientsFromDocs(approverDocs),
      subject: `[ລໍຖ້າອະນຸມັດ] ໃບສະເໜີອອກວຽກນອກໃໝ່ ${requestNo}: ${work.createdBy || "ບໍ່ມີຊື່"}`,
      offsite,
      type: "departmentHead",
      // The approval page opens on its leave tab — without ?tab=offsite the
      // approver lands on the wrong queue.
      actionUrl: PORTAL_APPROVAL_OFFSITE_URL,
      tag: "offsite-email-new",
    });
    console.log(
      `[offsite-email-new]: emailed ${emailed} approver(s) for ${event.params.requestId}`,
    );
  },
);

// =========================================================================
// 📧 Work-outside status emails
//
// Routing is deliberately asymmetric:
//   approved → every teammate on the trip (`teammate[]`)
//   rejected → the requester ALONE — teammates are not told
// =========================================================================

type OffsiteDoc = OffsiteRecipientSource & {
  status?: string;
  requestNo?: string;
  subject?: string;
  startDate?: string;
  endDate?: string;
  durationDays?: number;
  rejectReason?: string | null;
  activityType?: { code?: string; name?: string };
  approvals?: LeaveApprovalStep[];
};

/**
 * One email per recipient — personalised greeting, and nobody sees anyone
 * else's address. Each send is independently failure-tolerant.
 */
async function sendOffsiteEmails(params: {
  recipients: EmailRecipient[];
  subject: string;
  offsite: OffsiteDoc;
  type: OffsiteEmailType;
  /** Where the CTA points. Ignored by the outcome notices, which always
   *  send the reader to their own dashboard. */
  actionUrl?: string;
  rejectReason?: string;
  decidedBy?: LeaveDecider;
  approvers?: LeaveDecider[];
  tag: string;
}): Promise<number> {
  const {
    recipients, subject, offsite, type, actionUrl, rejectReason, decidedBy, approvers, tag,
  } = params;
  if (recipients.length === 0) {
    console.log(`[email ${tag}]: no recipients resolved — skipped`);
    return 0;
  }

  const results = await Promise.all(
    recipients.map((recipient) =>
      sendResendEmail({
        to: [recipient.email],
        subject,
        html: renderOffsiteEmailHtml({
          recipientName: recipient.name,
          offsite: {
            requestNo: offsite.requestNo,
            requesterName:
              offsite.requester?.fullNameLo ||
              offsite.requester?.fullNameEn ||
              offsite.createdBy,
            activityTypeName: offsite.activityType?.name,
            subject: offsite.subject,
            startDate: offsite.startDate,
            endDate: offsite.endDate,
            durationDays: offsite.durationDays,
            teammateCount: offsite.teammate?.length,
          },
          actionUrl: actionUrl ?? PORTAL_REQUEST_OFFSITE_URL,
          type,
          rejectReason,
          decidedBy,
          approvers,
        }),
        tag,
      }),
    ),
  );

  return results.filter(Boolean).length;
}

export const notifyOffsiteDecisionEmail = onDocumentUpdated(
  { document: "workOutside/{requestId}", region: "asia-southeast1" },
  async (event) => {
    const before = event.data?.before?.data() as OffsiteDoc | undefined;
    const after = event.data?.after?.data() as OffsiteDoc | undefined;
    if (!before || !after) return;

    // Only the transition sends mail — later edits to a decided request must
    // not re-notify anyone.
    const becameApproved = before.status !== "approved" && after.status === "approved";
    const becameRejected = before.status !== "rejected" && after.status === "rejected";
    if (!becameApproved && !becameRejected) return;

    const requestId = event.params.requestId;
    const requestNo = after.requestNo || requestId;

    if (becameApproved) {
      const recipients = resolveOffsiteTeammateRecipients(after);
      const emailed = await sendOffsiteEmails({
        recipients,
        subject: `🎉 ໃບສະເໜີອອກວຽກນອກ ${requestNo} ໄດ້ຮັບການອະນຸມັດສົມບູນແລ້ວ`,
        offsite: after,
        type: "approved",
        actionUrl: PORTAL_REQUEST_OFFSITE_URL,
        approvers: (after.approvals ?? [])
          .filter((a) => a?.decision === "approved")
          .map((a) => ({ role: a.role, name: a.reviewedBy, at: a.reviewedAt })),
        tag: "offsite-email-approved",
      });
      console.log(
        `[offsite-email-approved]: emailed ${emailed}/${recipients.length} teammate(s) for ${requestId}`,
      );
      return;
    }

    // Rejected — requester only. resolveOffsiteTeammateRecipients is
    // deliberately not consulted here.
    const requester = await resolveOffsiteRequesterRecipient(
      admin.firestore(),
      after,
    );
    if (!requester) {
      console.error(
        `[offsite-email-reject]: no requester email resolved for ${requestId}`,
      );
      return;
    }

    const rejecter = [...(after.approvals ?? [])]
      .reverse()
      .find((a) => a?.decision === "rejected");

    const emailed = await sendOffsiteEmails({
      recipients: [requester],
      subject: `❌ ໃບສະເໜີອອກວຽກນອກ ${requestNo} ບໍ່ໄດ້ຮັບການອະນຸມັດ`,
      offsite: after,
      type: "rejected",
      actionUrl: PORTAL_REQUEST_OFFSITE_URL,
      rejectReason: after.rejectReason ?? undefined,
      decidedBy: rejecter
        ? { role: rejecter.role, name: rejecter.reviewedBy, at: rejecter.reviewedAt }
        : undefined,
      tag: "offsite-email-reject",
    });
    console.log(
      `[offsite-email-reject]: emailed ${emailed} requester for ${requestId}`,
    );
  },
);

// =========================================================================
// 📍 5. CHECK-IN ພ້ອມກວດສອບ Geofence ຢູ່ Server
// =========================================================================

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ~200 km/h ceiling: fast enough to allow any real ground travel between
// shifts (car/bus), slow enough that a location "jump" faster than this is
// almost certainly a spoofed GPS reading rather than real travel.
const IMPLAUSIBLE_SPEED_KMH = 200;
// Mock-location apps often report suspiciously clean accuracy values;
// genuine outdoor phone GPS rarely holds this tight consistently.
const SUSPICIOUSLY_PRECISE_ACCURACY_M = 3;
// How far from the work location's coordinates a check-in is still accepted.
// Authoritative value — the client mirrors it in app/dashboard/attendance/page.tsx
// (OFFICE_RADIUS_METERS); keep the two in sync or the button enables for
// distances the server then rejects.
const OFFICE_RADIUS_METERS = 125;

function timestampFromParts(isoDate: string, time: string): number {
  return new Date(`${isoDate}T${time}:00+07:00`).getTime();
}

// ບໍ່ມີທາງພິສູດ 100% ວ່າ GPS ຈາກ web browser ແມ່ນຫຼືປອມ (ບໍ່ມີ isMock flag
// ຄືມືຖື native app) — heuristic ພວກນີ້ຈຶ່ງເປັນສັນຍານໃຫ້ admin ກວດຄືນເທົ່ານັ້ນ,
// ບໍ່ throw ແລະ ບໍ່ຢຸດ check-in/check-out ໃດໆ.
function computeLocationFlags(
  location: { lat: number; lng: number } | undefined,
  accuracy: number | undefined,
  isOffsite: boolean | undefined,
  nowTimestampMs: number,
  prior: { lat: number; lng: number; timestampMs: number } | null,
): string[] {
  const flags: string[] = [];
  if (!location) return flags;

  if (prior) {
    const hoursElapsed = (nowTimestampMs - prior.timestampMs) / (1000 * 60 * 60);
    if (hoursElapsed > 0) {
      const distanceM = haversineMeters(
        location.lat,
        location.lng,
        prior.lat,
        prior.lng,
      );
      const speedKmh = distanceM / 1000 / hoursElapsed;
      if (speedKmh > IMPLAUSIBLE_SPEED_KMH) {
        flags.push("impossible_travel");
      }
    }
  }

  if (
    !isOffsite &&
    accuracy != null &&
    accuracy > 0 &&
    accuracy <= SUSPICIOUSLY_PRECISE_ACCURACY_M
  ) {
    flags.push("suspiciously_precise_accuracy");
  }

  return flags;
}

// ຫາຈຸດ location ຫຼ້າສຸດຂອງພະນັກງານກ່ອນວັນນີ້ (ຍ້ອນຫຼັງສູງສຸດ 5 record ເຜື່ອວັນ
// ຫຼ້າສຸດບໍ່ມີ location, ເຊັ່ນ: ວັນລາພັກ) — ໃຊ້ເປັນ "prior point" ສຳລັບກວດ
// impossible-travel ຕອນ check-in. ບໍ່ throw ຈັກເທື່ອ: index/query fail ກໍ່ພຽງແຕ່
// ຂ້າມ heuristic ນີ້ໄປ ບໍ່ໃຫ້ກະທົບ check-in.
async function getPriorLocationPoint(
  userUuid: string,
  beforeIsoDate: string,
): Promise<{ lat: number; lng: number; timestampMs: number } | null> {
  try {
    const snap = await admin
      .firestore()
      .collection("attendance")
      .where("userUuid", "==", userUuid)
      .where("dateKey", "<", beforeIsoDate)
      .orderBy("dateKey", "desc")
      .limit(5)
      .get();

    for (const doc of snap.docs) {
      const d = doc.data();
      const dateKey = d.dateKey as string | undefined;
      if (!dateKey) continue;
      const loc = (d.checkOutLocation ?? d.checkInLocation) as
        | { lat?: number; lng?: number }
        | undefined;
      const time = (d.checkOutLocation ? d.checkOutTime : d.checkInTime) as
        | string
        | undefined;
      if (loc?.lat != null && loc?.lng != null && time) {
        return {
          lat: loc.lat,
          lng: loc.lng,
          timestampMs: timestampFromParts(dateKey, time),
        };
      }
    }
    return null;
  } catch (err) {
    console.warn("[locationFlags] getPriorLocationPoint failed", err);
    return null;
  }
}

// ຂຽນເຂົ້າ auditLogs ໂດຍກົງ (admin SDK, ບໍ່ຜ່ານ callable logAuditEvent — ຢູ່ໃນ
// Cloud Function ນີ້ຢູ່ແລ້ວ) ດ້ວຍ shape ດຽວກັນກັບ entry ຂອງ logAuditEvent (ເບິ່ງ
// section 7 ຂ້າງລຸ່ມ), ສະເພາະຕອນ check-in/out ຖືກ flag ວ່າສົງໄສເທົ່ານັ້ນ — ບໍ່ໃຫ້
// auditLogs ເຕັມໄປດ້ວຍ record ປົກກະຕິທຸກມື້. ບໍ່ throw: fail ໃນນີ້ບໍ່ໃຫ້ກະທົບ check-in/out.
async function logLocationFlagAudit(params: {
  action: string;
  actorUid: string;
  actorName?: string;
  targetId: string;
  after: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await admin
      .firestore()
      .collection("auditLogs")
      .add({
        systemType: "portal",
        action: params.action,
        actorUid: params.actorUid,
        actorName: params.actorName ?? "",
        actorRoleUuid: "",
        targetType: "attendance",
        targetId: params.targetId,
        before: {},
        after: params.after,
        status: "SUCCESS",
        ...(params.ipAddress != null ? { ipAddress: params.ipAddress } : {}),
        ...(params.userAgent != null ? { userAgent: params.userAgent } : {}),
        createdAt: new Date().toISOString(),
      });
  } catch (err) {
    console.warn("[locationFlags] failed to write auditLogs entry", err);
  }
}

// date, checkInTime, status ບໍ່ຮັບຈາກ client — server ຄຳນວນເອງ ກັນການປອມເວລາ
type CheckInPayload = {
  userUuid: string;
  uid?: string;
  location?: { lat: number; lng: number };
  accuracy?: number;
  isOffsite?: boolean;
  checkInImageURL?: string;
  fullNameEn?: string;
  fullNameLo?: string;
  jobTitle?: string;
  employeeImage?: string;
  note?: string | null;
  updatedBy?: string;
  createdBy?: string;
  deviceLocalId?: string;
  deviceFingerprint?: string;
  deviceModel?: string;
  department?: { name: string; uid: string };
  workLocation?: { code?: string; name: string; uid?: string };
  // ນະໂຍບາຍ custom: ທາງເລືອກຂອງພະນັກງານ ເມື່ອ check-in ຢູ່ໃນຊ່ວງ 08:16..lateUntil.
  // ນອກຊ່ວງນັ້ນ server ຕັດສິນເອງ ແລະ ບໍ່ສົນຄ່ານີ້
  policyChoice?: PolicyChoice;
};

// ອອກວຽກກ່ອນ 17:00 ຕ້ອງປ້ອນເຫດຜົນຢ່າງໜ້ອຍ 30 ຕົວອັກສອນ.
//
// Enforced here, not in the browser, for the same reason check-in status is
// (CLAUDE.md): the client can be edited or its clock changed. The dialog in
// app/dashboard/attendance/page.tsx is a convenience; this is the rule.
const EARLY_CHECKOUT_BEFORE_MINUTES = 17 * 60;
const EARLY_CHECKOUT_REASON_MIN_CHARS = 30;

// ແມ່ບ້ານ (roles/{rolesUid}.role.housekeeper) ເລີກວຽກ 16:30 ແທນ 17:00: ອອກ >= 16:30 ຄືອອກຕາມເວລາ,
// < 16:30 ຕ້ອງມີເຫດຜົນ ແລະ ຖືກ mark earlyCheckOut (ນາທີນັບຈາກ 16:30).
// ຕ້ອງກົງກັບ HOUSEKEEPER_CHECKOUT_CUTOFF_MINUTES ໃນ app/dashboard/attendance/page.tsx
const HOUSEKEEPER_EARLY_CHECKOUT_BEFORE_MINUTES = 16 * 60 + 30;

// ລາພັກຕອນບ່າຍ (ມື້ນັ້ນເຮັດວຽກແຕ່ເຊົ້າ) ເລີກວຽກ 12:30: ອອກ >= 12:30 ຄືອອກຕາມເວລາ.
// ຕ້ອງກົງກັບ AFTERNOON_LEAVE_CHECKOUT_CUTOFF_MINUTES ໃນ app/dashboard/attendance/page.tsx
const AFTERNOON_LEAVE_EARLY_CHECKOUT_BEFORE_MINUTES = 12 * 60 + 30;

type CheckOutRoleFlags = { housekeeper: boolean; cLive: boolean };

// ອ່ານ rolesUid ຈາກ employees/{uid} — firestore.rules ຫ້າມ self-update rolesUid ຈຶ່ງປອມບໍ່ໄດ້
// (ຄືກັບການກວດ loginAdmin). ອ່ານບໍ່ໄດ້ → ຖືວ່າບໍ່ມີ flag ໃດ (ເວລາເລີກ 17:00 ຄືຄົນທົ່ວໄປ)
//   housekeeper — ເລີກ 16:30
//   CLive       — ບໍ່ມີເວລາເລີກ: ອອກຕອນໃດກໍໄດ້ ບໍ່ຕ້ອງປ້ອນເຫດຜົນ
async function getCheckOutRoleFlags(uid: string): Promise<CheckOutRoleFlags> {
  try {
    const db = admin.firestore();
    const empDoc = await db.collection("employees").doc(uid).get();
    const rolesUid = empDoc.data()?.rolesUid as string | undefined;
    if (!rolesUid) return { housekeeper: false, cLive: false };
    const roleDoc = await db.collection("roles").doc(rolesUid).get();
    const role = roleDoc.data()?.role;
    return {
      housekeeper: role?.housekeeper === true,
      cLive: role?.CLive === true,
    };
  } catch (err) {
    console.warn(`[checkOut] failed to resolve role flags for ${uid}`, err);
    return { housekeeper: false, cLive: false };
  }
}

// ລາພັກທີ່ອະນຸມັດແລ້ວ ຄຸ້ມຕອນບ່າຍຂອງ isoDate ບໍ່. ຄິດແບບດຽວກັບ computeDayCoverage
// ໃນ services/leaves.ts (ຝັ່ງ client). ອ່ານບໍ່ໄດ້ → false (ເລີກຕາມເວລາປົກກະຕິ).
async function hasAfternoonLeaveOn(
  userUuid: string,
  isoDate: string,
): Promise<boolean> {
  try {
    const snapshot = await admin
      .firestore()
      .collection("leaves")
      .where("leaveUserUuid", "==", userUuid)
      .where("status", "==", "approved")
      .get();

    return snapshot.docs.some((d) => {
      const leave = d.data() as LeaveLike;
      const startDate = leave.startDate ?? "";
      const endDate = leave.endDate ?? "";
      // ຮັກສາ 'monning' ໄວ້ເພື່ອ compatibility ກັບຂໍ້ມູນເກົ່າ
      const rawEnd = (leave.endPeriod ?? "afternoon").toLowerCase();
      const endPeriod = rawEnd === "monning" ? "morning" : rawEnd;

      if (!startDate || !endDate || isoDate < startDate || isoDate > endDate)
        return false;
      // ວັນທຳອິດ ຫຼື ວັນກາງ ຂອງການລາຫຼາຍມື້ — ບ່າຍຄຸ້ມສະເໝີ
      if (isoDate < endDate) return true;
      // ວັນສຸດທ້າຍ (ຫຼື ລາມື້ດຽວ) — ບ່າຍຂຶ້ນກັບ endPeriod
      return endPeriod === "afternoon";
    });
  } catch (err) {
    console.warn(`[checkOut] failed to resolve afternoon leave for ${userUuid}`, err);
    return false;
  }
}

type CheckOutPayload = {
  userUuid: string;
  uid?: string;
  location?: { lat: number; lng: number };
  accuracy?: number;
  checkOutImageURL?: string;
  fullNameEn?: string;
  fullNameLo?: string;
  jobTitle?: string;
  employeeImage?: string;
  deviceLocalId?: string;
  deviceFingerprint?: string;
  deviceModel?: string;
  earlyCheckOutReason?: string;
  department?: { name: string; uid: string };
  workLocation?: { code?: string; name: string; uid?: string };
};

// App Check shadow-mode logging — NOT enforced yet. Client scaffold: lib/firebase.ts.
// Lets us measure real-world token coverage in Cloud Logging before flipping
// `enforceAppCheck: true` on recordCheckIn/recordCheckOut, which would otherwise lock
// out every user immediately if the client-side provider isn't fully rolled out.
function logAppCheckShadow(app: unknown, fnName: string): void {
  if (!app) {
    console.warn(
      `[AppCheck shadow] ${fnName}: request missing a valid App Check token`,
    );
  }
}

// ກັນ "ຢືມເຄື່ອງກັນ punch" — ອຸປະກອນດຽວກັນຫ້າມໃຊ້ check-in/check-out ໃຫ້ຫຼາຍກວ່າ
// ໜຶ່ງບັນຊີ ໃນມື້ດຽວກັນ. ບໍ່ block ບັນຊີດຽວກັນທີ່ໃຊ້ເຄື່ອງດຽວກັນຊ້ຳ (handle ຢູ່ແລ້ວ
// ທາງ client ດ້ວຍ merge write).
//
// ONLY deviceLocalId blocks. It is a random UUID per browser profile
// (lib/device.ts), so a match is a real match.
//
// deviceFingerprint is recorded and cross-checked but NEVER blocks. The
// free-tier FingerprintJS visitorId is derived from model-level signals — GPU,
// font set, screen metrics — so two different handsets of the same model and
// browser routinely produce the same id. Chrome's User-Agent Reduction (every
// Android reports model "K") and Safari's anti-fingerprinting defences both push
// entropy down further. Blocking on it meant punishing whichever employee
// happened to punch second, which is exactly what happened on 2026-09-23: two
// unrelated employees on separate Android phones, different localIds and
// different ISPs, sharing one visitorId.
//
// The trade-off is accepted deliberately: someone who clears site data gets a
// fresh localId and is not caught. That was already true for every iOS user
// before this change, since the fingerprint was skipped there anyway.
async function assertDeviceNotUsedByOtherAccount(
  isoDate: string,
  userUuid: string,
  deviceLocalId: string | undefined,
  deviceFingerprint: string | undefined,
  field: "checkInTime" | "checkOutTime",
  errorMessage: string,
  // OT punches are checked against their own collection, not normal attendance
  collectionName: "attendance" | "attendanceOT" = "attendance",
): Promise<void> {
  if (!deviceLocalId && !deviceFingerprint) return;

  const attendance = admin.firestore().collection(collectionName);
  const sameDay = (signal: string, value: string) =>
    attendance
      .where("dateKey", "==", isoDate)
      .where(signal, "==", value)
      .get();

  const [localIdSnap, fingerprintSnap] = await Promise.all([
    deviceLocalId ? sameDay("deviceLocalId", deviceLocalId) : null,
    deviceFingerprint ? sameDay("deviceFingerprint", deviceFingerprint) : null,
  ]);

  const otherAccounts = (snap: admin.firestore.QuerySnapshot | null) =>
    (snap?.docs ?? []).filter(
      (doc) => doc.data().userUuid !== userUuid && doc.data()[field],
    );

  // Log-only: surfaces suspected sharing in Cloud Logging without denying the
  // punch. Deliberately logged even when it is almost certainly a collision —
  // the models are printed so a human can judge.
  for (const doc of otherAccounts(fingerprintSnap)) {
    console.warn(
      `[device] fingerprint match (NOT blocking) on ${isoDate}: ` +
        `${userUuid} vs ${doc.id} — ${field}`,
    );
  }

  const conflict = otherAccounts(localIdSnap)[0];
  if (conflict) {
    console.warn(
      `[device] blocking ${field} for ${userUuid} on ${isoDate}: ` +
        `deviceLocalId matches ${conflict.id}`,
    );
    throw new HttpsError("failed-precondition", errorMessage);
  }
}

export const recordCheckIn = onCall(
  // NOT enforced yet — see logAppCheckShadow. Flip to `enforceAppCheck: true` once
  // Cloud Logging shows consistent coverage (client scaffold: lib/firebase.ts).
  { region: "asia-southeast1", cors: callableCorsOrigins, invoker: "public" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }
    logAppCheckShadow(request.app, "recordCheckIn");

    const data = request.data as CheckInPayload;

    // ກັນ user ໜຶ່ງ check-in ແທນ user ອື່ນ ແລະ ບັນຊີ Auth ທີ່ uid ≠ doc id ພະນັກງານ —
    // userUuid ຕ້ອງ === auth uid (data.uid ບໍ່ໃຊ້ອີກ)
    assertCallerOwnsAttendance(request.auth.uid, data.userUuid, "check in");

    // ເວລາຈາກ server — client ບໍ່ສາມາດປ່ຽນເວລາ check-in ຫຼື status ໄດ້
    const { date, isoDate, checkTime } = getVientianeParts();
    const [hourStr, minuteStr] = checkTime.split(":");

    // ກວດ leave — ຖ້າລາພັກທັງໝົດ ໃຫ້ block; ຖ້າລາພັກເຄິ່ງເຊົ້າ ໃຊ້ threshold ຊ້ານານຂຶ້ນ
    const dayLeaveStatus = await getDayLeaveStatus(data.userUuid, isoDate);
    if (dayLeaveStatus === "blocked") {
      throw new HttpsError(
        "failed-precondition",
        "ທ່ານມີວັນລາພັກທີ່ໄດ້ຮັບອະນຸມັດໃນວັນນີ້ ບໍ່ສາມາດ Check-In ໄດ້",
      );
    }

    // ກັນອຸປະກອນດຽວກັນ check-in ແທນຫຼາຍບັນຊີ (ຢືມມືຖືກັນ punch)
    const checkInUserAgent = request.rawRequest.headers["user-agent"] as
      | string
      | undefined;
    await assertDeviceNotUsedByOtherAccount(
      isoDate,
      data.userUuid,
      data.deviceLocalId,
      data.deviceFingerprint,
      "checkInTime",
      "ອຸປະກອນນີ້ຖືກໃຊ້ Check-In ມື້ນີ້ແລ້ວດ້ວຍບັນຊີອື່ນ ❌",
    );

    // ນະໂຍບາຍພິເສດ — ເວລາ server ເທົ່ານັ້ນ. custom ໃນຊ່ວງເລືອກ ແຕ່ບໍ່ມີ policyChoice →
    // ປະຕິເສດ ໃຫ້ client ເປີດ popup ເລືອກແລ້ວສົ່ງໃໝ່ (ໂມງ client ອາດຕ່າງຈາກ server)
    const specialPolicy = await getTodaySpecialPolicy(data.userUuid, isoDate);
    const clientChoice =
      data.policyChoice === "morning" || data.policyChoice === "evening"
        ? data.policyChoice
        : undefined;
    const checkInResult = resolveCheckIn(
      toMinuteOfDay(parseInt(hourStr, 10), parseInt(minuteStr, 10)),
      dayLeaveStatus === "morning_leave"
        ? "morningLeave"
        : data.isOffsite
          ? "offsite"
          : "normal",
      specialPolicy,
      clientChoice,
    );
    if (checkInResult.needsChoice) {
      throw new HttpsError(
        "failed-precondition",
        "ກະລຸນາເລືອກວິທີໃຊ້ນະໂຍບາຍພິເສດມື້ນີ້",
        {
          code: "policy-choice-required",
          lateUntil:
            specialPolicy?.lateUntilMin != null
              ? minutesToHhmm(specialPolicy.lateUntilMin)
              : null,
          leaveFrom:
            specialPolicy?.leaveFromMin != null
              ? minutesToHhmm(specialPolicy.leaveFromMin)
              : null,
        },
      );
    }
    const status = checkInResult.status;
    const policyChoice = checkInResult.policyChoice;

    // ກວດ Geofence — ດຶງ coordinates ຫ້ອງການຈາກ Firestore (client ປອມບໍ່ໄດ້)
    if (!data.isOffsite && data.location != null) {
      const empSnap = await admin
        .firestore()
        .collection("employees")
        .where("uuid", "==", data.userUuid)
        .limit(1)
        .get();

      if (!empSnap.empty) {
        const workLocationUid = empSnap.docs[0].data()?.workLocation?.uid as
          | string
          | undefined;
        if (workLocationUid) {
          const locDoc = await admin
            .firestore()
            .collection("workLocations")
            .doc(workLocationUid)
            .get();
          const locData = locDoc.data();

          if (locData?.lat != null && locData?.lng != null) {
            const dist = Math.round(
              haversineMeters(
                data.location.lat,
                data.location.lng,
                locData.lat as number,
                locData.lng as number,
              ),
            );
            if (dist > OFFICE_RADIUS_METERS) {
              throw new HttpsError(
                "failed-precondition",
                `ທ່ານຢູ່ຫ່າງຈາກຫ້ອງການ ${dist} ແມັດ. ຕ້ອງຢູ່ພາຍໃນ ${OFFICE_RADIUS_METERS} ແມັດ.`,
              );
            }
          }
        }
      }
    }

    const checkInForwardedFor = request.rawRequest.headers["x-forwarded-for"];
    const checkInIp =
      (Array.isArray(checkInForwardedFor)
        ? checkInForwardedFor[0]
        : checkInForwardedFor)
        ?.split(",")[0]
        ?.trim() ?? request.rawRequest.ip;

    const priorLocationPoint = data.location
      ? await getPriorLocationPoint(data.userUuid, isoDate)
      : null;
    const locationFlags = computeLocationFlags(
      data.location,
      data.accuracy,
      data.isOffsite,
      timestampFromParts(isoDate, checkTime),
      priorLocationPoint,
    );

    const attendanceId = `${data.userUuid}_${date}`;
    await admin
      .firestore()
      .collection("attendance")
      .doc(attendanceId)
      .set(
        {
          _id: attendanceId,
          uid: data.userUuid,
          userUuid: data.userUuid,
          date,
          dateKey: isoDate,
          checkInTime: checkTime,
          status,
          ...(dayLeaveStatus === "morning_leave"
            ? { morningLeaveDay: true }
            : {}),
          ...policyAttendanceFields(specialPolicy, policyChoice),
          ...(data.location
            ? {
                checkInLocation: {
                  lat: data.location.lat,
                  lng: data.location.lng,
                },
              }
            : {}),
          ...(data.fullNameEn != null ? { fullNameEn: data.fullNameEn } : {}),
          ...(data.fullNameLo != null ? { fullNameLo: data.fullNameLo } : {}),
          ...(data.jobTitle != null ? { jobTitle: data.jobTitle } : {}),
          ...(data.employeeImage != null
            ? { employeeImage: data.employeeImage }
            : {}),
          ...(data.note != null ? { note: data.note } : {}),
          ...(data.department ? { department: data.department } : {}),
          ...(data.workLocation ? { workLocation: data.workLocation } : {}),
          ...(data.checkInImageURL
            ? { checkInImageURL: data.checkInImageURL }
            : {}),
          ...(data.isOffsite ? { isOffsite: true } : {}),
          ...(data.deviceLocalId ? { deviceLocalId: data.deviceLocalId } : {}),
          ...(data.deviceFingerprint
            ? { deviceFingerprint: data.deviceFingerprint }
            : {}),
          ...(data.deviceModel ? { deviceModel: data.deviceModel } : {}),
          ...(data.accuracy != null ? { checkInAccuracy: data.accuracy } : {}),
          ...(checkInIp ? { checkInIp } : {}),
          ...(checkInUserAgent ? { checkInUserAgent } : {}),
          ...(locationFlags.length > 0
            ? { checkInLocationFlags: locationFlags }
            : {}),
          updatedAt: new Date().toISOString(),
          updatedBy: data.updatedBy ?? data.userUuid,
        },
        { merge: true },
      );

    if (locationFlags.length > 0) {
      await logLocationFlagAudit({
        action: "attendance.checkIn.locationFlag",
        actorUid: request.auth.uid,
        actorName: data.fullNameLo || data.fullNameEn,
        targetId: attendanceId,
        after: {
          locationFlags,
          location: data.location ?? null,
          accuracy: data.accuracy ?? null,
          isOffsite: data.isOffsite ?? false,
        },
        ipAddress: checkInIp,
        userAgent: checkInUserAgent,
      });
    }

    return {
      attendanceId,
      date,
      isoDate,
      checkTime,
      status,
      ...(policyChoice ? { policyChoice } : {}),
    };
  },
);

// =========================================================================
// 🚪 6. CHECK-OUT ດ້ວຍເວລາ Server
// =========================================================================

export const recordCheckOut = onCall(
  // NOT enforced yet — see logAppCheckShadow. Flip to `enforceAppCheck: true` once
  // Cloud Logging shows consistent coverage (client scaffold: lib/firebase.ts).
  { region: "asia-southeast1", cors: callableCorsOrigins, invoker: "public" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }
    logAppCheckShadow(request.app, "recordCheckOut");

    const data = request.data as CheckOutPayload;

    // ກັນ user ໜຶ່ງ check-out ແທນ user ອື່ນ ແລະ ບັນຊີ Auth ທີ່ uid ≠ doc id ພະນັກງານ
    assertCallerOwnsAttendance(request.auth.uid, data.userUuid, "check out");

    const { date, isoDate, checkTime } = getVientianeParts();
    const attendanceId = `${data.userUuid}_${date}`;

    // ອອກກ່ອນ 17:00 ຕ້ອງມີເຫດຜົນ. ເວລາມາຈາກ server ບໍ່ແມ່ນໂມງໃນມືຖື.
    const [checkOutHour, checkOutMinute] = checkTime.split(":").map(Number);
    const checkOutMinuteOfDay = checkOutHour * 60 + checkOutMinute;

    // ອ່ານ attendance ມື້ນີ້ — policyChoice (ເວລາເລີກຂອງ custom) ແລະ checkInTime (workHours)
    const attendanceRef = admin
      .firestore()
      .collection("attendance")
      .doc(attendanceId);
    const existingData = (await attendanceRef.get()).data();

    // ອ່ານ role / ລາພັກ / ນະໂຍບາຍພິເສດ ສະເພາະເມື່ອກ່ອນ 17:00 — ຫຼັງນັ້ນທຸກຄົນອອກຕາມເວລາ
    // (leaveFrom ຂອງນະໂຍບາຍກ່ອນ 17:00 ສະເໝີ ຈຶ່ງມີແຕ່ເລື່ອນເວລາເລີກໃຫ້ໄວຂຶ້ນ)
    let cutoffMinutes = EARLY_CHECKOUT_BEFORE_MINUTES;
    let isEarlyCheckOut = false;
    if (checkOutMinuteOfDay < EARLY_CHECKOUT_BEFORE_MINUTES) {
      const [roleFlags, afternoonLeave, specialPolicy] = await Promise.all([
        getCheckOutRoleFlags(data.userUuid),
        hasAfternoonLeaveOn(data.userUuid, isoDate),
        getTodaySpecialPolicy(data.userUuid, isoDate),
      ]);
      // CLive ອອກຕອນໃດກໍໄດ້ — ບໍ່ເຄີຍຖືວ່າອອກກ່ອນເວລາ (null = ບໍ່ມີເວລາເລີກ)
      const baseCutoff = roleFlags.cLive
        ? null
        : afternoonLeave
          ? AFTERNOON_LEAVE_EARLY_CHECKOUT_BEFORE_MINUTES
          : roleFlags.housekeeper
            ? HOUSEKEEPER_EARLY_CHECKOUT_BEFORE_MINUTES
            : EARLY_CHECKOUT_BEFORE_MINUTES;
      const storedChoice = existingData?.policyChoice;
      const cutoff = resolveCheckOutCutoff(
        baseCutoff,
        specialPolicy,
        storedChoice === "morning" || storedChoice === "evening"
          ? storedChoice
          : undefined,
      );
      if (cutoff != null) {
        cutoffMinutes = cutoff;
        isEarlyCheckOut = checkOutMinuteOfDay < cutoff;
      }
    }
    const earlyCheckOutReason = (data.earlyCheckOutReason ?? "").trim();

    if (isEarlyCheckOut &&
        earlyCheckOutReason.length < EARLY_CHECKOUT_REASON_MIN_CHARS) {
      const cutoffLabel =
        `${Math.floor(cutoffMinutes / 60)}:${String(cutoffMinutes % 60).padStart(2, "0")}`;
      throw new HttpsError(
        "invalid-argument",
        `ອອກວຽກກ່ອນ ${cutoffLabel} ຕ້ອງປ້ອນເຫດຜົນ ` +
          `ຢ່າງໜ້ອຍ ${EARLY_CHECKOUT_REASON_MIN_CHARS} ຕົວອັກສອນ ❌`,
      );
    }

    // ນາທີທີ່ອອກກ່ອນເວລາ (ນັບຈາກເວລາເລີກຂອງຄົນນັ້ນ) — ໃຫ້ HR ຈັດລຳດັບໄດ້ໂດຍບໍ່ຕ້ອງຄຳນວນຄືນ
    const earlyCheckOutMinutes = isEarlyCheckOut
      ? cutoffMinutes - checkOutMinuteOfDay
      : 0;

    // ກັນອຸປະກອນດຽວກັນ check-out ແທນຫຼາຍບັນຊີ (ຢືມມືຖືກັນ punch)
    const checkOutUserAgent = request.rawRequest.headers["user-agent"] as
      | string
      | undefined;
    await assertDeviceNotUsedByOtherAccount(
      isoDate,
      data.userUuid,
      data.deviceLocalId,
      data.deviceFingerprint,
      "checkOutTime",
      "ອຸປະກອນນີ້ຖືກໃຊ້ Check-Out ມື້ນີ້ແລ້ວດ້ວຍບັນຊີອື່ນ ❌",
    );

    // checkInTime ທີ່ມີຢູ່ (ອ່ານໄວ້ຂ້າງເທິງ) ໃຊ້ຄຳນວນ workHours
    const checkInTime = existingData?.checkInTime as string | undefined;
    let workHours = 0;
    if (checkInTime) {
      const [inH, inM] = checkInTime.split(":").map(Number);
      const [outH, outM] = checkTime.split(":").map(Number);
      const diffMinutes = outH * 60 + outM - (inH * 60 + inM);
      workHours =
        diffMinutes > 0 ? Math.round((diffMinutes / 60) * 10) / 10 : 0;
    }

    const checkOutForwardedFor =
      request.rawRequest.headers["x-forwarded-for"];
    const checkOutIp =
      (Array.isArray(checkOutForwardedFor)
        ? checkOutForwardedFor[0]
        : checkOutForwardedFor)
        ?.split(",")[0]
        ?.trim() ?? request.rawRequest.ip;

    // "prior point" ຂອງ checkout ຄື checkIn ຂອງມື້ດຽວກັນ (doc ດຽວກັນ, ບໍ່ຕ້ອງ query ເພີ່ມ)
    const checkInLoc = existingData?.checkInLocation as
      | { lat?: number; lng?: number }
      | undefined;
    const priorLocationPoint =
      checkInLoc?.lat != null && checkInLoc?.lng != null && checkInTime
        ? {
            lat: checkInLoc.lat,
            lng: checkInLoc.lng,
            timestampMs: timestampFromParts(isoDate, checkInTime),
          }
        : null;
    const locationFlags = computeLocationFlags(
      data.location,
      data.accuracy,
      existingData?.isOffsite as boolean | undefined,
      timestampFromParts(isoDate, checkTime),
      priorLocationPoint,
    );

    await attendanceRef.set(
        {
          checkOutTime: checkTime,
          workHours,
          ...(data.fullNameEn != null ? { fullNameEn: data.fullNameEn } : {}),
          ...(data.fullNameLo != null ? { fullNameLo: data.fullNameLo } : {}),
          ...(data.jobTitle != null ? { jobTitle: data.jobTitle } : {}),
          ...(data.employeeImage != null
            ? { employeeImage: data.employeeImage }
            : {}),
          ...(data.department ? { department: data.department } : {}),
          ...(data.workLocation ? { workLocation: data.workLocation } : {}),
          ...(data.checkOutImageURL
            ? { checkOutImageURL: data.checkOutImageURL }
            : {}),
          ...(data.location
            ? {
                checkOutLocation: {
                  lat: data.location.lat,
                  lng: data.location.lng,
                },
              }
            : {}),
          ...(data.deviceLocalId ? { deviceLocalId: data.deviceLocalId } : {}),
          ...(data.deviceFingerprint
            ? { deviceFingerprint: data.deviceFingerprint }
            : {}),
          ...(data.deviceModel ? { deviceModel: data.deviceModel } : {}),
          ...(isEarlyCheckOut
            ? {
                earlyCheckOut: true,
                earlyCheckOutReason,
                earlyCheckOutMinutes,
              }
            : {}),
          ...(data.accuracy != null ? { checkOutAccuracy: data.accuracy } : {}),
          ...(checkOutIp ? { checkOutIp } : {}),
          ...(checkOutUserAgent ? { checkOutUserAgent } : {}),
          ...(locationFlags.length > 0
            ? { checkOutLocationFlags: locationFlags }
            : {}),
          updatedAt: new Date().toISOString(),
          updatedBy: data.userUuid,
        },
        { merge: true },
      );

    if (locationFlags.length > 0) {
      await logLocationFlagAudit({
        action: "attendance.checkOut.locationFlag",
        actorUid: request.auth.uid,
        actorName: data.fullNameLo || data.fullNameEn,
        targetId: attendanceId,
        after: {
          locationFlags,
          location: data.location ?? null,
          accuracy: data.accuracy ?? null,
          isOffsite: existingData?.isOffsite ?? false,
        },
        ipAddress: checkOutIp,
        userAgent: checkOutUserAgent,
      });
    }

    return { attendanceId, checkOutTime: checkTime, workHours };
  },
);

// =========================================================================
// ⏱️ 6b. OT CHECK-IN / CHECK-OUT (attendanceOT)
// Same document shape as attendance, in its own collection. Allowed only for
// a teammate on an approved OT request (workOutside formType "overtime") that
// covers today. No geofence — OT can be anywhere — but GPS and a photo are
// required on every punch. Status: present at or before the request's
// startTime, late after. Rules: lib/attendance-ot.ts (client mirror).
// =========================================================================

type OTPunchPayload = {
  userUuid: string;
  location?: { lat: number; lng: number };
  accuracy?: number;
  imageURL?: string;
  fullNameEn?: string;
  fullNameLo?: string;
  jobTitle?: string;
  jobTitleLo?: string;
  employeeImage?: string;
  deviceLocalId?: string;
  deviceFingerprint?: string;
  deviceModel?: string;
  department?: { name: string; uid: string };
  workLocation?: { code?: string; name: string; uid?: string };
};

function requireOTEvidence(data: OTPunchPayload): { lat: number; lng: number } {
  if (!data.imageURL) {
    throw new HttpsError("invalid-argument", "ກະລຸນາຖ່າຍຮູບກ່ອນ Check-In/Out OT");
  }
  if (!data.location || typeof data.location.lat !== "number" || typeof data.location.lng !== "number") {
    throw new HttpsError("invalid-argument", "ບໍ່ມີຂໍ້ມູນ GPS — ກະລຸນາເປີດຕຳແໜ່ງ ແລ້ວລອງໃໝ່");
  }
  return { lat: data.location.lat, lng: data.location.lng };
}

function requestIp(rawRequest: { headers: Record<string, unknown>; ip?: string }): string | undefined {
  const forwarded = rawRequest.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (typeof first === "string" ? first.split(",")[0]?.trim() : undefined) ?? rawRequest.ip;
}

async function findTodayOTRequest(
  uid: string,
  isoDate: string,
): Promise<OTRequestLike | null> {
  // participantIds holds bare uids on OT docs (the form writes them that way);
  // pickTodayOTRequest then narrows to approved OT covering today, teammates only.
  const snap = await admin
    .firestore()
    .collection("workOutside")
    .where("participantIds", "array-contains", uid)
    .get();
  const requests = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OTRequestLike, "id">) }));
  return pickTodayOTRequest(requests, uid, isoDate);
}

export const recordOTCheckIn = onCall(
  { region: "asia-southeast1", cors: callableCorsOrigins, invoker: "public" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }
    logAppCheckShadow(request.app, "recordOTCheckIn");

    const data = request.data as OTPunchPayload;
    assertCallerOwnsAttendance(request.auth.uid, data.userUuid, "check in");
    const location = requireOTEvidence(data);

    const { date, isoDate, checkTime } = getVientianeParts();

    const ot = await findTodayOTRequest(data.userUuid, isoDate);
    if (!ot) {
      throw new HttpsError(
        "failed-precondition",
        "ທ່ານບໍ່ມີຄຳຂໍ OT ທີ່ອະນຸມັດແລ້ວສຳລັບມື້ນີ້",
      );
    }

    const attendanceId = `${data.userUuid}_${date}`;
    const ref = admin.firestore().collection("attendanceOT").doc(attendanceId);
    const existing = await ref.get();
    if (existing.data()?.checkInTime) {
      throw new HttpsError("already-exists", "ທ່ານ Check-In OT ມື້ນີ້ແລ້ວ");
    }

    const userAgent = request.rawRequest.headers["user-agent"] as string | undefined;
    await assertDeviceNotUsedByOtherAccount(
      isoDate,
      data.userUuid,
      data.deviceLocalId,
      data.deviceFingerprint,
      "checkInTime",
      "ອຸປະກອນນີ້ຖືກໃຊ້ Check-In OT ມື້ນີ້ແລ້ວດ້ວຍບັນຊີອື່ນ ❌",
      "attendanceOT",
    );

    const status = computeOTCheckInStatus(checkTime, ot.startTime);
    const ip = requestIp(request.rawRequest);
    const priorLocationPoint = await getPriorLocationPoint(data.userUuid, isoDate);
    // isOffsite=true: no office to be near, so the "too precise for indoors"
    // heuristic doesn't apply; impossible-travel still runs.
    const locationFlags = computeLocationFlags(
      location,
      data.accuracy,
      true,
      timestampFromParts(isoDate, checkTime),
      priorLocationPoint,
    );

    await ref.set(
      {
        _id: attendanceId,
        uid: data.userUuid,
        userUuid: data.userUuid,
        date,
        dateKey: isoDate,
        checkInTime: checkTime,
        status,
        checkInLocation: location,
        checkInImageURL: data.imageURL,
        otRequestId: ot.id,
        ...(ot.requestNo ? { otRequestNo: ot.requestNo } : {}),
        ...(ot.startTime ? { otStartTime: ot.startTime } : {}),
        ...(ot.endTime ? { otEndTime: ot.endTime } : {}),
        ...(data.fullNameEn != null ? { fullNameEn: data.fullNameEn } : {}),
        ...(data.fullNameLo != null ? { fullNameLo: data.fullNameLo } : {}),
        ...(data.jobTitle != null ? { jobTitle: data.jobTitle } : {}),
        ...(data.jobTitleLo != null ? { jobTitleLo: data.jobTitleLo } : {}),
        ...(data.employeeImage != null ? { employeeImage: data.employeeImage } : {}),
        ...(data.department ? { department: data.department } : {}),
        ...(data.workLocation ? { workLocation: data.workLocation } : {}),
        ...(data.deviceLocalId ? { deviceLocalId: data.deviceLocalId } : {}),
        ...(data.deviceFingerprint ? { deviceFingerprint: data.deviceFingerprint } : {}),
        ...(data.deviceModel ? { deviceModel: data.deviceModel } : {}),
        ...(data.accuracy != null ? { checkInAccuracy: data.accuracy } : {}),
        ...(ip ? { checkInIp: ip } : {}),
        ...(userAgent ? { checkInUserAgent: userAgent } : {}),
        ...(locationFlags.length > 0 ? { checkInLocationFlags: locationFlags } : {}),
        note: null,
        createdAt: new Date().toISOString(),
        createdBy: data.userUuid,
        updatedAt: new Date().toISOString(),
        updatedBy: data.userUuid,
      },
      { merge: true },
    );

    if (locationFlags.length > 0) {
      await logLocationFlagAudit({
        action: "attendanceOT.checkIn.locationFlag",
        actorUid: request.auth.uid,
        actorName: data.fullNameLo || data.fullNameEn,
        targetId: attendanceId,
        after: { locationFlags, location, accuracy: data.accuracy ?? null },
        ipAddress: ip,
        userAgent,
      });
    }

    return { attendanceId, date, isoDate, checkTime, status, otRequestId: ot.id };
  },
);

export const recordOTCheckOut = onCall(
  { region: "asia-southeast1", cors: callableCorsOrigins, invoker: "public" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }
    logAppCheckShadow(request.app, "recordOTCheckOut");

    const data = request.data as OTPunchPayload;
    assertCallerOwnsAttendance(request.auth.uid, data.userUuid, "check out");
    const location = requireOTEvidence(data);

    const { date, isoDate, checkTime } = getVientianeParts();
    const attendanceId = `${data.userUuid}_${date}`;
    const ref = admin.firestore().collection("attendanceOT").doc(attendanceId);
    const existingData = (await ref.get()).data();
    const checkInTime = existingData?.checkInTime as string | undefined;
    if (!checkInTime) {
      throw new HttpsError("failed-precondition", "ກະລຸນາ Check-In OT ກ່ອນ");
    }
    if (existingData?.checkOutTime) {
      throw new HttpsError("already-exists", "ທ່ານ Check-Out OT ມື້ນີ້ແລ້ວ");
    }

    const userAgent = request.rawRequest.headers["user-agent"] as string | undefined;
    await assertDeviceNotUsedByOtherAccount(
      isoDate,
      data.userUuid,
      data.deviceLocalId,
      data.deviceFingerprint,
      "checkOutTime",
      "ອຸປະກອນນີ້ຖືກໃຊ້ Check-Out OT ມື້ນີ້ແລ້ວດ້ວຍບັນຊີອື່ນ ❌",
      "attendanceOT",
    );

    const ip = requestIp(request.rawRequest);
    const checkInLoc = existingData?.checkInLocation as { lat?: number; lng?: number } | undefined;
    const locationFlags = computeLocationFlags(
      location,
      data.accuracy,
      true,
      timestampFromParts(isoDate, checkTime),
      checkInLoc?.lat != null && checkInLoc?.lng != null
        ? { lat: checkInLoc.lat, lng: checkInLoc.lng, timestampMs: timestampFromParts(isoDate, checkInTime) }
        : null,
    );
    const workHours = calcWorkHours(checkInTime, checkTime);

    await ref.set(
      {
        checkOutTime: checkTime,
        workHours,
        checkOutLocation: location,
        checkOutImageURL: data.imageURL,
        ...(data.deviceLocalId ? { deviceLocalId: data.deviceLocalId } : {}),
        ...(data.deviceFingerprint ? { deviceFingerprint: data.deviceFingerprint } : {}),
        ...(data.deviceModel ? { deviceModel: data.deviceModel } : {}),
        ...(data.accuracy != null ? { checkOutAccuracy: data.accuracy } : {}),
        ...(ip ? { checkOutIp: ip } : {}),
        ...(userAgent ? { checkOutUserAgent: userAgent } : {}),
        ...(locationFlags.length > 0 ? { checkOutLocationFlags: locationFlags } : {}),
        updatedAt: new Date().toISOString(),
        updatedBy: data.userUuid,
      },
      { merge: true },
    );

    if (locationFlags.length > 0) {
      await logLocationFlagAudit({
        action: "attendanceOT.checkOut.locationFlag",
        actorUid: request.auth.uid,
        actorName: data.fullNameLo || data.fullNameEn,
        targetId: attendanceId,
        after: { locationFlags, location, accuracy: data.accuracy ?? null },
        ipAddress: ip,
        userAgent,
      });
    }

    return { attendanceId, checkOutTime: checkTime, workHours };
  },
);

// =========================================================================
// 📝 7. AUDIT LOG — client relays through here so ipAddress/userAgent come
// from the real request, and actorUid is stamped from the verified auth
// token rather than trusted from the client payload (can't be spoofed).
// =========================================================================

type AuditLogPayload = {
  action: string;
  actorName?: string;
  actorRoleUuid?: string;
  actorRoleName?: string;
  workLocation?: { code?: string; nameLo?: string; uuid?: string };
  targetType: string;
  targetId: string;
  targetName?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changedFields?: string[];
  reason?: string;
  status: "SUCCESS" | "FAILED";
  errorMessage?: string;
  requestUrl?: string;
  companyId?: string;
  branchId?: string;
};

export const logAuditEvent = onCall(
  { region: "asia-southeast1", cors: callableCorsOrigins, invoker: "public" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }

    const data = request.data as AuditLogPayload;
    if (!data.action || !data.targetType || !data.targetId || !data.status) {
      throw new HttpsError(
        "invalid-argument",
        "action, targetType, targetId, status are required",
      );
    }

    const forwardedFor = request.rawRequest.headers["x-forwarded-for"];
    const ipAddress =
      (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)
        ?.split(",")[0]
        ?.trim() ?? request.rawRequest.ip;
    const userAgent = request.rawRequest.headers["user-agent"] as
      | string
      | undefined;

    const entry = {
      systemType: "portal",
      action: data.action,
      actorUid: request.auth.uid,
      actorName: data.actorName ?? "",
      actorRoleUuid: data.actorRoleUuid ?? "",
      ...(data.actorRoleName != null
        ? { actorRoleName: data.actorRoleName }
        : {}),
      ...(data.workLocation != null ? { workLocation: data.workLocation } : {}),
      targetType: data.targetType,
      targetId: data.targetId,
      ...(data.targetName != null ? { targetName: data.targetName } : {}),
      // Always present — {} when the action has no natural prior/new state
      // (e.g. login/logout) rather than omitting the field entirely.
      before: data.before ?? {},
      after: data.after ?? {},
      ...(data.changedFields != null
        ? { changedFields: data.changedFields }
        : {}),
      ...(data.reason != null ? { reason: data.reason } : {}),
      status: data.status,
      ...(data.errorMessage != null ? { errorMessage: data.errorMessage } : {}),
      ...(ipAddress != null ? { ipAddress } : {}),
      ...(userAgent != null ? { userAgent } : {}),
      ...(data.requestUrl != null ? { requestUrl: data.requestUrl } : {}),
      ...(data.companyId != null ? { companyId: data.companyId } : {}),
      ...(data.branchId != null ? { branchId: data.branchId } : {}),
      createdAt: new Date().toISOString(),
    };

    const docRef = await admin.firestore().collection("auditLogs").add(entry);
    return { id: docRef.id };
  },
);

// ==========================================================
// ແບບຟອມ / ແບບສອບຖາມ (forms, ສ້າງຈາກ admin) — rules ບໍ່ໃຫ້ພະນັກງານອ່ານ/ຂຽນ forms ໂດຍກົງ
// (Firestore rules ພິສູດ audienceKeys.hasAny ຂອງ list query ບໍ່ໄດ້), ທຸກຢ່າງຜ່ານ 3 callable ນີ້.
// ສິດຕອບຄິດຈາກຂໍ້ມູນພະນັກງານປັດຈຸບັນ — ເບິ່ງ ./forms.ts
// ==========================================================

type FormDoc = {
  title?: string;
  description?: string;
  status?: string;
  sections?: FormSection[];
  audienceKeys?: string[];
  settings?: { allowEdit?: boolean; isQuiz?: boolean; showResult?: string };
  createdAt?: string;
  openedAt?: string;
  notifiedAt?: string;
};

type FormCaller = AudienceEmployee & { data: admin.firestore.DocumentData };

async function loadFormCaller(uid: string): Promise<FormCaller> {
  const snap = await admin.firestore().collection("employees").doc(uid).get();
  const data = snap.data();
  if (!data || data.status === "delete" || data.status === "resigned") {
    throw new HttpsError("permission-denied", "ບໍ່ພົບຂໍ້ມູນພະນັກງານ");
  }
  return {
    uid,
    workLocationUuid: data.workLocation?.uuid || undefined,
    departmentUuid: data.department?.uuid || undefined,
    employmentStatus: data.employmentStatus || undefined,
    data,
  };
}

function requireFormId(raw: unknown): string {
  if (typeof raw !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(raw)) {
    throw new HttpsError("invalid-argument", "formId ບໍ່ຖືກຕ້ອງ");
  }
  return raw;
}

const formSections = (form: FormDoc): FormSection[] =>
  Array.isArray(form.sections) ? form.sections : [];

const isPublishedForm = (form: FormDoc) => form.status === "open" || form.status === "closed";

const isQuizForm = (form: FormDoc) => form.settings?.isQuiz === true;

// Quiz ແກ້ຄຳຕອບບໍ່ໄດ້ສະເໝີ — ບໍ່ດັ່ງນັ້ນເບິ່ງເສີຍແລ້ວກັບໄປແກ້ໃຫ້ໄດ້ຄະແນນເຕັມ
const canEditResponse = (form: FormDoc) => form.settings?.allowEdit === true && !isQuizForm(form);

const formShowResult = (form: FormDoc): ShowResult =>
  isQuizForm(form) ? toShowResult(form.settings?.showResult) : "none";

const answerKeyRef = (formRef: admin.firestore.DocumentReference) =>
  formRef.collection("private").doc("answerKey");

const parseAnswerKey = (data: admin.firestore.DocumentData | undefined): AnswerKey =>
  (data?.questions ?? {}) as AnswerKey;

export const listMyForms = onCall(
  { region: "asia-southeast1", cors: callableCorsOrigins, invoker: "public" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }
    const caller = await loadFormCaller(request.auth.uid);
    const db = admin.firestore();

    const snap = await db
      .collection("forms")
      .where("audienceKeys", "array-contains-any", employeeAudienceKeys(caller))
      .get();
    const published = snap.docs.filter((d) => isPublishedForm(d.data() as FormDoc));
    const responses = published.length
      ? await db.getAll(...published.map((d) => d.ref.collection("responses").doc(caller.uid)))
      : [];

    const forms = published
      .map((d, i) => {
        const form = d.data() as FormDoc;
        const response = responses[i].data();
        const score = response?.score as QuizScore | undefined;
        return {
          id: d.id,
          title: form.title ?? "",
          description: form.description ?? "",
          status: form.status as "open" | "closed",
          questionCount: formSections(form).reduce((n, s) => n + (s.questions?.length ?? 0), 0),
          allowEdit: canEditResponse(form),
          isQuiz: isQuizForm(form),
          openedAt: form.openedAt ?? form.createdAt ?? "",
          submittedAt: (response?.submittedAt as string | undefined) ?? null,
          score:
            score && formShowResult(form) !== "none"
              ? { earned: score.earned, total: score.total }
              : null,
        };
      })
      // ຟອມທີ່ປິດແລ້ວ ສະແດງສະເພາະອັນທີ່ເຄີຍຕອບ (ເບິ່ງຄຳຕອບຍ້ອນຫຼັງ)
      .filter((f) => f.status === "open" || f.submittedAt)
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt));

    return { forms };
  },
);

export const getMyForm = onCall(
  { region: "asia-southeast1", cors: callableCorsOrigins, invoker: "public" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }
    const formId = requireFormId((request.data as { formId?: unknown })?.formId);
    const caller = await loadFormCaller(request.auth.uid);
    const formRef = admin.firestore().collection("forms").doc(formId);
    const [formSnap, responseSnap] = await Promise.all([
      formRef.get(),
      formRef.collection("responses").doc(caller.uid).get(),
    ]);
    const form = formSnap.data() as FormDoc | undefined;
    const response = responseSnap.data();

    // ຍ້າຍພະແນກ/ສາຂາ ຫຼັງຕອບແລ້ວ ຍັງເບິ່ງຄຳຕອບຂອງຕົນໄດ້
    if (!form || !isPublishedForm(form) || (!isInAudience(form.audienceKeys, caller) && !response)) {
      throw new HttpsError("not-found", "ບໍ່ພົບແບບຟອມ ຫຼື ທ່ານບໍ່ມີສິດຕອບແບບຟອມນີ້");
    }

    const isQuiz = isQuizForm(form);
    const showResult = formShowResult(form);
    const key = isQuiz ? parseAnswerKey((await answerKeyRef(formRef).get()).data()) : {};
    // ຄະແນນຕໍ່ຂໍ້ບໍ່ແມ່ນຄວາມລັບ (ສະແດງຕອນຕອບ); ເສີຍສົ່ງໃຫ້ສະເພາະຫຼັງຕອບແລ້ວ ແລະ ຕັ້ງ scoreAndAnswers
    const questionPoints = Object.fromEntries(
      Object.entries(key).map(([id, entry]) => [id, Math.max(0, Number(entry.points) || 0)]),
    );
    const score = response?.score as QuizScore | undefined;
    const revealAnswers = !!response && showResult === "scoreAndAnswers";

    return {
      form: {
        id: formSnap.id,
        title: form.title ?? "",
        description: form.description ?? "",
        status: form.status,
        allowEdit: canEditResponse(form),
        isQuiz,
        showResult,
        questionPoints,
        sections: formSections(form),
      },
      response: response
        ? {
            answers: response.answers ?? {},
            submittedAt: response.submittedAt ?? null,
            updatedAt: response.updatedAt ?? null,
            score:
              score && showResult !== "none"
                ? {
                    earned: score.earned,
                    total: score.total,
                    ...(revealAnswers ? { results: score.results } : {}),
                  }
                : null,
            correctAnswers: revealAnswers
              ? Object.fromEntries(Object.entries(key).map(([id, entry]) => [id, entry.correct ?? []]))
              : null,
          }
        : null,
    };
  },
);

export const submitFormResponse = onCall(
  { region: "asia-southeast1", cors: callableCorsOrigins, invoker: "public" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }
    const payload = request.data as { formId?: unknown; answers?: unknown };
    const formId = requireFormId(payload?.formId);
    const caller = await loadFormCaller(request.auth.uid);
    const db = admin.firestore();
    const formRef = db.collection("forms").doc(formId);
    // doc id = uid → 1 ຄົນ 1 ຄຳຕອບ
    const responseRef = formRef.collection("responses").doc(caller.uid);

    return db.runTransaction(async (tx) => {
      const [formSnap, responseSnap, keySnap] = await Promise.all([
        tx.get(formRef),
        tx.get(responseRef),
        tx.get(answerKeyRef(formRef)),
      ]);
      const form = formSnap.data() as FormDoc | undefined;
      if (!form || !isPublishedForm(form) || !isInAudience(form.audienceKeys, caller)) {
        throw new HttpsError("not-found", "ບໍ່ພົບແບບຟອມ ຫຼື ທ່ານບໍ່ມີສິດຕອບແບບຟອມນີ້");
      }
      if (form.status !== "open") {
        throw new HttpsError("failed-precondition", "ແບບຟອມນີ້ປິດຮັບຄຳຕອບແລ້ວ");
      }
      const existing = responseSnap.data();
      if (existing && !canEditResponse(form)) {
        throw new HttpsError("already-exists", "ທ່ານໄດ້ຕອບແບບຟອມນີ້ແລ້ວ");
      }

      const answers = validateAnswers(formSections(form), payload.answers);
      const score = isQuizForm(form)
        ? gradeAnswers(formSections(form), answers, parseAnswerKey(keySnap.data()))
        : null;
      const now = new Date().toISOString();
      const emp = caller.data;
      const submittedAt = (existing?.submittedAt as string | undefined) ?? now;

      tx.set(responseRef, {
        formId,
        uid: caller.uid,
        answers,
        // snapshot ຕອນຕອບ — ໜ້າຜົນ (admin) ໃຊ້ສະແດງຊື່/ພະແນກ ໂດຍບໍ່ຕ້ອງ join
        employee: {
          name: `${emp.firstNameLo ?? ""} ${emp.lastNameLo ?? ""}`.trim(),
          jobTitle: emp.jobTitleLo || emp.jobTitle || "",
          departmentUuid: caller.departmentUuid ?? "",
          departmentTitle: emp.department?.title ?? "",
          workLocationUuid: caller.workLocationUuid ?? "",
          workLocationName: emp.workLocation?.nameLo ?? "",
          employmentStatus: caller.employmentStatus ?? "",
        },
        // ຄະແນນຕອນສົ່ງ (ສະແດງໃຫ້ພະນັກງານ) — admin ຄິດຄືນຈາກເສີຍປັດຈຸບັນໃນໜ້າຜົນ
        ...(score ? { score } : {}),
        submittedAt,
        updatedAt: now,
        editCount: existing ? ((existing.editCount as number | undefined) ?? 0) + 1 : 0,
      });
      if (!existing) {
        tx.update(formRef, { responseCount: admin.firestore.FieldValue.increment(1) });
      }

      const showResult = formShowResult(form);
      return {
        submittedAt,
        updatedAt: now,
        score: score && showResult !== "none" ? { earned: score.earned, total: score.total } : null,
      };
    });
  },
);

// ແຈ້ງເຕືອນ push ຫາຜູ້ມີສິດຕອບ ຄັ້ງທຳອິດທີ່ຟອມເປີດຮັບຄຳຕອບ (ສ້າງແລ້ວເປີດເລີຍ ຫຼື ສະບັບຮ່າງ → ເປີດ).
// notifiedAt ກັນແຈ້ງຊ້ຳເມື່ອປິດແລ້ວເປີດຄືນ ຫຼື ເມື່ອ trigger ຖືກເອີ້ນຊ້ຳ.
export const notifyFormOpened = onDocumentWritten(
  { document: "forms/{formId}", region: "asia-southeast1" },
  async (event) => {
    const before = event.data?.before.data() as FormDoc | undefined;
    const after = event.data?.after.data() as FormDoc | undefined;
    if (!after || after.status !== "open" || before?.status === "open" || after.notifiedAt) return;

    const db = admin.firestore();
    const formRef = db.collection("forms").doc(event.params.formId);
    // ຈອງ notifiedAt ກ່ອນສົ່ງ — trigger ເອີ້ນຊ້ຳ (at-least-once) ຈະບໍ່ສົ່ງຊ້ຳ
    const claimed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(formRef);
      if (snap.data()?.notifiedAt) return false;
      tx.update(formRef, { notifiedAt: new Date().toISOString() });
      return true;
    });
    if (!claimed) return;

    const employeesSnap = await db.collection("employees").get();
    const audienceDocs = employeesSnap.docs.filter((d) => {
      const emp = d.data();
      if (emp.status === "delete" || emp.status === "resigned") return false;
      return isInAudience(after.audienceKeys, {
        uid: d.id,
        workLocationUuid: emp.workLocation?.uuid || undefined,
        departmentUuid: emp.department?.uuid || undefined,
        employmentStatus: emp.employmentStatus || undefined,
      });
    });
    if (audienceDocs.length === 0) return;

    const payload = JSON.stringify({
      title: isQuizForm(after) ? "📝 ມີແບບທົດສອບໃໝ່!" : "📋 ມີແບບສອບຖາມໃໝ່!",
      body: after.title || "ກະລຸນາເຂົ້າໄປຕອບແບບຟອມ",
      icon: "/apple-icon.png",
      badge: "/SSMI.svg",
      url: `/dashboard/forms/fill?id=${event.params.formId}`,
    });
    const notified = await sendPushToEmployeeDocs(audienceDocs, payload, "form-open");
    console.log(
      `[form-open]: notified ${notified}/${audienceDocs.length} employees for ${event.params.formId}`,
    );
  },
);
