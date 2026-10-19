import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeBaseCheckInStatus,
  pickActivePolicies,
  resolveCheckIn,
  resolveCheckOutCutoff,
  resolvePolicyTimes,
  type SpecialPolicyLike,
} from "./special-policy";

const t = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const policy = (over: Partial<SpecialPolicyLike>): SpecialPolicyLike => ({
  id: "p1",
  mode: "lateMorning",
  startDate: "2026-10-15",
  endDate: "2026-10-17",
  lateUntil: "09:30",
  leaveFrom: null,
  staffUuids: ["U1"],
  status: "active",
  ...over,
});

const resolved = (...ps: Partial<SpecialPolicyLike>[]) =>
  resolvePolicyTimes(ps.map((p, i) => policy({ id: `p${i + 1}`, ...p })));

const CUTOFF_NORMAL = t("17:00");
const CUTOFF_HOUSEKEEPER = t("16:30");
const CUTOFF_AFTERNOON_LEAVE = t("12:30");

// ---------------------------------------------------------------- base

test("base thresholds: 10:00 is not_check_in, 09:59 late", () => {
  assert.equal(computeBaseCheckInStatus(t("08:15"), "normal"), "present");
  assert.equal(computeBaseCheckInStatus(t("08:16"), "normal"), "late");
  assert.equal(computeBaseCheckInStatus(t("09:59"), "normal"), "late");
  assert.equal(computeBaseCheckInStatus(t("10:00"), "normal"), "not_check_in");
  assert.equal(computeBaseCheckInStatus(t("08:59"), "offsite"), "present");
  assert.equal(computeBaseCheckInStatus(t("09:00"), "offsite"), "late");
  assert.equal(computeBaseCheckInStatus(t("14:00"), "morningLeave"), "late");
  assert.equal(computeBaseCheckInStatus(t("14:01"), "morningLeave"), "not_check_in");
});

test("no policy → base status", () => {
  assert.deepEqual(resolveCheckIn(t("09:00"), "normal", null), { status: "late", needsChoice: false });
});

// ---------------------------------------------------------------- picking

test("pickActivePolicies: date range inclusive, staff only, ignores status delete", () => {
  const ps = [
    policy({ id: "in" }),
    policy({ id: "deleted", status: "delete" }),
    policy({ id: "other-staff", staffUuids: ["U2"] }),
    policy({ id: "past", startDate: "2026-10-01", endDate: "2026-10-14" }),
    policy({ id: "future", startDate: "2026-10-16", endDate: "2026-10-20" }),
  ];
  assert.deepEqual(pickActivePolicies(ps, "U1", "2026-10-15").map((p) => p.id), ["in"]);
  assert.deepEqual(pickActivePolicies(ps, "U1", "2026-10-17").map((p) => p.id).sort(), ["future", "in"]);
  assert.deepEqual(pickActivePolicies(ps, "U1", "2026-10-18").map((p) => p.id), ["future"]);
  assert.equal(pickActivePolicies(ps, "U1", "2026-10-21").length, 0);
});

test("resolvePolicyTimes: none → null", () => {
  assert.equal(resolvePolicyTimes([]), null);
});

test("overlapping policies merge to latest lateUntil and earliest leaveFrom", () => {
  const r = resolved(
    { mode: "lateMorning", lateUntil: "09:00" },
    { mode: "lateMorning", lateUntil: "09:45" },
    { mode: "earlyEvening", lateUntil: null, leaveFrom: "16:00" },
    { mode: "earlyEvening", lateUntil: null, leaveFrom: "15:30" },
  );
  assert.deepEqual(r, {
    lateUntilMin: t("09:45"),
    leaveFromMin: t("15:30"),
    isCustom: false,
    policyId: "p1,p2,p3,p4",
  });
});

test("any custom in the merge → custom behavior", () => {
  const r = resolved(
    { mode: "lateMorning", lateUntil: "09:00" },
    { mode: "custom", lateUntil: "09:30", leaveFrom: "16:00" },
  );
  assert.equal(r?.isCustom, true);
  assert.equal(r?.lateUntilMin, t("09:30"));
  assert.equal(r?.leaveFromMin, t("16:00"));
});

// ---------------------------------------------------------------- lateMorning

test("lateMorning X before 10:00", () => {
  const p = resolved({ lateUntil: "09:30" });
  assert.equal(resolveCheckIn(t("09:30"), "normal", p).status, "present");
  assert.equal(resolveCheckIn(t("09:31"), "normal", p).status, "late");
  assert.equal(resolveCheckIn(t("09:59"), "normal", p).status, "late");
  assert.equal(resolveCheckIn(t("10:00"), "normal", p).status, "not_check_in");
  assert.equal(resolveCheckIn(t("09:30"), "normal", p).policyChoice, undefined);
});

test("lateMorning X after 10:00 → not_check_in starts at X+1", () => {
  const p = resolved({ lateUntil: "10:30" });
  assert.equal(resolveCheckIn(t("10:15"), "normal", p).status, "present");
  assert.equal(resolveCheckIn(t("10:30"), "normal", p).status, "present");
  assert.equal(resolveCheckIn(t("10:31"), "normal", p).status, "not_check_in");
});

test("lateMorning combined with morning leave takes the later cutoff", () => {
  const p = resolved({ lateUntil: "09:30" });
  assert.equal(resolveCheckIn(t("12:30"), "morningLeave", p).status, "present");
  assert.equal(resolveCheckIn(t("13:00"), "morningLeave", p).status, "late");
  assert.equal(resolveCheckIn(t("14:01"), "morningLeave", p).status, "not_check_in");
});

test("lateMorning combined with offsite takes the later cutoff", () => {
  const early = resolved({ lateUntil: "08:30" });
  assert.equal(resolveCheckIn(t("08:45"), "offsite", early).status, "present");
  assert.equal(resolveCheckIn(t("09:00"), "offsite", early).status, "late");
  const late = resolved({ lateUntil: "09:30" });
  assert.equal(resolveCheckIn(t("09:15"), "offsite", late).status, "present");
  assert.equal(resolveCheckIn(t("09:31"), "offsite", late).status, "late");
});

test("earlyEvening policy does not change check-in", () => {
  const p = resolved({ mode: "earlyEvening", lateUntil: null, leaveFrom: "15:30" });
  assert.deepEqual(resolveCheckIn(t("08:30"), "normal", p), { status: "late", needsChoice: false });
});

// ---------------------------------------------------------------- earlyEvening

test("earlyEvening: cutoff is the earlier of normal and Y", () => {
  const p = resolved({ mode: "earlyEvening", lateUntil: null, leaveFrom: "15:30" });
  assert.equal(resolveCheckOutCutoff(CUTOFF_NORMAL, p), t("15:30"));
  assert.equal(resolveCheckOutCutoff(CUTOFF_HOUSEKEEPER, p), t("15:30"));
  assert.equal(resolveCheckOutCutoff(CUTOFF_AFTERNOON_LEAVE, p), t("12:30"));
  const late = resolved({ mode: "earlyEvening", lateUntil: null, leaveFrom: "16:45" });
  assert.equal(resolveCheckOutCutoff(CUTOFF_HOUSEKEEPER, late), t("16:30"));
});

test("earlyEvening: CLive still has no cutoff", () => {
  const p = resolved({ mode: "earlyEvening", lateUntil: null, leaveFrom: "15:30" });
  assert.equal(resolveCheckOutCutoff(null, p), null);
});

test("lateMorning does not change check-out", () => {
  assert.equal(resolveCheckOutCutoff(CUTOFF_NORMAL, resolved({ lateUntil: "09:30" })), CUTOFF_NORMAL);
  assert.equal(resolveCheckOutCutoff(CUTOFF_NORMAL, null), CUTOFF_NORMAL);
});

// ---------------------------------------------------------------- custom

const custom = () => resolved({ mode: "custom", lateUntil: "09:30", leaveFrom: "16:00" });

test("custom: <= 08:15 → present + evening automatically", () => {
  assert.deepEqual(resolveCheckIn(t("08:15"), "normal", custom()), {
    status: "present",
    policyChoice: "evening",
    needsChoice: false,
  });
});

test("custom: in window without a choice → needsChoice", () => {
  assert.equal(resolveCheckIn(t("08:16"), "normal", custom()).needsChoice, true);
  assert.equal(resolveCheckIn(t("09:30"), "normal", custom(), null).needsChoice, true);
});

test("custom: in window with morning → present", () => {
  assert.deepEqual(resolveCheckIn(t("09:00"), "normal", custom(), "morning"), {
    status: "present",
    policyChoice: "morning",
    needsChoice: false,
  });
});

test("custom: in window with evening → late", () => {
  assert.deepEqual(resolveCheckIn(t("09:00"), "normal", custom(), "evening"), {
    status: "late",
    policyChoice: "evening",
    needsChoice: false,
  });
});

test("custom: after X → late, policy not used, client choice ignored", () => {
  assert.deepEqual(resolveCheckIn(t("09:31"), "normal", custom(), "morning"), {
    status: "late",
    needsChoice: false,
  });
  assert.deepEqual(resolveCheckIn(t("09:59"), "normal", custom(), "evening"), {
    status: "late",
    needsChoice: false,
  });
});

test("custom: >= 10:00 → not_check_in, policy not used", () => {
  assert.deepEqual(resolveCheckIn(t("10:00"), "normal", custom()), {
    status: "not_check_in",
    needsChoice: false,
  });
});

test("custom: client sends morning at 07:50 → ignored, evening", () => {
  assert.equal(resolveCheckIn(t("07:50"), "normal", custom(), "morning").policyChoice, "evening");
});

test("custom check-out: morning → normal cutoff, evening → Y", () => {
  assert.equal(resolveCheckOutCutoff(CUTOFF_NORMAL, custom(), "morning"), CUTOFF_NORMAL);
  assert.equal(resolveCheckOutCutoff(CUTOFF_NORMAL, custom(), "evening"), t("16:00"));
  assert.equal(resolveCheckOutCutoff(CUTOFF_HOUSEKEEPER, custom(), "morning"), CUTOFF_HOUSEKEEPER);
  // check-in ຫຼັງ X (ຫຼື ກ່ອນນະໂຍບາຍຖືກສ້າງ) → ບໍ່ມີ choice → ເລີກປົກກະຕິ
  assert.equal(resolveCheckOutCutoff(CUTOFF_NORMAL, custom(), undefined), CUTOFF_NORMAL);
  assert.equal(resolveCheckOutCutoff(null, custom(), "evening"), null);
});
