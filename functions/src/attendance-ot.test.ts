import { test } from "node:test";
import assert from "node:assert/strict";

import {
  calcWorkHours,
  computeOTCheckInStatus,
  pickTodayOTRequest,
} from "./attendance-ot";

const base = {
  formType: "overtime",
  status: "approved",
  startDate: "2026-10-17",
  endDate: "2026-10-18",
  startTime: "08:00",
  endTime: "17:00",
  teammate: [{ uid: "U1" }],
};

test("picks an approved OT request covering today for a teammate", () => {
  const req = { id: "a", ...base };
  assert.equal(pickTodayOTRequest([req], "U1", "2026-10-17")?.id, "a");
  assert.equal(pickTodayOTRequest([req], "U1", "2026-10-18")?.id, "a");
});

test("ignores requests outside the date range", () => {
  const req = { id: "a", ...base };
  assert.equal(pickTodayOTRequest([req], "U1", "2026-10-16"), null);
  assert.equal(pickTodayOTRequest([req], "U1", "2026-10-19"), null);
});

test("ignores pending, rejected and non-OT requests", () => {
  for (const patch of [
    { status: "pending" },
    { status: "rejected" },
    { status: "cancelled" },
    { formType: "workOutside" },
    { formType: undefined },
  ]) {
    assert.equal(
      pickTodayOTRequest([{ id: "a", ...base, ...patch }], "U1", "2026-10-17"),
      null,
    );
  }
});

test("only teammates qualify", () => {
  const req = { id: "a", ...base };
  assert.equal(pickTodayOTRequest([req], "U2", "2026-10-17"), null);
});

test("single-day request with no endDate still matches its day", () => {
  const req = { id: "a", ...base, endDate: undefined };
  assert.equal(pickTodayOTRequest([req], "U1", "2026-10-17")?.id, "a");
});

test("earliest start time wins when two requests cover today", () => {
  const late = { id: "late", ...base, startTime: "13:00" };
  const early = { id: "early", ...base, startTime: "06:00" };
  assert.equal(pickTodayOTRequest([late, early], "U1", "2026-10-17")?.id, "early");
});

test("status: on or before start time is present, after is late", () => {
  assert.equal(computeOTCheckInStatus("07:55", "08:00"), "present");
  assert.equal(computeOTCheckInStatus("08:00", "08:00"), "present");
  assert.equal(computeOTCheckInStatus("08:01", "08:00"), "late");
  assert.equal(computeOTCheckInStatus("08:30", undefined), "present");
});

test("work hours", () => {
  assert.equal(calcWorkHours("08:00", "17:00"), 9);
  assert.equal(calcWorkHours("06:00", "09:00"), 3);
  assert.equal(calcWorkHours("08:04", "17:43"), 9.7);
  assert.equal(calcWorkHours("17:00", "08:00"), 0);
});
