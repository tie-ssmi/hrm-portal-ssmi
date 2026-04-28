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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServerTime = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
admin.initializeApp();
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
        date: `${day}-${month}-${year}`, // DD-MM-YYYY
        isoDate: `${year}-${month}-${day}`, // YYYY-MM-DD
        checkTime: `${hour}:${minute}`, // HH:mm
        status: 'present',
    };
}
function toMinuteOfDay(hour, minute) {
    return hour * 60 + minute;
}
function computeCheckInStatus(nowMinutes, hasMorningLeaveEndToday) {
    if (hasMorningLeaveEndToday) {
        const presentCutoff = 12 * 60 + 30; // 12:30
        const lateCutoff = 14 * 60; // 14:00
        if (nowMinutes <= presentCutoff) {
            return 'present';
        }
        if (nowMinutes <= lateCutoff) {
            return 'late';
        }
        return 'not_check_in';
    }
    const presentCutoff = 8 * 60 + 15; // 08:15
    const lateCutoff = 10 * 60; // 10:00
    if (nowMinutes <= presentCutoff) {
        return 'present';
    }
    if (nowMinutes <= lateCutoff) {
        return 'late';
    }
    return 'not_check_in';
}
const callableCorsOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'capacitor://localhost',
    'ionic://localhost',
    /^https:\/\/.*\.web\.app$/,
    /^https:\/\/.*\.firebaseapp\.com$/,
];
async function hasMorningLeaveEndingToday(userUuid, isoDate) {
    if (!userUuid) {
        return false;
    }
    const snapshot = await admin
        .firestore()
        .collection('leaves')
        .where('userUuid', '==', userUuid)
        .get();
    return snapshot.docs.some((doc) => {
        const leave = doc.data();
        const status = (leave.status || '').toLowerCase();
        const endDate = leave.endDate || '';
        const endPeriod = (leave.endPeriod || '').toLowerCase();
        return (status === 'approved' &&
            endDate === isoDate &&
            (endPeriod === 'morning' || endPeriod === 'monning'));
    });
}
exports.getServerTime = (0, https_1.onCall)({ region: 'asia-southeast1', cors: callableCorsOrigins }, async (request) => {
    var _a;
    const { date, checkTime, isoDate } = getVientianeParts();
    const [hourStr, minuteStr] = checkTime.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const userUuid = typeof ((_a = request.data) === null || _a === void 0 ? void 0 : _a.userUuid) === 'string' ? request.data.userUuid : undefined;
    const morningLeaveEndToday = await hasMorningLeaveEndingToday(userUuid, isoDate);
    const status = computeCheckInStatus(toMinuteOfDay(hour, minute), morningLeaveEndToday);
    const isLate = status === 'late';
    return {
        date,
        isoDate,
        checkTime,
        status,
        isLate,
        timestamp: Date.now(),
    };
});
//# sourceMappingURL=index.js.map