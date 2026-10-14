"use strict";
// OT (ເຮັດວຽກວັນພັກ) check-in rules. Pure — no Firestore, no initializeApp —
// so attendance-ot.test.ts can import it. recordOTCheckIn / recordOTCheckOut in
// index.ts do the I/O. Client mirror: lib/attendance-ot.ts (keep in step).
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickTodayOTRequest = pickTodayOTRequest;
exports.computeOTCheckInStatus = computeOTCheckInStatus;
exports.calcWorkHours = calcWorkHours;
// The approved OT request that covers `isoDate` and lists `uid` as a teammate.
// Only teammates count — being the requester alone is not enough (the form
// lets the requester add themselves, which is how they get OT too). With
// several matches the earliest-starting one wins, so a day has one OT punch.
function pickTodayOTRequest(requests, uid, isoDate) {
    var _a;
    const matches = requests.filter((r) => {
        var _a;
        return r.formType === "overtime" &&
            r.status === "approved" &&
            !!r.startDate &&
            r.startDate <= isoDate &&
            isoDate <= (r.endDate || r.startDate) &&
            ((_a = r.teammate) !== null && _a !== void 0 ? _a : []).some((t) => (t === null || t === void 0 ? void 0 : t.uid) === uid);
    });
    matches.sort((a, b) => { var _a, _b; return ((_a = a.startTime) !== null && _a !== void 0 ? _a : "").localeCompare((_b = b.startTime) !== null && _b !== void 0 ? _b : ""); });
    return (_a = matches[0]) !== null && _a !== void 0 ? _a : null;
}
// present when checked in at or before the request's start time, late after.
// "HH:mm" strings compare correctly as text. No start time → present.
function computeOTCheckInStatus(checkTime, startTime) {
    if (!startTime)
        return "present";
    return checkTime <= startTime ? "present" : "late";
}
// Hours between two "HH:mm" times, 1 decimal — same rounding as recordCheckOut.
function calcWorkHours(checkInTime, checkOutTime) {
    const [inH, inM] = checkInTime.split(":").map(Number);
    const [outH, outM] = checkOutTime.split(":").map(Number);
    const diff = outH * 60 + outM - (inH * 60 + inM);
    return diff > 0 ? Math.round((diff / 60) * 10) / 10 : 0;
}
//# sourceMappingURL=attendance-ot.js.map