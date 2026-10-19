"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const special_policy_1 = require("./special-policy");
const t = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
};
const policy = (over) => (Object.assign({ id: "p1", mode: "lateMorning", startDate: "2026-10-15", endDate: "2026-10-17", lateUntil: "09:30", leaveFrom: null, staffUuids: ["U1"], status: "active" }, over));
const resolved = (...ps) => (0, special_policy_1.resolvePolicyTimes)(ps.map((p, i) => policy(Object.assign({ id: `p${i + 1}` }, p))));
const CUTOFF_NORMAL = t("17:00");
const CUTOFF_HOUSEKEEPER = t("16:30");
const CUTOFF_AFTERNOON_LEAVE = t("12:30");
// ---------------------------------------------------------------- base
(0, node_test_1.test)("base thresholds: 10:00 is not_check_in, 09:59 late", () => {
    strict_1.default.equal((0, special_policy_1.computeBaseCheckInStatus)(t("08:15"), "normal"), "present");
    strict_1.default.equal((0, special_policy_1.computeBaseCheckInStatus)(t("08:16"), "normal"), "late");
    strict_1.default.equal((0, special_policy_1.computeBaseCheckInStatus)(t("09:59"), "normal"), "late");
    strict_1.default.equal((0, special_policy_1.computeBaseCheckInStatus)(t("10:00"), "normal"), "not_check_in");
    strict_1.default.equal((0, special_policy_1.computeBaseCheckInStatus)(t("08:59"), "offsite"), "present");
    strict_1.default.equal((0, special_policy_1.computeBaseCheckInStatus)(t("09:00"), "offsite"), "late");
    strict_1.default.equal((0, special_policy_1.computeBaseCheckInStatus)(t("14:00"), "morningLeave"), "late");
    strict_1.default.equal((0, special_policy_1.computeBaseCheckInStatus)(t("14:01"), "morningLeave"), "not_check_in");
});
(0, node_test_1.test)("no policy → base status", () => {
    strict_1.default.deepEqual((0, special_policy_1.resolveCheckIn)(t("09:00"), "normal", null), { status: "late", needsChoice: false });
});
// ---------------------------------------------------------------- picking
(0, node_test_1.test)("pickActivePolicies: date range inclusive, staff only, ignores status delete", () => {
    const ps = [
        policy({ id: "in" }),
        policy({ id: "deleted", status: "delete" }),
        policy({ id: "other-staff", staffUuids: ["U2"] }),
        policy({ id: "past", startDate: "2026-10-01", endDate: "2026-10-14" }),
        policy({ id: "future", startDate: "2026-10-16", endDate: "2026-10-20" }),
    ];
    strict_1.default.deepEqual((0, special_policy_1.pickActivePolicies)(ps, "U1", "2026-10-15").map((p) => p.id), ["in"]);
    strict_1.default.deepEqual((0, special_policy_1.pickActivePolicies)(ps, "U1", "2026-10-17").map((p) => p.id).sort(), ["future", "in"]);
    strict_1.default.deepEqual((0, special_policy_1.pickActivePolicies)(ps, "U1", "2026-10-18").map((p) => p.id), ["future"]);
    strict_1.default.equal((0, special_policy_1.pickActivePolicies)(ps, "U1", "2026-10-21").length, 0);
});
(0, node_test_1.test)("resolvePolicyTimes: none → null", () => {
    strict_1.default.equal((0, special_policy_1.resolvePolicyTimes)([]), null);
});
(0, node_test_1.test)("overlapping policies merge to latest lateUntil and earliest leaveFrom", () => {
    const r = resolved({ mode: "lateMorning", lateUntil: "09:00" }, { mode: "lateMorning", lateUntil: "09:45" }, { mode: "earlyEvening", lateUntil: null, leaveFrom: "16:00" }, { mode: "earlyEvening", lateUntil: null, leaveFrom: "15:30" });
    strict_1.default.deepEqual(r, {
        lateUntilMin: t("09:45"),
        leaveFromMin: t("15:30"),
        isCustom: false,
        policyId: "p1,p2,p3,p4",
    });
});
(0, node_test_1.test)("any custom in the merge → custom behavior", () => {
    const r = resolved({ mode: "lateMorning", lateUntil: "09:00" }, { mode: "custom", lateUntil: "09:30", leaveFrom: "16:00" });
    strict_1.default.equal(r === null || r === void 0 ? void 0 : r.isCustom, true);
    strict_1.default.equal(r === null || r === void 0 ? void 0 : r.lateUntilMin, t("09:30"));
    strict_1.default.equal(r === null || r === void 0 ? void 0 : r.leaveFromMin, t("16:00"));
});
// ---------------------------------------------------------------- lateMorning
(0, node_test_1.test)("lateMorning X before 10:00", () => {
    const p = resolved({ lateUntil: "09:30" });
    strict_1.default.equal((0, special_policy_1.resolveCheckIn)(t("09:30"), "normal", p).status, "present");
    strict_1.default.equal((0, special_policy_1.resolveCheckIn)(t("09:31"), "normal", p).status, "late");
    strict_1.default.equal((0, special_policy_1.resolveCheckIn)(t("09:59"), "normal", p).status, "late");
    strict_1.default.equal((0, special_policy_1.resolveCheckIn)(t("10:00"), "normal", p).status, "not_check_in");
    strict_1.default.equal((0, special_policy_1.resolveCheckIn)(t("09:30"), "normal", p).policyChoice, undefined);
});
(0, node_test_1.test)("lateMorning X after 10:00 → not_check_in starts at X+1", () => {
    const p = resolved({ lateUntil: "10:30" });
    strict_1.default.equal((0, special_policy_1.resolveCheckIn)(t("10:15"), "normal", p).status, "present");
    strict_1.default.equal((0, special_policy_1.resolveCheckIn)(t("10:30"), "normal", p).status, "present");
    strict_1.default.equal((0, special_policy_1.resolveCheckIn)(t("10:31"), "normal", p).status, "not_check_in");
});
(0, node_test_1.test)("lateMorning combined with morning leave takes the later cutoff", () => {
    const p = resolved({ lateUntil: "09:30" });
    strict_1.default.equal((0, special_policy_1.resolveCheckIn)(t("12:30"), "morningLeave", p).status, "present");
    strict_1.default.equal((0, special_policy_1.resolveCheckIn)(t("13:00"), "morningLeave", p).status, "late");
    strict_1.default.equal((0, special_policy_1.resolveCheckIn)(t("14:01"), "morningLeave", p).status, "not_check_in");
});
(0, node_test_1.test)("lateMorning combined with offsite takes the later cutoff", () => {
    const early = resolved({ lateUntil: "08:30" });
    strict_1.default.equal((0, special_policy_1.resolveCheckIn)(t("08:45"), "offsite", early).status, "present");
    strict_1.default.equal((0, special_policy_1.resolveCheckIn)(t("09:00"), "offsite", early).status, "late");
    const late = resolved({ lateUntil: "09:30" });
    strict_1.default.equal((0, special_policy_1.resolveCheckIn)(t("09:15"), "offsite", late).status, "present");
    strict_1.default.equal((0, special_policy_1.resolveCheckIn)(t("09:31"), "offsite", late).status, "late");
});
(0, node_test_1.test)("earlyEvening policy does not change check-in", () => {
    const p = resolved({ mode: "earlyEvening", lateUntil: null, leaveFrom: "15:30" });
    strict_1.default.deepEqual((0, special_policy_1.resolveCheckIn)(t("08:30"), "normal", p), { status: "late", needsChoice: false });
});
// ---------------------------------------------------------------- earlyEvening
(0, node_test_1.test)("earlyEvening: cutoff is the earlier of normal and Y", () => {
    const p = resolved({ mode: "earlyEvening", lateUntil: null, leaveFrom: "15:30" });
    strict_1.default.equal((0, special_policy_1.resolveCheckOutCutoff)(CUTOFF_NORMAL, p), t("15:30"));
    strict_1.default.equal((0, special_policy_1.resolveCheckOutCutoff)(CUTOFF_HOUSEKEEPER, p), t("15:30"));
    strict_1.default.equal((0, special_policy_1.resolveCheckOutCutoff)(CUTOFF_AFTERNOON_LEAVE, p), t("12:30"));
    const late = resolved({ mode: "earlyEvening", lateUntil: null, leaveFrom: "16:45" });
    strict_1.default.equal((0, special_policy_1.resolveCheckOutCutoff)(CUTOFF_HOUSEKEEPER, late), t("16:30"));
});
(0, node_test_1.test)("earlyEvening: CLive still has no cutoff", () => {
    const p = resolved({ mode: "earlyEvening", lateUntil: null, leaveFrom: "15:30" });
    strict_1.default.equal((0, special_policy_1.resolveCheckOutCutoff)(null, p), null);
});
(0, node_test_1.test)("lateMorning does not change check-out", () => {
    strict_1.default.equal((0, special_policy_1.resolveCheckOutCutoff)(CUTOFF_NORMAL, resolved({ lateUntil: "09:30" })), CUTOFF_NORMAL);
    strict_1.default.equal((0, special_policy_1.resolveCheckOutCutoff)(CUTOFF_NORMAL, null), CUTOFF_NORMAL);
});
// ---------------------------------------------------------------- custom
const custom = () => resolved({ mode: "custom", lateUntil: "09:30", leaveFrom: "16:00" });
(0, node_test_1.test)("custom: <= 08:15 → present + evening automatically", () => {
    strict_1.default.deepEqual((0, special_policy_1.resolveCheckIn)(t("08:15"), "normal", custom()), {
        status: "present",
        policyChoice: "evening",
        needsChoice: false,
    });
});
(0, node_test_1.test)("custom: in window without a choice → needsChoice", () => {
    strict_1.default.equal((0, special_policy_1.resolveCheckIn)(t("08:16"), "normal", custom()).needsChoice, true);
    strict_1.default.equal((0, special_policy_1.resolveCheckIn)(t("09:30"), "normal", custom(), null).needsChoice, true);
});
(0, node_test_1.test)("custom: in window with morning → present", () => {
    strict_1.default.deepEqual((0, special_policy_1.resolveCheckIn)(t("09:00"), "normal", custom(), "morning"), {
        status: "present",
        policyChoice: "morning",
        needsChoice: false,
    });
});
(0, node_test_1.test)("custom: in window with evening → late", () => {
    strict_1.default.deepEqual((0, special_policy_1.resolveCheckIn)(t("09:00"), "normal", custom(), "evening"), {
        status: "late",
        policyChoice: "evening",
        needsChoice: false,
    });
});
(0, node_test_1.test)("custom: after X → late, policy not used, client choice ignored", () => {
    strict_1.default.deepEqual((0, special_policy_1.resolveCheckIn)(t("09:31"), "normal", custom(), "morning"), {
        status: "late",
        needsChoice: false,
    });
    strict_1.default.deepEqual((0, special_policy_1.resolveCheckIn)(t("09:59"), "normal", custom(), "evening"), {
        status: "late",
        needsChoice: false,
    });
});
(0, node_test_1.test)("custom: >= 10:00 → not_check_in, policy not used", () => {
    strict_1.default.deepEqual((0, special_policy_1.resolveCheckIn)(t("10:00"), "normal", custom()), {
        status: "not_check_in",
        needsChoice: false,
    });
});
(0, node_test_1.test)("custom: client sends morning at 07:50 → ignored, evening", () => {
    strict_1.default.equal((0, special_policy_1.resolveCheckIn)(t("07:50"), "normal", custom(), "morning").policyChoice, "evening");
});
(0, node_test_1.test)("custom check-out: morning → normal cutoff, evening → Y", () => {
    strict_1.default.equal((0, special_policy_1.resolveCheckOutCutoff)(CUTOFF_NORMAL, custom(), "morning"), CUTOFF_NORMAL);
    strict_1.default.equal((0, special_policy_1.resolveCheckOutCutoff)(CUTOFF_NORMAL, custom(), "evening"), t("16:00"));
    strict_1.default.equal((0, special_policy_1.resolveCheckOutCutoff)(CUTOFF_HOUSEKEEPER, custom(), "morning"), CUTOFF_HOUSEKEEPER);
    // check-in ຫຼັງ X (ຫຼື ກ່ອນນະໂຍບາຍຖືກສ້າງ) → ບໍ່ມີ choice → ເລີກປົກກະຕິ
    strict_1.default.equal((0, special_policy_1.resolveCheckOutCutoff)(CUTOFF_NORMAL, custom(), undefined), CUTOFF_NORMAL);
    strict_1.default.equal((0, special_policy_1.resolveCheckOutCutoff)(null, custom(), "evening"), null);
});
//# sourceMappingURL=special-policy.test.js.map