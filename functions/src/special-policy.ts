// ນະໂຍບາຍພິເສດ (specialPolicy) — ກົດການເລື່ອນເວລາເຂົ້າ/ອອກວຽກ. Pure — ບໍ່ມີ Firestore,
// ບໍ່ມີ initializeApp — ເພື່ອໃຫ້ special-policy.test.ts import ໄດ້. recordCheckIn /
// recordCheckOut ໃນ index.ts ເຮັດ I/O. Client mirror: lib/special-policy.ts (ແກ້ໃຫ້ກົງກັນ).
//
// ຂໍ້ມູນສ້າງຈາກ admin (../HRM-System-SSMI services/specialPolicy.ts):
//   lateMorning  — check-in <= lateUntil ນັບຕົງເວລາ
//   earlyEvening — check-out >= leaveFrom ບໍ່ຖືວ່າອອກກ່ອນເວລາ
//   custom       — ມີທັງສອງ ແຕ່ 1 ມື້ໃຊ້ໄດ້ອັນດຽວ (policyChoice "morning" | "evening")

export type SpecialPolicyMode = "lateMorning" | "earlyEvening" | "custom";
export type PolicyChoice = "morning" | "evening";
export type CheckInStatus = "present" | "late" | "not_check_in";

// normal: ທັນ <= 08:15 · offsite: ທັນ < 09:00 · morningLeave: ລາພັກເຄິ່ງເຊົ້າ ທັນ <= 12:30
export type CheckInBaseCase = "normal" | "offsite" | "morningLeave";

export type SpecialPolicyLike = {
  id: string;
  mode?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  lateUntil?: string | null; // HH:mm
  leaveFrom?: string | null; // HH:mm
  staffUuids?: string[];
  status?: string;
};

export type ResolvedPolicy = {
  lateUntilMin?: number;
  leaveFromMin?: number;
  isCustom: boolean;
  // ຫຼາຍນະໂຍບາຍທັບກັນ → id ທັງໝົດ ຄັ່ນດ້ວຍ ","
  policyId: string;
};

export function hhmmToMinutes(value: string | null | undefined): number | undefined {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return undefined;
  const [h, m] = value.split(":").map(Number);
  if (h > 23 || m > 59) return undefined;
  return h * 60 + m;
}

export function minutesToHhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// ນະໂຍບາຍທີ່ຄຸ້ມ uid ໃນວັນ isoDate (ລວມວັນເລີ່ມ ແລະ ວັນສິ້ນສຸດ). status "delete" = ລຶບແລ້ວ (soft delete)
export function pickActivePolicies<T extends SpecialPolicyLike>(
  policies: T[],
  uid: string,
  isoDate: string,
): T[] {
  return policies.filter(
    (p) =>
      p.status !== "delete" &&
      !!p.startDate &&
      !!p.endDate &&
      p.startDate <= isoDate &&
      isoDate <= p.endDate &&
      (p.staffUuids ?? []).includes(uid),
  );
}

// ລວມຫຼາຍນະໂຍບາຍເປັນອັນດຽວ ເອົາອັນທີ່ຜ່ອນຜັນທີ່ສຸດ: lateUntil ຊ້າສຸດ, leaveFrom ໄວສຸດ.
// ມີ custom ຢູ່ໃນນັ້ນ → ໃຊ້ກົດ custom (1 ມື້ເລືອກໄດ້ອັນດຽວ). ບໍ່ມີ → null
export function resolvePolicyTimes(policies: SpecialPolicyLike[]): ResolvedPolicy | null {
  if (policies.length === 0) return null;
  let lateUntilMin: number | undefined;
  let leaveFromMin: number | undefined;
  for (const p of policies) {
    const late = p.mode === "earlyEvening" ? undefined : hhmmToMinutes(p.lateUntil);
    const leave = p.mode === "lateMorning" ? undefined : hhmmToMinutes(p.leaveFrom);
    if (late != null && (lateUntilMin == null || late > lateUntilMin)) lateUntilMin = late;
    if (leave != null && (leaveFromMin == null || leave < leaveFromMin)) leaveFromMin = leave;
  }
  if (lateUntilMin == null && leaveFromMin == null) return null;
  return {
    ...(lateUntilMin != null ? { lateUntilMin } : {}),
    ...(leaveFromMin != null ? { leaveFromMin } : {}),
    isCustom: policies.some((p) => p.mode === "custom"),
    policyId: policies.map((p) => p.id).sort().join(","),
  };
}

// ເສັ້ນຕັດປົກກະຕິ (ບໍ່ມີນະໂຍບາຍ): presentUntil = ນາທີສຸດທ້າຍທີ່ຍັງນັບທັນ,
// notCheckInFrom = ນາທີທຳອິດທີ່ນັບ "ບໍ່ check-in"
export function baseCheckInThresholds(baseCase: CheckInBaseCase): {
  presentUntil: number;
  notCheckInFrom: number;
} {
  if (baseCase === "morningLeave") return { presentUntil: 12 * 60 + 30, notCheckInFrom: 14 * 60 + 1 };
  if (baseCase === "offsite") return { presentUntil: 9 * 60 - 1, notCheckInFrom: 10 * 60 };
  return { presentUntil: 8 * 60 + 15, notCheckInFrom: 10 * 60 };
}

function statusFor(nowMin: number, presentUntil: number, notCheckInFrom: number): CheckInStatus {
  if (nowMin <= presentUntil) return "present";
  if (nowMin < notCheckInFrom) return "late";
  return "not_check_in";
}

export function computeBaseCheckInStatus(nowMin: number, baseCase: CheckInBaseCase): CheckInStatus {
  const { presentUntil, notCheckInFrom } = baseCheckInThresholds(baseCase);
  return statusFor(nowMin, presentUntil, notCheckInFrom);
}

// ຊ່ວງທີ່ custom ຕ້ອງໃຫ້ພະນັກງານເລືອກ: ຫຼັງເສັ້ນ "ທັນ" ປົກກະຕິ ຮອດ lateUntil
export function isInCustomChoiceWindow(
  nowMin: number,
  baseCase: CheckInBaseCase,
  policy: ResolvedPolicy | null,
): boolean {
  if (!policy?.isCustom || policy.lateUntilMin == null) return false;
  const { presentUntil } = baseCheckInThresholds(baseCase);
  return nowMin > presentUntil && nowMin <= policy.lateUntilMin;
}

// status ຂອງ check-in ເມື່ອມີນະໂຍບາຍ. clientChoice ໃຊ້ສະເພາະໃນຊ່ວງເລືອກຂອງ custom —
// ນອກຊ່ວງນັ້ນ server ຕັດສິນເອງ ແລະ ບໍ່ສົນຄ່າທີ່ client ສົ່ງມາ.
// needsChoice = true → ຢູ່ໃນຊ່ວງເລືອກ ແຕ່ client ບໍ່ໄດ້ສົ່ງ choice (status ທີ່ສົ່ງກັບຢ່າໃຊ້ບັນທຶກ)
export function resolveCheckIn(
  nowMin: number,
  baseCase: CheckInBaseCase,
  policy: ResolvedPolicy | null,
  clientChoice?: PolicyChoice | null,
): { status: CheckInStatus; policyChoice?: PolicyChoice; needsChoice: boolean } {
  const base = baseCheckInThresholds(baseCase);
  const baseStatus = statusFor(nowMin, base.presentUntil, base.notCheckInFrom);

  if (!policy) return { status: baseStatus, needsChoice: false };

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

  if (policy.lateUntilMin == null) return { status: baseStatus, needsChoice: false };

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
export function resolveCheckOutCutoff(
  baseCutoffMin: number | null,
  policy: ResolvedPolicy | null,
  storedPolicyChoice?: PolicyChoice | null,
): number | null {
  if (baseCutoffMin == null) return null;
  if (!policy || policy.leaveFromMin == null) return baseCutoffMin;
  if (policy.isCustom && storedPolicyChoice !== "evening") return baseCutoffMin;
  return Math.min(baseCutoffMin, policy.leaveFromMin);
}
