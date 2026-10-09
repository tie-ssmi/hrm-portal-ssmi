"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const https_1 = require("firebase-functions/v2/https");
const attendance_auth_1 = require("./attendance-auth");
const isHttpsError = (code) => (error) => error instanceof https_1.HttpsError && error.code === code;
(0, node_test_1.test)("recordCheckIn: userUuid ກົງກັບ auth uid → ຜ່ານ ແລະ ຄືນ userUuid", () => {
    strict_1.default.equal((0, attendance_auth_1.assertCallerOwnsAttendance)("I269", "I269", "check in"), "I269");
});
(0, node_test_1.test)("recordCheckIn: userUuid ≠ auth uid → permission-denied", () => {
    // ກໍລະນີຈິງ: ບັນຊີ Auth "p6Z9..." ສົ່ງ userUuid = doc id ພະນັກງານ "I269..."
    strict_1.default.throws(() => (0, attendance_auth_1.assertCallerOwnsAttendance)("p6Z9", "I269", "check in"), isHttpsError("permission-denied"));
});
(0, node_test_1.test)("recordCheckOut: userUuid ≠ auth uid → permission-denied", () => {
    strict_1.default.throws(() => (0, attendance_auth_1.assertCallerOwnsAttendance)("p6Z9", "I269", "check out"), isHttpsError("permission-denied"));
});
(0, node_test_1.test)("userUuid ຫວ່າງ ຫຼື ບໍ່ແມ່ນ string → invalid-argument", () => {
    for (const bad of [undefined, "", 123]) {
        strict_1.default.throws(() => (0, attendance_auth_1.assertCallerOwnsAttendance)("I269", bad, "check in"), isHttpsError("invalid-argument"));
    }
});
//# sourceMappingURL=attendance-auth.test.js.map