"use strict";
// ແບບຟອມ / ແບບສອບຖາມ (forms collection, ສ້າງຈາກ admin: ../HRM-System-SSMI services/forms.ts).
// Pure — ບໍ່ມີ Firestore, ບໍ່ມີ initializeApp — ເພື່ອໃຫ້ forms.test.ts import ໄດ້. listMyForms /
// getMyForm / submitFormResponse ໃນ index.ts ເຮັດ I/O.
//
// ກຸ່ມເປົ້າໝາຍ: admin ຄິດ form.audienceKeys ໄວ້ລ່ວງໜ້າ (buildFormAudienceKeys ໃນ admin — ແກ້ໃຫ້ກົງກັນ):
//   "all"            — ທົ່ວລະບົບ
//   "g:{b}:{d}:{s}"  — ສາຂາ ∩ ພະແນກ ∩ ສະຖານະພະນັກງານ ("*" = ບໍ່ກອງ)
//   "emp:{uid}"      — ລາຍບຸກຄົນ
// ພະນັກງານມີສິດຕອບ ຖ້າ key ຂອງຕົນ (employeeAudienceKeys, ຄິດຈາກຂໍ້ມູນປັດຈຸບັນ) ກົງກັບ key ໃດໜຶ່ງ.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isChoiceType = exports.DEFAULT_RATING_MAX = exports.LONG_TEXT_MAX = exports.SHORT_TEXT_MAX = void 0;
exports.employeeAudienceKeys = employeeAudienceKeys;
exports.isInAudience = isInAudience;
exports.questionsOf = questionsOf;
exports.toShowResult = toShowResult;
exports.gradeAnswers = gradeAnswers;
exports.validateAnswers = validateAnswers;
const https_1 = require("firebase-functions/v2/https");
exports.SHORT_TEXT_MAX = 500;
exports.LONG_TEXT_MAX = 5000;
exports.DEFAULT_RATING_MAX = 5;
// 1 + 1 + 2×2×2 = 10 key — ຕ່ຳກວ່າຂີດ 30 ຄ່າຂອງ array-contains-any
function employeeAudienceKeys(emp) {
    const withWildcard = (value) => (value ? [value, "*"] : ["*"]);
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
function isInAudience(formKeys, emp) {
    if (!Array.isArray(formKeys))
        return false;
    const mine = new Set(employeeAudienceKeys(emp));
    return formKeys.some((k) => typeof k === "string" && mine.has(k));
}
function questionsOf(sections) {
    return sections.flatMap((s) => (Array.isArray(s.questions) ? s.questions : []));
}
function optionIds(q) {
    var _a;
    return new Set(((_a = q.options) !== null && _a !== void 0 ? _a : []).map((o) => o.id));
}
function invalid(q, reason) {
    throw new https_1.HttpsError("invalid-argument", `ຄຳຖາມ "${q.title}": ${reason}`);
}
const isChoiceType = (type) => type === "radio" || type === "checkbox" || type === "dropdown";
exports.isChoiceType = isChoiceType;
function toShowResult(value) {
    return value === "score" || value === "scoreAndAnswers" ? value : "none";
}
function gradeAnswers(sections, answers, key) {
    const results = {};
    let earned = 0;
    let total = 0;
    for (const q of questionsOf(sections)) {
        const entry = key[q.id];
        if (!entry || !(0, exports.isChoiceType)(q.type))
            continue;
        const points = Math.max(0, Number(entry.points) || 0);
        const correctIds = new Set(Array.isArray(entry.correct) ? entry.correct : []);
        const value = answers[q.id];
        const given = new Set(Array.isArray(value) ? value : value === undefined ? [] : [String(value)]);
        const correct = correctIds.size > 0 &&
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
function validateAnswers(sections, raw) {
    var _a;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new https_1.HttpsError("invalid-argument", "ຮູບແບບຄຳຕອບບໍ່ຖືກຕ້ອງ");
    }
    const input = raw;
    const result = {};
    for (const q of questionsOf(sections)) {
        const value = input[q.id];
        let clean;
        switch (q.type) {
            case "shortText":
            case "longText": {
                if (value != null && typeof value !== "string")
                    invalid(q, "ຕ້ອງເປັນຂໍ້ຄວາມ");
                const text = (value !== null && value !== void 0 ? value : "").trim();
                const max = q.type === "shortText" ? exports.SHORT_TEXT_MAX : exports.LONG_TEXT_MAX;
                if (text.length > max)
                    invalid(q, `ຍາວເກີນ ${max} ຕົວອັກສອນ`);
                if (text)
                    clean = text;
                break;
            }
            case "radio":
            case "dropdown": {
                if (value == null || value === "")
                    break;
                if (typeof value !== "string" || !optionIds(q).has(value))
                    invalid(q, "ຕົວເລືອກບໍ່ຖືກຕ້ອງ");
                clean = value;
                break;
            }
            case "checkbox": {
                if (value == null)
                    break;
                if (!Array.isArray(value))
                    invalid(q, "ຮູບແບບຄຳຕອບບໍ່ຖືກຕ້ອງ");
                const ids = optionIds(q);
                const picked = [...new Set(value)];
                if (picked.some((v) => typeof v !== "string" || !ids.has(v)))
                    invalid(q, "ຕົວເລືອກບໍ່ຖືກຕ້ອງ");
                if (picked.length > 0)
                    clean = picked;
                break;
            }
            case "rating": {
                if (value == null || value === "")
                    break;
                const max = (_a = q.ratingMax) !== null && _a !== void 0 ? _a : exports.DEFAULT_RATING_MAX;
                if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > max) {
                    invalid(q, `ຄະແນນຕ້ອງຢູ່ລະຫວ່າງ 1–${max}`);
                }
                clean = value;
                break;
            }
        }
        if (clean === undefined) {
            if (q.required)
                invalid(q, "ກະລຸນາຕອບຄຳຖາມນີ້");
            continue;
        }
        result[q.id] = clean;
    }
    return result;
}
//# sourceMappingURL=forms.js.map