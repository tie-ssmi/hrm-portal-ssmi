"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const attendance_ot_1 = require("./attendance-ot");
const base = {
    formType: "overtime",
    status: "approved",
    startDate: "2026-10-17",
    endDate: "2026-10-18",
    startTime: "08:00",
    endTime: "17:00",
    teammate: [{ uid: "U1" }],
};
(0, node_test_1.test)("picks an approved OT request covering today for a teammate", () => {
    var _a, _b;
    const req = Object.assign({ id: "a" }, base);
    strict_1.default.equal((_a = (0, attendance_ot_1.pickTodayOTRequest)([req], "U1", "2026-10-17")) === null || _a === void 0 ? void 0 : _a.id, "a");
    strict_1.default.equal((_b = (0, attendance_ot_1.pickTodayOTRequest)([req], "U1", "2026-10-18")) === null || _b === void 0 ? void 0 : _b.id, "a");
});
(0, node_test_1.test)("ignores requests outside the date range", () => {
    const req = Object.assign({ id: "a" }, base);
    strict_1.default.equal((0, attendance_ot_1.pickTodayOTRequest)([req], "U1", "2026-10-16"), null);
    strict_1.default.equal((0, attendance_ot_1.pickTodayOTRequest)([req], "U1", "2026-10-19"), null);
});
(0, node_test_1.test)("ignores pending, rejected and non-OT requests", () => {
    for (const patch of [
        { status: "pending" },
        { status: "rejected" },
        { status: "cancelled" },
        { formType: "workOutside" },
        { formType: undefined },
    ]) {
        strict_1.default.equal((0, attendance_ot_1.pickTodayOTRequest)([Object.assign(Object.assign({ id: "a" }, base), patch)], "U1", "2026-10-17"), null);
    }
});
(0, node_test_1.test)("only teammates qualify", () => {
    const req = Object.assign({ id: "a" }, base);
    strict_1.default.equal((0, attendance_ot_1.pickTodayOTRequest)([req], "U2", "2026-10-17"), null);
});
(0, node_test_1.test)("single-day request with no endDate still matches its day", () => {
    var _a;
    const req = Object.assign(Object.assign({ id: "a" }, base), { endDate: undefined });
    strict_1.default.equal((_a = (0, attendance_ot_1.pickTodayOTRequest)([req], "U1", "2026-10-17")) === null || _a === void 0 ? void 0 : _a.id, "a");
});
(0, node_test_1.test)("earliest start time wins when two requests cover today", () => {
    var _a;
    const late = Object.assign(Object.assign({ id: "late" }, base), { startTime: "13:00" });
    const early = Object.assign(Object.assign({ id: "early" }, base), { startTime: "06:00" });
    strict_1.default.equal((_a = (0, attendance_ot_1.pickTodayOTRequest)([late, early], "U1", "2026-10-17")) === null || _a === void 0 ? void 0 : _a.id, "early");
});
(0, node_test_1.test)("status: on or before start time is present, after is late", () => {
    strict_1.default.equal((0, attendance_ot_1.computeOTCheckInStatus)("07:55", "08:00"), "present");
    strict_1.default.equal((0, attendance_ot_1.computeOTCheckInStatus)("08:00", "08:00"), "present");
    strict_1.default.equal((0, attendance_ot_1.computeOTCheckInStatus)("08:01", "08:00"), "late");
    strict_1.default.equal((0, attendance_ot_1.computeOTCheckInStatus)("08:30", undefined), "present");
});
(0, node_test_1.test)("work hours", () => {
    strict_1.default.equal((0, attendance_ot_1.calcWorkHours)("08:00", "17:00"), 9);
    strict_1.default.equal((0, attendance_ot_1.calcWorkHours)("06:00", "09:00"), 3);
    strict_1.default.equal((0, attendance_ot_1.calcWorkHours)("08:04", "17:43"), 9.7);
    strict_1.default.equal((0, attendance_ot_1.calcWorkHours)("17:00", "08:00"), 0);
});
//# sourceMappingURL=attendance-ot.test.js.map