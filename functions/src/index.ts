import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import webpush from "web-push";

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

function computeCheckInStatus(
  nowMinutes: number,
  hasMorningLeaveEndToday: boolean,
  isOffsite?: boolean,
): CheckInStatus {
  if (hasMorningLeaveEndToday) {
    const presentCutoff = 12 * 60 + 30; // 12:30 — ເວລາສຸດທ້າຍທີ່ຖືວ່າມາທັນ (ມີລາພັກເຄິ່ງເຊົ້າ)
    const lateCutoff = 14 * 60; // 14:00 — ເວລາສຸດທ້າຍທີ່ຖືວ່າມາສາຍ

    if (nowMinutes <= presentCutoff) return "present";
    if (nowMinutes <= lateCutoff) return "late";
    return "not_check_in";
  }

  if (isOffsite) {
    // ອອກວຽກນອກ: ທັນ < 09:00 | ສາຍ 09:00–09:59 | ບໍ່ check-in >= 10:00
    if (nowMinutes < 9 * 60) return "present";
    if (nowMinutes < 10 * 60) return "late";
    return "not_check_in";
  }

  const presentCutoff = 8 * 60 + 15; // 08:15 — ເວລາສຸດທ້າຍທີ່ຖືວ່າມາທັນ
  const lateCutoff = 10 * 60; // 10:00 — ເວລາສຸດທ້າຍທີ່ຖືວ່າມາສາຍ

  if (nowMinutes <= presentCutoff) return "present";
  if (nowMinutes <= lateCutoff) return "late";
  return "not_check_in";
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
// 🔔 2. ກວດສອບ + ສົ່ງ Push Notification ແຈ້ງເຕືອນ
// =========================================================================
const PUSH_BATCH_SIZE = 20;

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

  // ກັ່ນກອງ employee ທີ່ແຈ້ງເຕືອນແລ້ວໃນ tag ນີ້ (ກັນແຈ້ງເຕືອນຊ້ຳ)
  const notifiedField = `notified_${tag}`;
  const eligibleDocs = employeeDocs.filter((empDoc) => {
    if (!empDoc.exists) return false;
    const data = empDoc.data();
    if (!data?.pushSubscription) return false;
    if (data[notifiedField] === isoDate) return false;
    return true;
  });

  const allResults: boolean[] = [];
  for (let i = 0; i < eligibleDocs.length; i += PUSH_BATCH_SIZE) {
    const batchDocs = eligibleDocs.slice(i, i + PUSH_BATCH_SIZE);
    const batchResults = await Promise.all(
      batchDocs.map(async (empDoc) => {
        const subscription = empDoc.data()?.pushSubscription;

        return webpush
          .sendNotification(subscription, payload)
          .then(async () => {
            await db
              .collection("employees")
              .doc(empDoc.id)
              .update({ [notifiedField]: isoDate });
            return true;
          })
          .catch(async (err: any) => {
            // subscription ໝົດອາຍຸ ຫຼື ບໍ່ valid — ລ້າງອອກຈາກ Firestore
            if (err.statusCode === 410 || err.statusCode === 404) {
              await db
                .collection("employees")
                .doc(empDoc.id)
                .update({
                  pushSubscription: admin.firestore.FieldValue.delete(),
                });
              console.warn(
                `[Cron ${tag}]: removed stale subscription for ${empDoc.id}`,
              );
            } else {
              console.error(
                `[Cron ${tag}]: failed to notify ${empDoc.id}:`,
                err,
              );
            }
            return false;
          });
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
        const subscription = empDoc.data()?.pushSubscription;
        if (!subscription) return false;

        return webpush
          .sendNotification(subscription, payload)
          .then(() => true)
          .catch(async (err: any) => {
            if (err.statusCode === 410 || err.statusCode === 404) {
              await db
                .collection("employees")
                .doc(empDoc.id)
                .update({
                  pushSubscription: admin.firestore.FieldValue.delete(),
                });
              console.warn(`[${tag}]: removed stale subscription for ${empDoc.id}`);
            } else {
              console.error(`[${tag}]: failed to notify ${empDoc.id}:`, err);
            }
            return false;
          });
      }),
    );
    notified += results.filter(Boolean).length;
  }

  return notified;
}

type LeaveCreatedDoc = {
  status?: string;
  leaveUserUuid?: string;
  leaveUserName?: string;
  reason?: string;
  workLocationUid?: string;
  departmentUid?: string;
};

export const notifyNewLeaveRequest = onDocumentCreated(
  { document: "leaves/{leaveId}", region: "asia-southeast1" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const leave = snap.data() as LeaveCreatedDoc;

    if (leave.status !== "pending" || !leave.workLocationUid) return;

    const db = admin.firestore();
    const [branchSnap, deptSnap] = await Promise.all([
      db
        .collection("employees")
        .where("rolePermissions.approveBranch", "==", true)
        .where("workLocation.uuid", "==", leave.workLocationUid)
        .get(),
      leave.departmentUid
        ? db
            .collection("employees")
            .where("rolePermissions.approveDepartment", "==", true)
            .where("workLocation.uuid", "==", leave.workLocationUid)
            .where("department.uuid", "==", leave.departmentUid)
            .get()
        : null,
    ]);

    const seen = new Set<string>();
    const approverDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    for (const snapshot of [branchSnap, deptSnap]) {
      if (!snapshot) continue;
      for (const d of snapshot.docs) {
        if (d.id === leave.leaveUserUuid || seen.has(d.id)) continue;
        seen.add(d.id);
        approverDocs.push(d);
      }
    }

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
    const [branchSnap, deptSnap] = await Promise.all([
      db
        .collection("employees")
        .where("rolePermissions.approveBranch", "==", true)
        .where("workLocation.uuid", "==", workLocationUid)
        .get(),
      work.departmentUid
        ? db
            .collection("employees")
            .where("rolePermissions.approveDepartment", "==", true)
            .where("department.uuid", "==", work.departmentUid)
            .get()
        : null,
    ]);

    const seen = new Set<string>();
    const approverDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    for (const snapshot of [branchSnap, deptSnap]) {
      if (!snapshot) continue;
      for (const d of snapshot.docs) {
        if (d.id === work.createdByUid || seen.has(d.id)) continue;
        seen.add(d.id);
        approverDocs.push(d);
      }
    }

    if (approverDocs.length === 0) return;

    const payload = JSON.stringify({
      title: "🚗 ມີຄຳຂໍອອກນອກສະຖານທີ່ໃໝ່!",
      body: `ພະນັກງານ: ${work.createdBy || "ບໍ່ມີຊື່"} — ${work.subject || "ບໍ່ລະບຸ"}`,
      icon: "/apple-icon.png",
      badge: "/SSMI.svg",
      url: "/dashboard/approv",
    });

    const notified = await sendPushToEmployeeDocs(approverDocs, payload, "offsite-new");
    console.log(
      `[offsite-new]: notified ${notified}/${approverDocs.length} approvers for ${event.params.requestId}`,
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

// date, checkInTime, status ບໍ່ຮັບຈາກ client — server ຄຳນວນເອງ ກັນການປອມເວລາ
type CheckInPayload = {
  userUuid: string;
  uid?: string;
  location?: { lat: number; lng: number };
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
  department?: { name: string; uid: string };
  workLocation?: { code?: string; name: string; uid?: string };
};

type CheckOutPayload = {
  userUuid: string;
  uid?: string;
  location?: { lat: number; lng: number };
  checkOutImageURL?: string;
  fullNameEn?: string;
  fullNameLo?: string;
  jobTitle?: string;
  employeeImage?: string;
  deviceLocalId?: string;
  deviceFingerprint?: string;
  department?: { name: string; uid: string };
  workLocation?: { code?: string; name: string; uid?: string };
};

// FingerprintJS (free tier) has very low entropy on iOS Safari — Apple
// deliberately restricts canvas/WebGL/font-enumeration signals for privacy,
// so different iPhones (same model + iOS version) frequently produce the
// same visitorId. Trusting it there causes false "used by another account"
// blocks between unrelated employees. localId (a random UUID persisted in
// localStorage) doesn't have this collision problem, so on iOS we rely on
// it alone rather than also cross-checking the fingerprint.
function isIOSUserAgent(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  return /iPhone|iPad|iPod/i.test(userAgent);
}

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

// ກັນ "ຢືມເຄື່ອງກັນ punch" — ອຸປະກອນດຽວກັນ (localId ຫຼື fingerprint) ຫ້າມໃຊ້
// check-in/check-out ໃຫ້ຫຼາຍກວ່າໜຶ່ງບັນຊີ ໃນມື້ດຽວກັນ. ບໍ່ blockບັນຊີດຽວກັນ
// ທີ່ໃຊ້ເຄື່ອງດຽວກັນຊ້ຳ (ນັ້ນຖືກ handle ຢູ່ແລ້ວທາງ client ດ້ວຍ merge write).
async function assertDeviceNotUsedByOtherAccount(
  isoDate: string,
  userUuid: string,
  deviceLocalId: string | undefined,
  deviceFingerprint: string | undefined,
  field: "checkInTime" | "checkOutTime",
  errorMessage: string,
  useFingerprint: boolean,
): Promise<void> {
  if (!deviceLocalId && !deviceFingerprint) return;

  const queries: Promise<admin.firestore.QuerySnapshot>[] = [];
  if (deviceLocalId) {
    queries.push(
      admin
        .firestore()
        .collection("attendance")
        .where("dateKey", "==", isoDate)
        .where("deviceLocalId", "==", deviceLocalId)
        .get(),
    );
  }
  if (deviceFingerprint && useFingerprint) {
    queries.push(
      admin
        .firestore()
        .collection("attendance")
        .where("dateKey", "==", isoDate)
        .where("deviceFingerprint", "==", deviceFingerprint)
        .get(),
    );
  }

  const snaps = await Promise.all(queries);
  const usedByOtherAccount = snaps.some((snap) =>
    snap.docs.some(
      (doc) => doc.data().userUuid !== userUuid && doc.data()[field],
    ),
  );

  if (usedByOtherAccount) {
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

    if (!data.userUuid) {
      throw new HttpsError("invalid-argument", "userUuid is required");
    }

    // ກັນ user ໜຶ່ງ check-in ແທນ user ອື່ນ
    if (data.uid && data.uid !== request.auth.uid) {
      throw new HttpsError(
        "permission-denied",
        "Cannot check in as another user",
      );
    }

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
    // fingerprint ຖືກຂ້າມສະເພາະ iOS — ເບິ່ງ comment ຢູ່ isIOSUserAgent
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
      !isIOSUserAgent(checkInUserAgent),
    );

    const status = computeCheckInStatus(
      toMinuteOfDay(parseInt(hourStr, 10), parseInt(minuteStr, 10)),
      dayLeaveStatus === "morning_leave",
      data.isOffsite,
    );

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
            if (dist > 100) {
              throw new HttpsError(
                "failed-precondition",
                `ທ່ານຢູ່ຫ່າງຈາກຫ້ອງການ ${dist} ແມັດ. ຕ້ອງຢູ່ພາຍໃນ 100 ແມັດ.`,
              );
            }
          }
        }
      }
    }

    const attendanceId = `${data.userUuid}_${date}`;
    await admin
      .firestore()
      .collection("attendance")
      .doc(attendanceId)
      .set(
        {
          _id: attendanceId,
          uid: data.uid ?? data.userUuid,
          userUuid: data.userUuid,
          date,
          dateKey: isoDate,
          checkInTime: checkTime,
          status,
          ...(dayLeaveStatus === "morning_leave"
            ? { morningLeaveDay: true }
            : {}),
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
          updatedAt: new Date().toISOString(),
          updatedBy: data.updatedBy ?? data.userUuid,
        },
        { merge: true },
      );

    return { attendanceId, date, isoDate, checkTime, status };
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

    if (!data.userUuid) {
      throw new HttpsError("invalid-argument", "userUuid is required");
    }

    // ກັນ user ໜຶ່ງ check-out ແທນ user ອື່ນ
    if (data.uid && data.uid !== request.auth.uid) {
      throw new HttpsError(
        "permission-denied",
        "Cannot check out as another user",
      );
    }

    const { date, isoDate, checkTime } = getVientianeParts();
    const attendanceId = `${data.userUuid}_${date}`;

    // ກັນອຸປະກອນດຽວກັນ check-out ແທນຫຼາຍບັນຊີ (ຢືມມືຖືກັນ punch)
    // fingerprint ຖືກຂ້າມສະເພາະ iOS — ເບິ່ງ comment ຢູ່ isIOSUserAgent
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
      !isIOSUserAgent(checkOutUserAgent),
    );

    // ອ່ານ checkInTime ທີ່ມີຢູ່ເພື່ອຄຳນວນ workHours
    const existing = await admin
      .firestore()
      .collection("attendance")
      .doc(attendanceId)
      .get();
    const checkInTime = existing.data()?.checkInTime as string | undefined;
    let workHours = 0;
    if (checkInTime) {
      const [inH, inM] = checkInTime.split(":").map(Number);
      const [outH, outM] = checkTime.split(":").map(Number);
      const diffMinutes = outH * 60 + outM - (inH * 60 + inM);
      workHours =
        diffMinutes > 0 ? Math.round((diffMinutes / 60) * 10) / 10 : 0;
    }

    await admin
      .firestore()
      .collection("attendance")
      .doc(attendanceId)
      .set(
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
          updatedAt: new Date().toISOString(),
          updatedBy: data.userUuid,
        },
        { merge: true },
      );

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
