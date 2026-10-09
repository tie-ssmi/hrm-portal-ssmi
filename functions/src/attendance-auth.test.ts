import { test } from "node:test";
import assert from "node:assert/strict";
import { HttpsError } from "firebase-functions/v2/https";
import { assertCallerOwnsAttendance } from "./attendance-auth";

const isHttpsError = (code: string) => (error: unknown) =>
  error instanceof HttpsError && error.code === code;

test("recordCheckIn: userUuid ກົງກັບ auth uid → ຜ່ານ ແລະ ຄືນ userUuid", () => {
  assert.equal(assertCallerOwnsAttendance("I269", "I269", "check in"), "I269");
});

test("recordCheckIn: userUuid ≠ auth uid → permission-denied", () => {
  // ກໍລະນີຈິງ: ບັນຊີ Auth "p6Z9..." ສົ່ງ userUuid = doc id ພະນັກງານ "I269..."
  assert.throws(
    () => assertCallerOwnsAttendance("p6Z9", "I269", "check in"),
    isHttpsError("permission-denied"),
  );
});

test("recordCheckOut: userUuid ≠ auth uid → permission-denied", () => {
  assert.throws(
    () => assertCallerOwnsAttendance("p6Z9", "I269", "check out"),
    isHttpsError("permission-denied"),
  );
});

test("userUuid ຫວ່າງ ຫຼື ບໍ່ແມ່ນ string → invalid-argument", () => {
  for (const bad of [undefined, "", 123]) {
    assert.throws(
      () => assertCallerOwnsAttendance("I269", bad, "check in"),
      isHttpsError("invalid-argument"),
    );
  }
});
