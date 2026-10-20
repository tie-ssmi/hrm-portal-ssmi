"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const https_1 = require("firebase-functions/v2/https");
const forms_1 = require("./forms");
const isHttpsError = (code) => (error) => error instanceof https_1.HttpsError && error.code === code;
const emp = {
    uid: "U1",
    workLocationUuid: "B1",
    departmentUuid: "D1",
    employmentStatus: "permanent",
};
(0, node_test_1.test)("employeeAudienceKeys: all + emp + 8 ຄູ່ wildcard", () => {
    const keys = (0, forms_1.employeeAudienceKeys)(emp);
    strict_1.default.equal(keys.length, 10);
    strict_1.default.ok(keys.includes("all"));
    strict_1.default.ok(keys.includes("emp:U1"));
    strict_1.default.ok(keys.includes("g:B1:D1:permanent"));
    strict_1.default.ok(keys.includes("g:*:*:*"));
    strict_1.default.ok(keys.includes("g:B1:*:permanent"));
});
(0, node_test_1.test)("employeeAudienceKeys: ບໍ່ມີ employmentStatus → ບໍ່ກົງກັບຟອມທີ່ກອງສະຖານະ", () => {
    const keys = (0, forms_1.employeeAudienceKeys)({ uid: "U2", workLocationUuid: "B1", departmentUuid: "D1" });
    strict_1.default.equal(keys.length, 6);
    strict_1.default.ok(!keys.some((k) => k.endsWith(":permanent")));
});
(0, node_test_1.test)("isInAudience: ສາຂາ ∩ ພະແນກ ∩ ສະຖານະ", () => {
    strict_1.default.equal((0, forms_1.isInAudience)(["g:B1:D1:permanent"], emp), true);
    strict_1.default.equal((0, forms_1.isInAudience)(["g:B1:*:*"], emp), true);
    strict_1.default.equal((0, forms_1.isInAudience)(["g:*:*:permanent"], emp), true);
    // ສາຂາກົງ ແຕ່ພະແນກບໍ່ກົງ
    strict_1.default.equal((0, forms_1.isInAudience)(["g:B1:D2:*"], emp), false);
    // ສະເພາະຝຶກງານ
    strict_1.default.equal((0, forms_1.isInAudience)(["g:*:*:intern"], emp), false);
});
(0, node_test_1.test)("isInAudience: ທົ່ວລະບົບ / ລາຍບຸກຄົນ / ຂໍ້ມູນເສຍ", () => {
    strict_1.default.equal((0, forms_1.isInAudience)(["all"], emp), true);
    strict_1.default.equal((0, forms_1.isInAudience)(["emp:U1"], emp), true);
    strict_1.default.equal((0, forms_1.isInAudience)(["emp:U9"], emp), false);
    strict_1.default.equal((0, forms_1.isInAudience)(undefined, emp), false);
    strict_1.default.equal((0, forms_1.isInAudience)([], emp), false);
});
const sections = [
    {
        id: "s1",
        title: "",
        questions: [
            { id: "name", type: "shortText", title: "ຊື່", required: true },
            { id: "note", type: "longText", title: "ໝາຍເຫດ", required: false },
            {
                id: "color",
                type: "radio",
                title: "ສີ",
                required: true,
                options: [
                    { id: "r", label: "ແດງ" },
                    { id: "g", label: "ຂຽວ" },
                ],
            },
            {
                id: "food",
                type: "checkbox",
                title: "ອາຫານ",
                required: false,
                options: [
                    { id: "a", label: "A" },
                    { id: "b", label: "B" },
                ],
            },
            { id: "score", type: "rating", title: "ຄະແນນ", required: false, ratingMax: 5 },
        ],
    },
];
(0, node_test_1.test)("validateAnswers: ຄຳຕອບຖືກ → trim, ຕັດ id ແປກປອມ ແລະ ຄ່າຫວ່າງອອກ", () => {
    const result = (0, forms_1.validateAnswers)(sections, {
        name: "  ມົວ  ",
        note: "",
        color: "g",
        food: ["a", "a", "b"],
        score: 4,
        hacked: "x",
    });
    strict_1.default.deepEqual(result, { name: "ມົວ", color: "g", food: ["a", "b"], score: 4 });
});
(0, node_test_1.test)("validateAnswers: ຂາດຄຳຖາມບັງຄັບ → invalid-argument", () => {
    strict_1.default.throws(() => (0, forms_1.validateAnswers)(sections, { name: "   ", color: "r" }), isHttpsError("invalid-argument"));
    strict_1.default.throws(() => (0, forms_1.validateAnswers)(sections, { name: "x" }), isHttpsError("invalid-argument"));
});
(0, node_test_1.test)("validateAnswers: ຕົວເລືອກ / ຄະແນນ / ຮູບແບບ ບໍ່ຖືກຕ້ອງ → invalid-argument", () => {
    const base = { name: "x", color: "r" };
    for (const bad of [
        Object.assign(Object.assign({}, base), { color: "zzz" }),
        Object.assign(Object.assign({}, base), { food: ["a", "zzz"] }),
        Object.assign(Object.assign({}, base), { food: "a" }),
        Object.assign(Object.assign({}, base), { score: 6 }),
        Object.assign(Object.assign({}, base), { score: 2.5 }),
        Object.assign(Object.assign({}, base), { name: 123 }),
        Object.assign(Object.assign({}, base), { name: "x".repeat(501) }),
    ]) {
        strict_1.default.throws(() => (0, forms_1.validateAnswers)(sections, bad), isHttpsError("invalid-argument"));
    }
    strict_1.default.throws(() => (0, forms_1.validateAnswers)(sections, null), isHttpsError("invalid-argument"));
    strict_1.default.throws(() => (0, forms_1.validateAnswers)(sections, ["x"]), isHttpsError("invalid-argument"));
});
const answerKey = {
    color: { correct: ["g"], points: 2 },
    food: { correct: ["a", "b"], points: 3 },
    // ຂໍ້ຄວາມ ບໍ່ຖືກກວດ ເຖິງມີ key
    name: { correct: ["x"], points: 5 },
};
(0, node_test_1.test)("gradeAnswers: ຖືກໝົດ → ຄະແນນເຕັມ, ຂໍ້ຄວາມບໍ່ນັບ", () => {
    const score = (0, forms_1.gradeAnswers)(sections, { name: "x", color: "g", food: ["b", "a"] }, answerKey);
    strict_1.default.equal(score.earned, 5);
    strict_1.default.equal(score.total, 5);
    strict_1.default.deepEqual(Object.keys(score.results).sort(), ["color", "food"]);
});
(0, node_test_1.test)("gradeAnswers: checkbox ຕ້ອງກົງທັງຊຸດ — ຂາດ ຫຼື ເກີນ = 0", () => {
    strict_1.default.equal((0, forms_1.gradeAnswers)(sections, { color: "g", food: ["a"] }, answerKey).earned, 2);
    strict_1.default.equal((0, forms_1.gradeAnswers)(sections, { color: "r", food: ["a", "b"] }, answerKey).earned, 3);
    const missed = (0, forms_1.gradeAnswers)(sections, {}, answerKey);
    strict_1.default.equal(missed.earned, 0);
    strict_1.default.equal(missed.total, 5);
    strict_1.default.equal(missed.results.color.correct, false);
});
(0, node_test_1.test)("gradeAnswers: ບໍ່ມີເສີຍ / ຄະແນນຕິດລົບ → ບໍ່ໃຫ້ຄະແນນ", () => {
    const score = (0, forms_1.gradeAnswers)(sections, { color: "g" }, {
        color: { correct: [], points: 2 },
        food: { correct: ["a"], points: -4 },
    });
    strict_1.default.equal(score.earned, 0);
    strict_1.default.equal(score.total, 2);
});
(0, node_test_1.test)("toShowResult: ຄ່າແປກ → none", () => {
    strict_1.default.equal((0, forms_1.toShowResult)("score"), "score");
    strict_1.default.equal((0, forms_1.toShowResult)("scoreAndAnswers"), "scoreAndAnswers");
    strict_1.default.equal((0, forms_1.toShowResult)("all"), "none");
    strict_1.default.equal((0, forms_1.toShowResult)(undefined), "none");
});
(0, node_test_1.test)("seededShuffle: seed ດຽວກັນ → ລຳດັບດຽວກັນ, ບໍ່ຕົກຫຼົ່ນ", () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const a = (0, forms_1.seededShuffle)(items, "F1:U1");
    strict_1.default.deepEqual(a, (0, forms_1.seededShuffle)(items, "F1:U1"));
    strict_1.default.deepEqual([...a].sort((x, y) => x - y), items);
    strict_1.default.notDeepEqual(a, (0, forms_1.seededShuffle)(items, "F1:U2"));
    strict_1.default.notDeepEqual(a, items);
});
(0, node_test_1.test)("shuffleSectionsFor: ສຸ່ມຄຳຖາມ / ຕົວເລືອກ ຕາມຕັ້ງຄ່າ, ບໍ່ສຸ່ມ = ຄືເກົ່າ", () => {
    const many = [
        {
            id: "s",
            title: "",
            questions: Array.from({ length: 10 }, (_, i) => ({
                id: `q${i}`,
                type: "radio",
                title: `Q${i}`,
                required: false,
                options: Array.from({ length: 6 }, (_, j) => ({ id: `o${j}`, label: `O${j}` })),
            })),
        },
    ];
    strict_1.default.equal((0, forms_1.shuffleSectionsFor)(many, "x", { questions: false, choices: false }), many);
    const onlyChoices = (0, forms_1.shuffleSectionsFor)(many, "x", { questions: false, choices: true });
    strict_1.default.deepEqual(onlyChoices[0].questions.map((q) => q.id), many[0].questions.map((q) => q.id));
    strict_1.default.ok(onlyChoices[0].questions.some((q, i) => q.options[0].id !== many[0].questions[i].options[0].id));
    const both = (0, forms_1.shuffleSectionsFor)(many, "x", { questions: true, choices: true });
    strict_1.default.notDeepEqual(both[0].questions.map((q) => q.id), many[0].questions.map((q) => q.id));
    strict_1.default.equal(both[0].questions.length, 10);
});
const pool = (bankId, count, prefix) => Array.from({ length: count }, (_, i) => (Object.assign({ id: `${prefix}${i}`, type: "radio", title: `${prefix}${i}`, required: true, options: [{ id: "a", label: "A" }] }, (bankId ? { source: { bankId, questionId: `${prefix}${i}` } } : {}))));
const drawSections = [
    { id: "s", title: "", questions: [...pool("B1", 20, "x"), ...pool("B2", 10, "y"), ...pool(null, 3, "own")] },
];
(0, node_test_1.test)("toDrawSettings: ຕັດຄ່າ 0/ຕິດລົບ/ແປກ, ບໍ່ມີກຸ່ມ = ປິດ", () => {
    strict_1.default.deepEqual((0, forms_1.toDrawSettings)({ enabled: true, perGroup: { B1: 5, B2: 0, B3: -1, B4: "2" } }), {
        enabled: true,
        perGroup: { B1: 5, B4: 2 },
    });
    strict_1.default.equal((0, forms_1.toDrawSettings)({ enabled: true, perGroup: {} }).enabled, false);
    strict_1.default.equal((0, forms_1.toDrawSettings)(undefined).enabled, false);
});
(0, node_test_1.test)("drawSize: ບໍ່ເກີນຂະໜາດກຸ່ມ", () => {
    strict_1.default.equal((0, forms_1.drawSize)(drawSections, (0, forms_1.toDrawSettings)({ enabled: true, perGroup: { B1: 5, B2: 50, _form: 1 } })), 16);
});
(0, node_test_1.test)("drawQuestionIds: ຈຳນວນຕາມກຸ່ມ ແລະ seed ດຽວກັນ → ຊຸດດຽວກັນ", () => {
    const draw = (0, forms_1.toDrawSettings)({ enabled: true, perGroup: { B1: 5, B2: 2 } });
    const ids = (0, forms_1.drawQuestionIds)(drawSections, draw, {}, "F:U1");
    strict_1.default.equal(ids.filter((id) => id.startsWith("x")).length, 5);
    strict_1.default.equal(ids.filter((id) => id.startsWith("y")).length, 2);
    strict_1.default.deepEqual(ids, (0, forms_1.drawQuestionIds)(drawSections, draw, {}, "F:U1"));
});
(0, node_test_1.test)("drawQuestionIds: ຂໍ້ທີ່ໃຊ້ໜ້ອຍສຸດກ່ອນ → 4 ຄົນທຳອິດ (20/5) ບໍ່ຊ້ຳກັນເລີຍ, ແລ້ວວົນສະເໝີ", () => {
    var _a;
    const draw = (0, forms_1.toDrawSettings)({ enabled: true, perGroup: { B1: 5 } });
    const usage = {};
    const seen = new Set();
    for (let person = 0; person < 4; person++) {
        const ids = (0, forms_1.drawQuestionIds)(drawSections, draw, usage, `F:U${person}`);
        for (const id of ids) {
            strict_1.default.ok(!seen.has(id), `${id} ຊ້ຳ`);
            seen.add(id);
            usage[id] = ((_a = usage[id]) !== null && _a !== void 0 ? _a : 0) + 1;
        }
    }
    strict_1.default.equal(seen.size, 20);
    // ຄົນທີ 5–8 ກໍຄືກັນ: ທຸກຂໍ້ຖືກໃຊ້ 2 ເທື່ອພໍດີ
    for (let person = 4; person < 8; person++) {
        for (const id of (0, forms_1.drawQuestionIds)(drawSections, draw, usage, `F:U${person}`))
            usage[id] += 1;
    }
    strict_1.default.ok(Object.values(usage).every((n) => n === 2));
});
(0, node_test_1.test)("filterSections: ເກັບສະເພາະຂໍ້ທີ່ໄດ້ຮັບ ຕາມລຳດັບຟອມ", () => {
    const filtered = (0, forms_1.filterSections)(drawSections, ["y1", "x3", "own0"]);
    strict_1.default.deepEqual(filtered[0].questions.map((q) => q.id), ["x3", "y1", "own0"]);
});
(0, node_test_1.test)("effectiveFormStatus: ຕັ້ງເວລາເປີດ/ປິດ", () => {
    const at = (iso) => new Date(iso);
    const schedule = { openAt: "2026-11-01T01:00:00.000Z", closeAt: "2026-11-05T10:00:00.000Z" };
    strict_1.default.equal((0, forms_1.effectiveFormStatus)("scheduled", schedule, at("2026-11-01T00:59:59.000Z")), "scheduled");
    strict_1.default.equal((0, forms_1.effectiveFormStatus)("scheduled", schedule, at("2026-11-01T01:00:00.000Z")), "open");
    strict_1.default.equal((0, forms_1.effectiveFormStatus)("scheduled", schedule, at("2026-11-05T10:00:00.000Z")), "closed");
    // ເປີດດຽວນີ້ + ຕັ້ງເວລາປິດ
    strict_1.default.equal((0, forms_1.effectiveFormStatus)("open", { closeAt: schedule.closeAt }, at("2026-11-05T09:59:00.000Z")), "open");
    strict_1.default.equal((0, forms_1.effectiveFormStatus)("open", { closeAt: schedule.closeAt }, at("2026-11-05T10:00:01.000Z")), "closed");
    // ເປີດ/ປິດເອງ (ບໍ່ມີເວລາ)
    strict_1.default.equal((0, forms_1.effectiveFormStatus)("open", undefined, at("2030-01-01T00:00:00.000Z")), "open");
    strict_1.default.equal((0, forms_1.effectiveFormStatus)("closed", { closeAt: "2099-01-01T00:00:00.000Z" }, at("2026-01-01T00:00:00.000Z")), "closed");
    strict_1.default.equal((0, forms_1.effectiveFormStatus)("draft", schedule, at("2026-11-03T00:00:00.000Z")), "draft");
    strict_1.default.equal((0, forms_1.effectiveFormStatus)("delete", undefined, at("2026-11-03T00:00:00.000Z")), "draft");
    // scheduled ທີ່ບໍ່ມີ openAt = ເປີດ
    strict_1.default.equal((0, forms_1.effectiveFormStatus)("scheduled", {}, at("2026-11-03T00:00:00.000Z")), "open");
});
//# sourceMappingURL=forms.test.js.map