// ແບບຟອມ / ແບບສອບຖາມ (forms collection, ສ້າງຈາກ admin: ../HRM-System-SSMI services/forms.ts).
// Pure — ບໍ່ມີ Firestore, ບໍ່ມີ initializeApp — ເພື່ອໃຫ້ forms.test.ts import ໄດ້. listMyForms /
// getMyForm / submitFormResponse ໃນ index.ts ເຮັດ I/O.
//
// ກຸ່ມເປົ້າໝາຍ: admin ຄິດ form.audienceKeys ໄວ້ລ່ວງໜ້າ (buildFormAudienceKeys ໃນ admin — ແກ້ໃຫ້ກົງກັນ):
//   "all"            — ທົ່ວລະບົບ
//   "g:{b}:{d}:{s}"  — ສາຂາ ∩ ພະແນກ ∩ ສະຖານະພະນັກງານ ("*" = ບໍ່ກອງ)
//   "emp:{uid}"      — ລາຍບຸກຄົນ
// ພະນັກງານມີສິດຕອບ ຖ້າ key ຂອງຕົນ (employeeAudienceKeys, ຄິດຈາກຂໍ້ມູນປັດຈຸບັນ) ກົງກັບ key ໃດໜຶ່ງ.

import { HttpsError } from "firebase-functions/v2/https";

export type FormQuestionType =
  | "shortText"
  | "longText"
  | "radio"
  | "checkbox"
  | "dropdown"
  | "rating";

export type FormOption = { id: string; label: string };

export type FormQuestion = {
  id: string;
  type: FormQuestionType;
  title: string;
  description?: string;
  required: boolean;
  options?: FormOption[];
  ratingMax?: number;
};

export type FormSection = {
  id: string;
  title: string;
  description?: string;
  questions: FormQuestion[];
};

export type FormAnswer = string | string[] | number;
export type FormAnswers = Record<string, FormAnswer>;

export type AudienceEmployee = {
  uid: string;
  workLocationUuid?: string;
  departmentUuid?: string;
  employmentStatus?: string;
};

export const SHORT_TEXT_MAX = 500;
export const LONG_TEXT_MAX = 5000;
export const DEFAULT_RATING_MAX = 5;

// 1 + 1 + 2×2×2 = 10 key — ຕ່ຳກວ່າຂີດ 30 ຄ່າຂອງ array-contains-any
export function employeeAudienceKeys(emp: AudienceEmployee): string[] {
  const withWildcard = (value?: string) => (value ? [value, "*"] : ["*"]);
  const keys = ["all", `emp:${emp.uid}`];
  for (const b of withWildcard(emp.workLocationUuid)) {
    for (const d of withWildcard(emp.departmentUuid)) {
      for (const s of withWildcard(emp.employmentStatus)) {
        keys.push(`g:${b}:${d}:${s}`);
      }
    }
  }
  return keys;
}

export function isInAudience(formKeys: unknown, emp: AudienceEmployee): boolean {
  if (!Array.isArray(formKeys)) return false;
  const mine = new Set(employeeAudienceKeys(emp));
  return formKeys.some((k) => typeof k === "string" && mine.has(k));
}

export function questionsOf(sections: FormSection[]): FormQuestion[] {
  return sections.flatMap((s) => (Array.isArray(s.questions) ? s.questions : []));
}

function optionIds(q: FormQuestion): Set<string> {
  return new Set((q.options ?? []).map((o) => o.id));
}

function invalid(q: FormQuestion, reason: string): never {
  throw new HttpsError("invalid-argument", `ຄຳຖາມ "${q.title}": ${reason}`);
}

// ---------- Quiz ----------
// ເສີຍເກັບແຍກຢູ່ forms/{id}/private/answerKey (admin ອ່ານໄດ້ຢ່າງດຽວ). ກວດສະເພາະ choice type;
// checkbox ຕ້ອງເລືອກຄົບ ແລະ ບໍ່ເກີນ (ກົງກັນທັງຊຸດ) ຈຶ່ງໄດ້ຄະແນນ.
// admin ມີສຳເນົາ gradeAnswers (services/forms.ts) ສຳລັບໜ້າຜົນ — ແກ້ໃຫ້ກົງກັນ.

export type ShowResult = "none" | "score" | "scoreAndAnswers";

export type AnswerKeyEntry = { correct: string[]; points: number };
export type AnswerKey = Record<string, AnswerKeyEntry>;

export type QuestionResult = { correct: boolean; earned: number; points: number };
export type QuizScore = { earned: number; total: number; results: Record<string, QuestionResult> };

export const isChoiceType = (type: FormQuestionType) =>
  type === "radio" || type === "checkbox" || type === "dropdown";

export function toShowResult(value: unknown): ShowResult {
  return value === "score" || value === "scoreAndAnswers" ? value : "none";
}

export function gradeAnswers(
  sections: FormSection[],
  answers: FormAnswers,
  key: AnswerKey,
): QuizScore {
  const results: Record<string, QuestionResult> = {};
  let earned = 0;
  let total = 0;
  for (const q of questionsOf(sections)) {
    const entry = key[q.id];
    if (!entry || !isChoiceType(q.type)) continue;
    const points = Math.max(0, Number(entry.points) || 0);
    const correctIds = new Set(Array.isArray(entry.correct) ? entry.correct : []);
    const value = answers[q.id];
    const given = new Set(Array.isArray(value) ? value : value === undefined ? [] : [String(value)]);
    const correct =
      correctIds.size > 0 &&
      given.size === correctIds.size &&
      [...given].every((id) => correctIds.has(id));
    const got = correct ? points : 0;
    results[q.id] = { correct, earned: got, points };
    earned += got;
    total += points;
  }
  return { earned, total, results };
}

// ຄືນຄຳຕອບທີ່ສະອາດແລ້ວ (ຕັດ id ທີ່ບໍ່ມີໃນຟອມ ແລະ ຄຳຕອບຫວ່າງອອກ) ຫຼື throw invalid-argument
export function validateAnswers(sections: FormSection[], raw: unknown): FormAnswers {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new HttpsError("invalid-argument", "ຮູບແບບຄຳຕອບບໍ່ຖືກຕ້ອງ");
  }
  const input = raw as Record<string, unknown>;
  const result: FormAnswers = {};

  for (const q of questionsOf(sections)) {
    const value = input[q.id];
    let clean: FormAnswer | undefined;

    switch (q.type) {
      case "shortText":
      case "longText": {
        if (value != null && typeof value !== "string") invalid(q, "ຕ້ອງເປັນຂໍ້ຄວາມ");
        const text = (value ?? "").trim();
        const max = q.type === "shortText" ? SHORT_TEXT_MAX : LONG_TEXT_MAX;
        if (text.length > max) invalid(q, `ຍາວເກີນ ${max} ຕົວອັກສອນ`);
        if (text) clean = text;
        break;
      }
      case "radio":
      case "dropdown": {
        if (value == null || value === "") break;
        if (typeof value !== "string" || !optionIds(q).has(value)) invalid(q, "ຕົວເລືອກບໍ່ຖືກຕ້ອງ");
        clean = value;
        break;
      }
      case "checkbox": {
        if (value == null) break;
        if (!Array.isArray(value)) invalid(q, "ຮູບແບບຄຳຕອບບໍ່ຖືກຕ້ອງ");
        const ids = optionIds(q);
        const picked = [...new Set(value)];
        if (picked.some((v) => typeof v !== "string" || !ids.has(v))) invalid(q, "ຕົວເລືອກບໍ່ຖືກຕ້ອງ");
        if (picked.length > 0) clean = picked as string[];
        break;
      }
      case "rating": {
        if (value == null || value === "") break;
        const max = q.ratingMax ?? DEFAULT_RATING_MAX;
        if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > max) {
          invalid(q, `ຄະແນນຕ້ອງຢູ່ລະຫວ່າງ 1–${max}`);
        }
        clean = value;
        break;
      }
    }

    if (clean === undefined) {
      if (q.required) invalid(q, "ກະລຸນາຕອບຄຳຖາມນີ້");
      continue;
    }
    result[q.id] = clean;
  }

  return result;
}
