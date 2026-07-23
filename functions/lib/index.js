"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAuditEvent = exports.recordCheckOut = exports.recordCheckIn = exports.checkAttendanceAt814 = exports.checkAttendanceAt800 = exports.getServerTime = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const web_push_1 = __importDefault(require("web-push"));
if (admin.apps.length === 0) {
    admin.initializeApp();
}
// VAPID keys ພ້ອມໃຊ້ທີ່ module level ໃນ Cloud Functions v2 (process.env ຖືກ inject ກ່ອນ function run)
// ເອີ້ນຄັ້ງດຽວທີ່ module level — ບໍ່ຕ້ອງເອີ້ນຊ້ຳທຸກ invocation
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    web_push_1.default.setVapidDetails('mailto:admin@ssmi-hrm.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}
const TIMEZONE = 'Asia/Vientiane';
function getVientianeParts() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const get = (type) => { var _a, _b; return (_b = (_a = parts.find((p) => p.type === type)) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : '00'; };
    const day = get('day');
    const month = get('month');
    const year = get('year');
    const hour = get('hour');
    const minute = get('minute');
    return {
        date: `${day}-${month}-${year}`,
        isoDate: `${year}-${month}-${day}`,
        checkTime: `${hour}:${minute}`,
        status: 'present',
    };
}
function toMinuteOfDay(hour, minute) {
    return hour * 60 + minute;
}
function computeCheckInStatus(nowMinutes, hasMorningLeaveEndToday, isOffsite) {
    if (hasMorningLeaveEndToday) {
        const presentCutoff = 12 * 60 + 30; // 12:30 — ເວລາສຸດທ້າຍທີ່ຖືວ່າມາທັນ (ມີລາພັກເຄິ່ງເຊົ້າ)
        const lateCutoff = 14 * 60; // 14:00 — ເວລາສຸດທ້າຍທີ່ຖືວ່າມາສາຍ
        if (nowMinutes <= presentCutoff)
            return 'present';
        if (nowMinutes <= lateCutoff)
            return 'late';
        return 'not_check_in';
    }
    if (isOffsite) {
        // ອອກວຽກນອກ: ທັນ < 09:00 | ສາຍ 09:00–09:59 | ບໍ່ check-in >= 10:00
        if (nowMinutes < 9 * 60)
            return 'present';
        if (nowMinutes < 10 * 60)
            return 'late';
        return 'not_check_in';
    }
    const presentCutoff = 8 * 60 + 15; // 08:15 — ເວລາສຸດທ້າຍທີ່ຖືວ່າມາທັນ
    const lateCutoff = 10 * 60; // 10:00 — ເວລາສຸດທ້າຍທີ່ຖືວ່າມາສາຍ
    if (nowMinutes <= presentCutoff)
        return 'present';
    if (nowMinutes <= lateCutoff)
        return 'late';
    return 'not_check_in';
}
const callableCorsOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://hrmapp.ssmilaos.com', // Production web app
    'https://demohrm.ssmilaos.com', // Android Capacitor WebView / staging
    'capacitor://localhost', // iOS Capacitor WebView
    'ionic://localhost',
    /^https:\/\/.*\.web\.app$/,
    /^https:\/\/.*\.firebaseapp\.com$/,
];
// ຄຳນວນ leave status ສຳລັບວັນ isoDate ໜຶ່ງ:
//   'blocked'      — ລາພັກທັງໝົດ, ຫ້າມ Check-In
//   'morning_leave'— ລາພັກເຄິ່ງເຊົ້າ, Check-In ໄດ້ ແຕ່ threshold ຊ້ານານຂຶ້ນ (ທັນ ≤12:30)
//   'none'         — ວັນທຳມະດາ
async function getDayLeaveStatus(userUuid, isoDate) {
    var _a, _b, _c, _d;
    if (!userUuid)
        return 'none';
    const snapshot = await admin
        .firestore()
        .collection('leaves')
        .where('leaveUserUuid', '==', userUuid)
        .where('status', '==', 'approved')
        .get();
    for (const d of snapshot.docs) {
        const leave = d.data();
        const startDate = (_a = leave.startDate) !== null && _a !== void 0 ? _a : '';
        const endDate = (_b = leave.endDate) !== null && _b !== void 0 ? _b : '';
        const startPeriod = ((_c = leave.startPeriod) !== null && _c !== void 0 ? _c : 'morning').toLowerCase();
        // ຮັກສາ 'monning' ໄວ້ເພື່ອ compatibility ກັບຂໍ້ມູນເກົ່າ
        const rawEnd = ((_d = leave.endPeriod) !== null && _d !== void 0 ? _d : 'afternoon').toLowerCase();
        const endPeriod = rawEnd === 'monning' ? 'morning' : rawEnd;
        if (!startDate || !endDate || isoDate < startDate || isoDate > endDate)
            continue;
        // ວັນກາງ — ລາພັກທັງໝົດ
        if (isoDate > startDate && isoDate < endDate)
            return 'blocked';
        if (isoDate === startDate && isoDate === endDate) {
            if (startPeriod === 'morning' && endPeriod === 'afternoon')
                return 'blocked';
            if (endPeriod === 'morning')
                return 'morning_leave';
            continue; // ລາພັກບ່າຍ — Check-In ປົກກະຕິ
        }
        if (isoDate === startDate) {
            if (startPeriod === 'morning')
                return 'blocked';
            continue; // ເລີ່ມບ່າຍ — Check-In ໄດ້
        }
        // isoDate === endDate (isoDate > startDate)
        return endPeriod === 'afternoon' ? 'blocked' : 'morning_leave';
    }
    return 'none';
}
// ຮັກສາ backward-compat ສຳລັບ getServerTime endpoint
async function hasMorningLeaveEndingToday(userUuid, isoDate) {
    return (await getDayLeaveStatus(userUuid, isoDate)) === 'morning_leave';
}
// =========================================================================
// 🌐 1. ດຶງເວລາ Server
// =========================================================================
exports.getServerTime = (0, https_1.onCall)({ region: 'asia-southeast1', cors: callableCorsOrigins, invoker: 'public' }, async (request) => {
    var _a;
    const { date, checkTime, isoDate } = getVientianeParts();
    const [hourStr, minuteStr] = checkTime.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const userUuid = typeof ((_a = request.data) === null || _a === void 0 ? void 0 : _a.userUuid) === 'string' ? request.data.userUuid : undefined;
    const morningLeaveEndToday = await hasMorningLeaveEndingToday(userUuid, isoDate);
    const status = computeCheckInStatus(toMinuteOfDay(hour, minute), morningLeaveEndToday);
    const isLate = status === 'late';
    return { date, isoDate, checkTime, status, isLate, timestamp: Date.now() };
});
// =========================================================================
// 🔔 2. ກວດສອບ + ສົ່ງ Push Notification ແຈ້ງເຕືອນ
// =========================================================================
const PUSH_BATCH_SIZE = 20;
async function sendAttendanceReminder(tag) {
    const { isoDate } = getVientianeParts();
    console.log(`[Cron ${tag}]: checking not-checked-in for ${isoDate}`);
    const db = admin.firestore();
    const snapshot = await db
        .collection('attendance')
        .where('dateKey', '==', isoDate)
        .where('status', '==', 'not_checked_in')
        .get();
    if (snapshot.empty) {
        console.log(`[Cron ${tag}]: all employees checked in today.`);
        return;
    }
    const payload = JSON.stringify({
        title: '🚨 ເຕືອນ Check-in ເຂົ້າວຽກ!',
        body: 'ຮອດເວລາແລ້ວ! ກະລຸນາກົດບັນທຶກເວລາເຂົ້າວຽກຂອງທ່ານຕອນນີ້.',
        icon: '/apple-icon.png',
        badge: '/SSMI.svg',
        url: '/dashboard/attendance',
    });
    const userUids = [
        ...new Set(snapshot.docs
            .map(d => d.data().uid)
            .filter(Boolean)),
    ];
    const employeeRefs = userUids.map(uid => db.collection('employees').doc(uid));
    const employeeDocs = await db.getAll(...employeeRefs);
    // ກັ່ນກອງ employee ທີ່ແຈ້ງເຕືອນແລ້ວໃນ tag ນີ້ (ກັນແຈ້ງເຕືອນຊ້ຳ)
    const notifiedField = `notified_${tag}`;
    const eligibleDocs = employeeDocs.filter((empDoc) => {
        if (!empDoc.exists)
            return false;
        const data = empDoc.data();
        if (!(data === null || data === void 0 ? void 0 : data.pushSubscription))
            return false;
        if (data[notifiedField] === isoDate)
            return false;
        return true;
    });
    const allResults = [];
    for (let i = 0; i < eligibleDocs.length; i += PUSH_BATCH_SIZE) {
        const batchDocs = eligibleDocs.slice(i, i + PUSH_BATCH_SIZE);
        const batchResults = await Promise.all(batchDocs.map(async (empDoc) => {
            var _a;
            const subscription = (_a = empDoc.data()) === null || _a === void 0 ? void 0 : _a.pushSubscription;
            return web_push_1.default
                .sendNotification(subscription, payload)
                .then(async () => {
                await db.collection('employees').doc(empDoc.id)
                    .update({ [notifiedField]: isoDate });
                return true;
            })
                .catch(async (err) => {
                // subscription ໝົດອາຍຸ ຫຼື ບໍ່ valid — ລ້າງອອກຈາກ Firestore
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await db.collection('employees').doc(empDoc.id)
                        .update({ pushSubscription: admin.firestore.FieldValue.delete() });
                    console.warn(`[Cron ${tag}]: removed stale subscription for ${empDoc.id}`);
                }
                else {
                    console.error(`[Cron ${tag}]: failed to notify ${empDoc.id}:`, err);
                }
                return false;
            });
        }));
        allResults.push(...batchResults);
    }
    const notified = allResults.filter(Boolean).length;
    console.log(`[Cron ${tag}]: Notified ${notified} / ${eligibleDocs.length} eligible (${snapshot.size} not checked in)`);
}
// =========================================================================
// ⏰ 3. CRON JOB 08:00 (ຈັນ–ສຸກ)
// =========================================================================
exports.checkAttendanceAt800 = (0, scheduler_1.onSchedule)({ schedule: '0 8 * * 1-5', timeZone: TIMEZONE, region: 'asia-southeast1' }, async () => { await sendAttendanceReminder('0800'); });
// =========================================================================
// ⏰ 4. CRON JOB 08:14 (ຈັນ–ສຸກ)
// =========================================================================
exports.checkAttendanceAt814 = (0, scheduler_1.onSchedule)({ schedule: '14 8 * * 1-5', timeZone: TIMEZONE, region: 'asia-southeast1' }, async () => { await sendAttendanceReminder('0814'); });
// =========================================================================
// 📍 5. CHECK-IN ພ້ອມກວດສອບ Geofence ຢູ່ Server
// =========================================================================
function haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
exports.recordCheckIn = (0, https_1.onCall)({ region: 'asia-southeast1', cors: callableCorsOrigins, invoker: 'public' }, async (request) => {
    var _a, _b, _c, _d;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in');
    }
    const data = request.data;
    if (!data.userUuid) {
        throw new https_1.HttpsError('invalid-argument', 'userUuid is required');
    }
    // ກັນ user ໜຶ່ງ check-in ແທນ user ອື່ນ
    if (data.uid && data.uid !== request.auth.uid) {
        throw new https_1.HttpsError('permission-denied', 'Cannot check in as another user');
    }
    // ເວລາຈາກ server — client ບໍ່ສາມາດປ່ຽນເວລາ check-in ຫຼື status ໄດ້
    const { date, isoDate, checkTime } = getVientianeParts();
    const [hourStr, minuteStr] = checkTime.split(':');
    // ກວດ leave — ຖ້າລາພັກທັງໝົດ ໃຫ້ block; ຖ້າລາພັກເຄິ່ງເຊົ້າ ໃຊ້ threshold ຊ້ານານຂຶ້ນ
    const dayLeaveStatus = await getDayLeaveStatus(data.userUuid, isoDate);
    if (dayLeaveStatus === 'blocked') {
        throw new https_1.HttpsError('failed-precondition', 'ທ່ານມີວັນລາພັກທີ່ໄດ້ຮັບອະນຸມັດໃນວັນນີ້ ບໍ່ສາມາດ Check-In ໄດ້');
    }
    const status = computeCheckInStatus(toMinuteOfDay(parseInt(hourStr, 10), parseInt(minuteStr, 10)), dayLeaveStatus === 'morning_leave', data.isOffsite);
    // ກວດ Geofence — ດຶງ coordinates ຫ້ອງການຈາກ Firestore (client ປອມບໍ່ໄດ້)
    if (!data.isOffsite && data.location != null) {
        const empSnap = await admin.firestore()
            .collection('employees')
            .where('uuid', '==', data.userUuid)
            .limit(1)
            .get();
        if (!empSnap.empty) {
            const workLocationUid = (_b = (_a = empSnap.docs[0].data()) === null || _a === void 0 ? void 0 : _a.workLocation) === null || _b === void 0 ? void 0 : _b.uid;
            if (workLocationUid) {
                const locDoc = await admin.firestore().collection('workLocations').doc(workLocationUid).get();
                const locData = locDoc.data();
                if ((locData === null || locData === void 0 ? void 0 : locData.lat) != null && (locData === null || locData === void 0 ? void 0 : locData.lng) != null) {
                    const dist = Math.round(haversineMeters(data.location.lat, data.location.lng, locData.lat, locData.lng));
                    if (dist > 50) {
                        throw new https_1.HttpsError('failed-precondition', `ທ່ານຢູ່ຫ່າງຈາກຫ້ອງການ ${dist} ແມັດ. ຕ້ອງຢູ່ພາຍໃນ 50 ແມັດ.`);
                    }
                }
            }
        }
    }
    const attendanceId = `${data.userUuid}_${date}`;
    await admin.firestore()
        .collection('attendance')
        .doc(attendanceId)
        .set(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ _id: attendanceId, uid: (_c = data.uid) !== null && _c !== void 0 ? _c : data.userUuid, userUuid: data.userUuid, date, dateKey: isoDate, checkInTime: checkTime, status }, (dayLeaveStatus === 'morning_leave' ? { morningLeaveDay: true } : {})), (data.location ? { location: { lat: data.location.lat, lng: data.location.lng } } : {})), (data.fullNameEn != null ? { fullNameEn: data.fullNameEn } : {})), (data.fullNameLo != null ? { fullNameLo: data.fullNameLo } : {})), (data.jobTitle != null ? { jobTitle: data.jobTitle } : {})), (data.employeeImage != null ? { employeeImage: data.employeeImage } : {})), (data.note != null ? { note: data.note } : {})), (data.department ? { department: data.department } : {})), (data.workLocation ? { workLocation: data.workLocation } : {})), (data.checkInImageURL ? { checkInImageURL: data.checkInImageURL } : {})), (data.isOffsite ? { isOffsite: true } : {})), { updatedAt: new Date().toISOString(), updatedBy: (_d = data.updatedBy) !== null && _d !== void 0 ? _d : data.userUuid }), { merge: true });
    return { attendanceId, date, isoDate, checkTime, status };
});
// =========================================================================
// 🚪 6. CHECK-OUT ດ້ວຍເວລາ Server
// =========================================================================
exports.recordCheckOut = (0, https_1.onCall)({ region: 'asia-southeast1', cors: callableCorsOrigins, invoker: 'public' }, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in');
    }
    const data = request.data;
    if (!data.userUuid) {
        throw new https_1.HttpsError('invalid-argument', 'userUuid is required');
    }
    // ກັນ user ໜຶ່ງ check-out ແທນ user ອື່ນ
    if (data.uid && data.uid !== request.auth.uid) {
        throw new https_1.HttpsError('permission-denied', 'Cannot check out as another user');
    }
    const { date, checkTime } = getVientianeParts();
    const attendanceId = `${data.userUuid}_${date}`;
    // ອ່ານ checkInTime ທີ່ມີຢູ່ເພື່ອຄຳນວນ workHours
    const existing = await admin.firestore().collection('attendance').doc(attendanceId).get();
    const checkInTime = (_a = existing.data()) === null || _a === void 0 ? void 0 : _a.checkInTime;
    let workHours = 0;
    if (checkInTime) {
        const [inH, inM] = checkInTime.split(':').map(Number);
        const [outH, outM] = checkTime.split(':').map(Number);
        const diffMinutes = (outH * 60 + outM) - (inH * 60 + inM);
        workHours = diffMinutes > 0 ? Math.round((diffMinutes / 60) * 10) / 10 : 0;
    }
    await admin.firestore()
        .collection('attendance')
        .doc(attendanceId)
        .set(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ checkOutTime: checkTime, workHours }, (data.fullNameEn != null ? { fullNameEn: data.fullNameEn } : {})), (data.fullNameLo != null ? { fullNameLo: data.fullNameLo } : {})), (data.jobTitle != null ? { jobTitle: data.jobTitle } : {})), (data.employeeImage != null ? { employeeImage: data.employeeImage } : {})), (data.department ? { department: data.department } : {})), (data.workLocation ? { workLocation: data.workLocation } : {})), (data.checkOutImageURL ? { checkOutImageURL: data.checkOutImageURL } : {})), (data.location ? { location: { lat: data.location.lat, lng: data.location.lng } } : {})), { updatedAt: new Date().toISOString(), updatedBy: data.userUuid }), { merge: true });
    return { attendanceId, checkOutTime: checkTime, workHours };
});
exports.logAuditEvent = (0, https_1.onCall)({ region: 'asia-southeast1', cors: callableCorsOrigins, invoker: 'public' }, async (request) => {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in');
    }
    const data = request.data;
    if (!data.action || !data.targetType || !data.targetId || !data.status) {
        throw new https_1.HttpsError('invalid-argument', 'action, targetType, targetId, status are required');
    }
    const forwardedFor = request.rawRequest.headers['x-forwarded-for'];
    const ipAddress = (_c = (_b = (_a = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)) === null || _a === void 0 ? void 0 : _a.split(',')[0]) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : request.rawRequest.ip;
    const userAgent = request.rawRequest.headers['user-agent'];
    const entry = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ systemType: 'portal', action: data.action, actorUid: request.auth.uid, actorName: (_d = data.actorName) !== null && _d !== void 0 ? _d : '', actorRoleUuid: (_e = data.actorRoleUuid) !== null && _e !== void 0 ? _e : '' }, (data.actorRoleName != null ? { actorRoleName: data.actorRoleName } : {})), { targetType: data.targetType, targetId: data.targetId }), (data.targetName != null ? { targetName: data.targetName } : {})), { 
        // Always present — {} when the action has no natural prior/new state
        // (e.g. login/logout) rather than omitting the field entirely.
        before: (_f = data.before) !== null && _f !== void 0 ? _f : {}, after: (_g = data.after) !== null && _g !== void 0 ? _g : {} }), (data.changedFields != null ? { changedFields: data.changedFields } : {})), (data.reason != null ? { reason: data.reason } : {})), { status: data.status }), (data.errorMessage != null ? { errorMessage: data.errorMessage } : {})), (ipAddress != null ? { ipAddress } : {})), (userAgent != null ? { userAgent } : {})), (data.requestUrl != null ? { requestUrl: data.requestUrl } : {})), (data.companyId != null ? { companyId: data.companyId } : {})), (data.branchId != null ? { branchId: data.branchId } : {})), { createdAt: new Date().toISOString() });
    const docRef = await admin.firestore().collection('auditLogs').add(entry);
    return { id: docRef.id };
});
//# sourceMappingURL=index.js.map