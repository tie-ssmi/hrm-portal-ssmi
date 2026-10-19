import { test } from "node:test";
import assert from "node:assert/strict";
import { HttpsError } from "firebase-functions/v2/https";
import {
  employeeAudienceKeys,
  gradeAnswers,
  isInAudience,
  toShowResult,
  validateAnswers,
  type FormSection,
} from "./forms";

const isHttpsError = (code: string) => (error: unknown) =>
  error instanceof HttpsError && error.code === code;

const emp = {
  uid: "U1",
  workLocationUuid: "B1",
  departmentUuid: "D1",
  employmentStatus: "permanent",
};

test("employeeAudienceKeys: all + emp + 8 ຄູ່ wildcard", () => {
  const keys = employeeAudienceKeys(emp);
  assert.equal(keys.length, 10);
  assert.ok(keys.includes("all"));
  assert.ok(keys.includes("emp:U1"));
  assert.ok(keys.includes("g:B1:D1:permanent"));
  assert.ok(keys.includes("g:*:*:*"));
  assert.ok(keys.includes("g:B1:*:permanent"));
});

test("employeeAudienceKeys: ບໍ່ມີ employmentStatus → ບໍ່ກົງກັບຟອມທີ່ກອງສະຖານະ", () => {
  const keys = employeeAudienceKeys({ uid: "U2", workLocationUuid: "B1", departmentUuid: "D1" });
  assert.equal(keys.length, 6);
  assert.ok(!keys.some((k) => k.endsWith(":permanent")));
});

test("isInAudience: ສາຂາ ∩ ພະແນກ ∩ ສະຖານະ", () => {
  assert.equal(isInAudience(["g:B1:D1:permanent"], emp), true);
  assert.equal(isInAudience(["g:B1:*:*"], emp), true);
  assert.equal(isInAudience(["g:*:*:permanent"], emp), true);
  // ສາຂາກົງ ແຕ່ພະແນກບໍ່ກົງ
  assert.equal(isInAudience(["g:B1:D2:*"], emp), false);
  // ສະເພາະຝຶກງານ
  assert.equal(isInAudience(["g:*:*:intern"], emp), false);
});

test("isInAudience: ທົ່ວລະບົບ / ລາຍບຸກຄົນ / ຂໍ້ມູນເສຍ", () => {
  assert.equal(isInAudience(["all"], emp), true);
  assert.equal(isInAudience(["emp:U1"], emp), true);
  assert.equal(isInAudience(["emp:U9"], emp), false);
  assert.equal(isInAudience(undefined, emp), false);
  assert.equal(isInAudience([], emp), false);
});

const sections: FormSection[] = [
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

test("validateAnswers: ຄຳຕອບຖືກ → trim, ຕັດ id ແປກປອມ ແລະ ຄ່າຫວ່າງອອກ", () => {
  const result = validateAnswers(sections, {
    name: "  ມົວ  ",
    note: "",
    color: "g",
    food: ["a", "a", "b"],
    score: 4,
    hacked: "x",
  });
  assert.deepEqual(result, { name: "ມົວ", color: "g", food: ["a", "b"], score: 4 });
});

test("validateAnswers: ຂາດຄຳຖາມບັງຄັບ → invalid-argument", () => {
  assert.throws(() => validateAnswers(sections, { name: "   ", color: "r" }), isHttpsError("invalid-argument"));
  assert.throws(() => validateAnswers(sections, { name: "x" }), isHttpsError("invalid-argument"));
});

test("validateAnswers: ຕົວເລືອກ / ຄະແນນ / ຮູບແບບ ບໍ່ຖືກຕ້ອງ → invalid-argument", () => {
  const base = { name: "x", color: "r" };
  for (const bad of [
    { ...base, color: "zzz" },
    { ...base, food: ["a", "zzz"] },
    { ...base, food: "a" },
    { ...base, score: 6 },
    { ...base, score: 2.5 },
    { ...base, name: 123 },
    { ...base, name: "x".repeat(501) },
  ]) {
    assert.throws(() => validateAnswers(sections, bad), isHttpsError("invalid-argument"));
  }
  assert.throws(() => validateAnswers(sections, null), isHttpsError("invalid-argument"));
  assert.throws(() => validateAnswers(sections, ["x"]), isHttpsError("invalid-argument"));
});

const answerKey = {
  color: { correct: ["g"], points: 2 },
  food: { correct: ["a", "b"], points: 3 },
  // ຂໍ້ຄວາມ ບໍ່ຖືກກວດ ເຖິງມີ key
  name: { correct: ["x"], points: 5 },
};

test("gradeAnswers: ຖືກໝົດ → ຄະແນນເຕັມ, ຂໍ້ຄວາມບໍ່ນັບ", () => {
  const score = gradeAnswers(sections, { name: "x", color: "g", food: ["b", "a"] }, answerKey);
  assert.equal(score.earned, 5);
  assert.equal(score.total, 5);
  assert.deepEqual(Object.keys(score.results).sort(), ["color", "food"]);
});

test("gradeAnswers: checkbox ຕ້ອງກົງທັງຊຸດ — ຂາດ ຫຼື ເກີນ = 0", () => {
  assert.equal(gradeAnswers(sections, { color: "g", food: ["a"] }, answerKey).earned, 2);
  assert.equal(gradeAnswers(sections, { color: "r", food: ["a", "b"] }, answerKey).earned, 3);
  const missed = gradeAnswers(sections, {}, answerKey);
  assert.equal(missed.earned, 0);
  assert.equal(missed.total, 5);
  assert.equal(missed.results.color.correct, false);
});

test("gradeAnswers: ບໍ່ມີເສີຍ / ຄະແນນຕິດລົບ → ບໍ່ໃຫ້ຄະແນນ", () => {
  const score = gradeAnswers(sections, { color: "g" }, {
    color: { correct: [], points: 2 },
    food: { correct: ["a"], points: -4 },
  });
  assert.equal(score.earned, 0);
  assert.equal(score.total, 2);
});

test("toShowResult: ຄ່າແປກ → none", () => {
  assert.equal(toShowResult("score"), "score");
  assert.equal(toShowResult("scoreAndAnswers"), "scoreAndAnswers");
  assert.equal(toShowResult("all"), "none");
  assert.equal(toShowResult(undefined), "none");
});
