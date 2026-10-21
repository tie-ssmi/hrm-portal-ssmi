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
exports.branchingQuestionOf = exports.SUBMIT_TARGET = exports.drawGroupKey = exports.OWN_GROUP = exports.isChoiceType = exports.DEFAULT_RATING_MAX = exports.LONG_TEXT_MAX = exports.SHORT_TEXT_MAX = void 0;
exports.effectiveFormStatus = effectiveFormStatus;
exports.employeeAudienceKeys = employeeAudienceKeys;
exports.isInAudience = isInAudience;
exports.questionsOf = questionsOf;
exports.toShowResult = toShowResult;
exports.gradeAnswers = gradeAnswers;
exports.seededShuffle = seededShuffle;
exports.shuffleSectionsFor = shuffleSectionsFor;
exports.toDrawSettings = toDrawSettings;
exports.drawSize = drawSize;
exports.drawQuestionIds = drawQuestionIds;
exports.filterSections = filterSections;
exports.nextSectionIndex = nextSectionIndex;
exports.visitedSections = visitedSections;
exports.validateAnswers = validateAnswers;
const https_1 = require("firebase-functions/v2/https");
const reached = (iso, now) => {
    if (!iso)
        return false;
    const t = new Date(iso).getTime();
    return !Number.isNaN(t) && now.getTime() >= t;
};
function effectiveFormStatus(status, schedule, now) {
    if (status === "closed")
        return "closed";
    if (status !== "open" && status !== "scheduled")
        return "draft";
    if (status === "scheduled" && (schedule === null || schedule === void 0 ? void 0 : schedule.openAt) && !reached(schedule.openAt, now))
        return "scheduled";
    if (reached(schedule === null || schedule === void 0 ? void 0 : schedule.closeAt, now))
        return "closed";
    return "open";
}
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
// ---------- ສຸ່ມລຳດັບ ----------
// seed ຈາກ formId + uid → ຄົນດຽວກັນໄດ້ລຳດັບເດີມທຸກຄັ້ງ (reload ບໍ່ປ່ຽນ) ໂດຍບໍ່ຕ້ອງເກັບໄວ້ໃສ.
// ຄຳຕອບອ້າງ id ຈຶ່ງບໍ່ກະທົບການກວດ/ຄິດຄະແນນ.
// FNV-1a 32-bit
function hashSeed(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}
// mulberry32
function seededRandom(seed) {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function seededShuffle(items, seedText) {
    const random = seededRandom(hashSeed(seedText));
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
function shuffleSectionsFor(sections, seedText, options) {
    if (!options.questions && !options.choices)
        return sections;
    return sections.map((s) => {
        var _a, _b;
        const questions = options.questions
            ? seededShuffle((_a = s.questions) !== null && _a !== void 0 ? _a : [], `${seedText}:${s.id}`)
            : ((_b = s.questions) !== null && _b !== void 0 ? _b : []);
        return Object.assign(Object.assign({}, s), { questions: questions.map((q) => options.choices && (0, exports.isChoiceType)(q.type) && q.options
                ? Object.assign(Object.assign({}, q), { options: seededShuffle(q.options, `${seedText}:${q.id}`) }) : q) });
    });
}
// ---------- ສຸ່ມຄຳຖາມແຍກແຕ່ລະຄົນ ----------
// ຟອມເກັບຄຳຖາມທັງໝົດເປັນ pool; settings.draw.perGroup ບອກວ່າແຕ່ລະຄົນໄດ້ຈັກຂໍ້ຈາກແຕ່ລະກຸ່ມ
// (ກຸ່ມ = ຄັງທີ່ສຳເນົາມາ, ຄຳຖາມທີ່ສ້າງໃນຟອມເອງ = OWN_GROUP). ຂໍ້ທີ່ຖືກແຈກໜ້ອຍສຸດໄດ້ກ່ອນ →
// pool N ຂໍ້ ແຈກຄົນລະ n: floor(N/n) ຄົນທຳອິດໄດ້ຄຳຖາມບໍ່ຊ້ຳກັນເລີຍ, ຫຼັງຈາກນັ້ນວົນແບບສະເໝີກັນ.
// admin ມີສຳເນົາ drawGroupKey (services/forms.ts) — ແກ້ໃຫ້ກົງກັນ.
exports.OWN_GROUP = "_form";
const drawGroupKey = (q) => { var _a, _b; return (_b = (_a = q.source) === null || _a === void 0 ? void 0 : _a.bankId) !== null && _b !== void 0 ? _b : exports.OWN_GROUP; };
exports.drawGroupKey = drawGroupKey;
function toDrawSettings(raw) {
    const d = (raw !== null && raw !== void 0 ? raw : {});
    const perGroup = {};
    if (d.perGroup && typeof d.perGroup === "object") {
        for (const [key, value] of Object.entries(d.perGroup)) {
            const n = Math.floor(Number(value));
            if (n > 0)
                perGroup[key] = n;
        }
    }
    return { enabled: d.enabled === true && Object.keys(perGroup).length > 0, perGroup };
}
// ຈຳນວນຂໍ້ທີ່ແຕ່ລະຄົນໄດ້ຈິງ (ບໍ່ເກີນຂະໜາດກຸ່ມ)
function drawSize(sections, draw) {
    var _a;
    const sizes = new Map();
    for (const q of questionsOf(sections))
        sizes.set((0, exports.drawGroupKey)(q), ((_a = sizes.get((0, exports.drawGroupKey)(q))) !== null && _a !== void 0 ? _a : 0) + 1);
    return Object.entries(draw.perGroup).reduce((sum, [key, n]) => { var _a; return sum + Math.min(n, (_a = sizes.get(key)) !== null && _a !== void 0 ? _a : 0); }, 0);
}
// ເລືອກຂໍ້ທີ່ usage ໜ້ອຍສຸດກ່ອນ; usage ເທົ່າກັນ → ສຸ່ມດ້ວຍ seed (ຄົນຕ່າງກັນໄດ້ຂໍ້ຕ່າງກັນ)
function drawQuestionIds(sections, draw, usage, seedText) {
    var _a, _b;
    const byGroup = new Map();
    for (const q of questionsOf(sections)) {
        const key = (0, exports.drawGroupKey)(q);
        byGroup.set(key, [...((_a = byGroup.get(key)) !== null && _a !== void 0 ? _a : []), q]);
    }
    const picked = [];
    for (const [key, n] of Object.entries(draw.perGroup)) {
        const pool = (_b = byGroup.get(key)) !== null && _b !== void 0 ? _b : [];
        const rank = new Map(seededShuffle(pool, `${seedText}:${key}`).map((q, i) => [q.id, i]));
        const ordered = [...pool].sort((a, b) => { var _a, _b; return ((_a = usage[a.id]) !== null && _a !== void 0 ? _a : 0) - ((_b = usage[b.id]) !== null && _b !== void 0 ? _b : 0) || rank.get(a.id) - rank.get(b.id); });
        picked.push(...ordered.slice(0, n).map((q) => q.id));
    }
    return picked;
}
// ເກັບສະເພາະຂໍ້ທີ່ຢູ່ໃນ ids (ລຳດັບຕາມຟອມ) — ໃຊ້ທັງຕອນສະແດງ, ກວດຄຳຕອບ ແລະ ຄິດຄະແນນ
function filterSections(sections, ids) {
    const keep = new Set(ids);
    return sections.map((s) => { var _a; return (Object.assign(Object.assign({}, s), { questions: ((_a = s.questions) !== null && _a !== void 0 ? _a : []).filter((q) => keep.has(q.id)) })); });
}
// ---------- ຂ້າມ section ຕາມຄຳຕອບ ----------
// ຂ້າມໄປທາງໜ້າເທົ່ານັ້ນ (ເປົ້າໝາຍທີ່ຢູ່ກ່ອນ ຫຼື ບໍ່ມີແລ້ວ → section ຖັດໄປ) ຈຶ່ງບໍ່ມີທາງວົນ.
// ຄຳຕອບຂອງຄຳຖາມຂ້າມ (goTo ຂອງຕົວເລືອກ) ສຳຄັນກວ່າ section.next.
// admin (services/forms.ts) ແລະ portal (services/forms.ts) ມີສຳເນົາ — ແກ້ໃຫ້ກົງກັນ.
exports.SUBMIT_TARGET = "__submit";
const branchingQuestionOf = (section) => { var _a; return ((_a = section.questions) !== null && _a !== void 0 ? _a : []).find((q) => q.branching && (q.type === "radio" || q.type === "dropdown")); };
exports.branchingQuestionOf = branchingQuestionOf;
// index ຂອງ section ຕໍ່ໄປ; sections.length = ສົ່ງຟອມ
function nextSectionIndex(sections, index, answers) {
    var _a, _b;
    const section = sections[index];
    const branching = (0, exports.branchingQuestionOf)(section);
    const answer = branching ? answers[branching.id] : undefined;
    const target = (typeof answer === "string" ? (_b = (_a = branching === null || branching === void 0 ? void 0 : branching.options) === null || _a === void 0 ? void 0 : _a.find((o) => o.id === answer)) === null || _b === void 0 ? void 0 : _b.goTo : undefined) ||
        section.next;
    if (!target)
        return index + 1;
    if (target === exports.SUBMIT_TARGET)
        return sections.length;
    const targetIndex = sections.findIndex((s) => s.id === target);
    return targetIndex > index ? targetIndex : index + 1;
}
// section ທີ່ພະນັກງານຜ່ານແທ້ ຕາມຄຳຕອບ (ເລີ່ມ section ທຳອິດ)
function visitedSections(sections, answers) {
    const visited = [];
    for (let i = 0; i < sections.length; i = nextSectionIndex(sections, i, answers)) {
        visited.push(sections[i]);
    }
    return visited;
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