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
//# sourceMappingURL=forms.test.js.map