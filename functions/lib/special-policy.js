"use strict";
// ນະໂຍບາຍພິເສດ (specialPolicy) — ກົດການເລື່ອນເວລາເຂົ້າ/ອອກວຽກ. Pure — ບໍ່ມີ Firestore,
// ບໍ່ມີ initializeApp — ເພື່ອໃຫ້ special-policy.test.ts import ໄດ້. recordCheckIn /
// recordCheckOut ໃນ index.ts ເຮັດ I/O. Client mirror: lib/special-policy.ts (ແກ້ໃຫ້ກົງກັນ).
//
// ຂໍ້ມູນສ້າງຈາກ admin (../HRM-System-SSMI services/specialPolicy.ts):
//   lateMorning  — check-in <= lateUntil ນັບຕົງເວລາ
//   earlyEvening — check-out >= leaveFrom ບໍ່ຖືວ່າອອກກ່ອນເວລາ
//   custom       — ມີທັງສອງ ແຕ່ 1 ມື້ໃຊ້ໄດ້ອັນດຽວ (policyChoice "morning" | "evening")
Object.defineProperty(exports, "__esModule", { value: true });
exports.hhmmToMinutes = hhmmToMinutes;
exports.minutesToHhmm = minutesToHhmm;
exports.pickActivePolicies = pickActivePolicies;
exports.resolvePolicyTimes = resolvePolicyTimes;
exports.baseCheckInThresholds = baseCheckInThresholds;
exports.computeBaseCheckInStatus = computeBaseCheckInStatus;
exports.isInCustomChoiceWindow = isInCustomChoiceWindow;
exports.resolveCheckIn = resolveCheckIn;
exports.resolveCheckOutCutoff = resolveCheckOutCutoff;
function hhmmToMinutes(value) {
    if (!value || !/^\d{2}:\d{2}$/.test(value))
        return undefined;
    const [h, m] = value.split(":").map(Number);
    if (h > 23 || m > 59)
        return undefined;
    return h * 60 + m;
}
function minutesToHhmm(minutes) {
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
// ນະໂຍບາຍທີ່ຄຸ້ມ uid ໃນວັນ isoDate (ລວມວັນເລີ່ມ ແລະ ວັນສິ້ນສຸດ). status "delete" = ລຶບແລ້ວ (soft delete)
function pickActivePolicies(policies, uid, isoDate) {
    return policies.filter((p) => {
        var _a;
        return p.status !== "delete" &&
            !!p.startDate &&
            !!p.endDate &&
            p.startDate <= isoDate &&
            isoDate <= p.endDate &&
            ((_a = p.staffUuids) !== null && _a !== void 0 ? _a : []).includes(uid);
    });
}
// ລວມຫຼາຍນະໂຍບາຍເປັນອັນດຽວ ເອົາອັນທີ່ຜ່ອນຜັນທີ່ສຸດ: lateUntil ຊ້າສຸດ, leaveFrom ໄວສຸດ.
// ມີ custom ຢູ່ໃນນັ້ນ → ໃຊ້ກົດ custom (1 ມື້ເລືອກໄດ້ອັນດຽວ). ບໍ່ມີ → null
function resolvePolicyTimes(policies) {
    if (policies.length === 0)
        return null;
    let lateUntilMin;
    let leaveFromMin;
    for (const p of policies) {
        const late = p.mode === "earlyEvening" ? undefined : hhmmToMinutes(p.lateUntil);
        const leave = p.mode === "lateMorning" ? undefined : hhmmToMinutes(p.leaveFrom);
        if (late != null && (lateUntilMin == null || late > lateUntilMin))
            lateUntilMin = late;
        if (leave != null && (leaveFromMin == null || leave < leaveFromMin))
            leaveFromMin = leave;
    }
    if (lateUntilMin == null && leaveFromMin == null)
        return null;
    return Object.assign(Object.assign(Object.assign({}, (lateUntilMin != null ? { lateUntilMin } : {})), (leaveFromMin != null ? { leaveFromMin } : {})), { isCustom: policies.some((p) => p.mode === "custom"), policyId: policies.map((p) => p.id).sort().join(",") });
}
// ເສັ້ນຕັດປົກກະຕິ (ບໍ່ມີນະໂຍບາຍ): presentUntil = ນາທີສຸດທ້າຍທີ່ຍັງນັບທັນ,
// notCheckInFrom = ນາທີທຳອິດທີ່ນັບ "ບໍ່ check-in"
function baseCheckInThresholds(baseCase) {
    if (baseCase === "morningLeave")
        return { presentUntil: 12 * 60 + 30, notCheckInFrom: 14 * 60 + 1 };
    if (baseCase === "offsite")
        return { presentUntil: 9 * 60 - 1, notCheckInFrom: 10 * 60 };
    return { presentUntil: 8 * 60 + 15, notCheckInFrom: 10 * 60 };
}
function statusFor(nowMin, presentUntil, notCheckInFrom) {
    if (nowMin <= presentUntil)
        return "present";
    if (nowMin < notCheckInFrom)
        return "late";
    return "not_check_in";
}
function computeBaseCheckInStatus(nowMin, baseCase) {
    const { presentUntil, notCheckInFrom } = baseCheckInThresholds(baseCase);
    return statusFor(nowMin, presentUntil, notCheckInFrom);
}
// ຊ່ວງທີ່ custom ຕ້ອງໃຫ້ພະນັກງານເລືອກ: ຫຼັງເສັ້ນ "ທັນ" ປົກກະຕິ ຮອດ lateUntil
function isInCustomChoiceWindow(nowMin, baseCase, policy) {
    if (!(policy === null || policy === void 0 ? void 0 : policy.isCustom) || policy.lateUntilMin == null)
        return false;
    const { presentUntil } = baseCheckInThresholds(baseCase);
    return nowMin > presentUntil && nowMin <= policy.lateUntilMin;
}
// status ຂອງ check-in ເມື່ອມີນະໂຍບາຍ. clientChoice ໃຊ້ສະເພາະໃນຊ່ວງເລືອກຂອງ custom —
// ນອກຊ່ວງນັ້ນ server ຕັດສິນເອງ ແລະ ບໍ່ສົນຄ່າທີ່ client ສົ່ງມາ.
// needsChoice = true → ຢູ່ໃນຊ່ວງເລືອກ ແຕ່ client ບໍ່ໄດ້ສົ່ງ choice (status ທີ່ສົ່ງກັບຢ່າໃຊ້ບັນທຶກ)
function resolveCheckIn(nowMin, baseCase, policy, clientChoice) {
    const base = baseCheckInThresholds(baseCase);
    const baseStatus = statusFor(nowMin, base.presentUntil, base.notCheckInFrom);
    if (!policy)
        return { status: baseStatus, needsChoice: false };
    if (policy.isCustom) {
        if (isInCustomChoiceWindow(nowMin, baseCase, policy)) {
            if (clientChoice === "morning") {
                return { status: "present", policyChoice: "morning", needsChoice: false };
            }
            if (clientChoice === "evening") {
                return { status: baseStatus, policyChoice: "evening", needsChoice: false };
            }
            return { status: baseStatus, needsChoice: true };
        }
        // ທັນເວລາປົກກະຕິ → ໄດ້ກັບກ່ອນຕອນແລງອັດຕະໂນມັດ
        if (nowMin <= base.presentUntil) {
            return { status: baseStatus, policyChoice: "evening", needsChoice: false };
        }
        // ຫຼັງ lateUntil → ບໍ່ໄດ້ໃຊ້ນະໂຍບາຍມື້ນີ້: ນັບຕາມປົກກະຕິ, ເລີກຕາມເວລາປົກກະຕິ
        return { status: baseStatus, needsChoice: false };
    }
    if (policy.lateUntilMin == null)
        return { status: baseStatus, needsChoice: false };
    // lateMorning: ເອົາເສັ້ນຕັດທີ່ຊ້າກວ່າ ລະຫວ່າງ lateUntil ກັບກໍລະນີປົກກະຕິ (ລາເຄິ່ງເຊົ້າ / offsite).
    // lateUntil ຫຼັງ 10:00 → "ບໍ່ check-in" ເລີ່ມ lateUntil + 1 ນາທີ
    const presentUntil = Math.max(base.presentUntil, policy.lateUntilMin);
    const notCheckInFrom = Math.max(base.notCheckInFrom, policy.lateUntilMin + 1);
    return { status: statusFor(nowMin, presentUntil, notCheckInFrom), needsChoice: false };
}
// ເວລາເລີກ (ນາທີ) ທີ່ check-out ກ່ອນນັ້ນຖືວ່າອອກກ່ອນເວລາ. null = ບໍ່ມີເວລາເລີກ (CLive).
// ເອົາອັນທີ່ໄວກວ່າ ລະຫວ່າງເວລາເລີກປົກກະຕິ ກັບ leaveFrom. custom ໄດ້ leaveFrom ສະເພາະເມື່ອ
// policyChoice ທີ່ບັນທຶກແມ່ນ "evening" — "morning" ຫຼື ບໍ່ມີ choice (check-in ຫຼັງ lateUntil
// ຫຼື ກ່ອນນະໂຍບາຍຖືກສ້າງ) ໃຊ້ເວລາປົກກະຕິ.
function resolveCheckOutCutoff(baseCutoffMin, policy, storedPolicyChoice) {
    if (baseCutoffMin == null)
        return null;
    if (!policy || policy.leaveFromMin == null)
        return baseCutoffMin;
    if (policy.isCustom && storedPolicyChoice !== "evening")
        return baseCutoffMin;
    return Math.min(baseCutoffMin, policy.leaveFromMin);
}
//# sourceMappingURL=special-policy.js.map