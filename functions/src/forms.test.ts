import { test } from "node:test";
import assert from "node:assert/strict";
import { HttpsError } from "firebase-functions/v2/https";
import {
  drawQuestionIds,
  effectiveFormStatus,
  drawSize,
  employeeAudienceKeys,
  filterSections,
  toDrawSettings,
  gradeAnswers,
  isInAudience,
  nextSectionIndex,
  SUBMIT_TARGET,
  visitedSections,
  seededShuffle,
  shuffleSectionsFor,
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

test("seededShuffle: seed ດຽວກັນ → ລຳດັບດຽວກັນ, ບໍ່ຕົກຫຼົ່ນ", () => {
  const items = Array.from({ length: 20 }, (_, i) => i);
  const a = seededShuffle(items, "F1:U1");
  assert.deepEqual(a, seededShuffle(items, "F1:U1"));
  assert.deepEqual([...a].sort((x, y) => x - y), items);
  assert.notDeepEqual(a, seededShuffle(items, "F1:U2"));
  assert.notDeepEqual(a, items);
});

test("shuffleSectionsFor: ສຸ່ມຄຳຖາມ / ຕົວເລືອກ ຕາມຕັ້ງຄ່າ, ບໍ່ສຸ່ມ = ຄືເກົ່າ", () => {
  const many: FormSection[] = [
    {
      id: "s",
      title: "",
      questions: Array.from({ length: 10 }, (_, i) => ({
        id: `q${i}`,
        type: "radio" as const,
        title: `Q${i}`,
        required: false,
        options: Array.from({ length: 6 }, (_, j) => ({ id: `o${j}`, label: `O${j}` })),
      })),
    },
  ];
  assert.equal(shuffleSectionsFor(many, "x", { questions: false, choices: false }), many);

  const onlyChoices = shuffleSectionsFor(many, "x", { questions: false, choices: true });
  assert.deepEqual(onlyChoices[0].questions.map((q) => q.id), many[0].questions.map((q) => q.id));
  assert.ok(onlyChoices[0].questions.some((q, i) => q.options![0].id !== many[0].questions[i].options![0].id));

  const both = shuffleSectionsFor(many, "x", { questions: true, choices: true });
  assert.notDeepEqual(both[0].questions.map((q) => q.id), many[0].questions.map((q) => q.id));
  assert.equal(both[0].questions.length, 10);
});

const pool = (bankId: string | null, count: number, prefix: string): FormSection["questions"] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${prefix}${i}`,
    type: "radio" as const,
    title: `${prefix}${i}`,
    required: true,
    options: [{ id: "a", label: "A" }],
    ...(bankId ? { source: { bankId, questionId: `${prefix}${i}` } } : {}),
  }));

const drawSections: FormSection[] = [
  { id: "s", title: "", questions: [...pool("B1", 20, "x"), ...pool("B2", 10, "y"), ...pool(null, 3, "own")] },
];

test("toDrawSettings: ຕັດຄ່າ 0/ຕິດລົບ/ແປກ, ບໍ່ມີກຸ່ມ = ປິດ", () => {
  assert.deepEqual(toDrawSettings({ enabled: true, perGroup: { B1: 5, B2: 0, B3: -1, B4: "2" } }), {
    enabled: true,
    perGroup: { B1: 5, B4: 2 },
  });
  assert.equal(toDrawSettings({ enabled: true, perGroup: {} }).enabled, false);
  assert.equal(toDrawSettings(undefined).enabled, false);
});

test("drawSize: ບໍ່ເກີນຂະໜາດກຸ່ມ", () => {
  assert.equal(drawSize(drawSections, toDrawSettings({ enabled: true, perGroup: { B1: 5, B2: 50, _form: 1 } })), 16);
});

test("drawQuestionIds: ຈຳນວນຕາມກຸ່ມ ແລະ seed ດຽວກັນ → ຊຸດດຽວກັນ", () => {
  const draw = toDrawSettings({ enabled: true, perGroup: { B1: 5, B2: 2 } });
  const ids = drawQuestionIds(drawSections, draw, {}, "F:U1");
  assert.equal(ids.filter((id) => id.startsWith("x")).length, 5);
  assert.equal(ids.filter((id) => id.startsWith("y")).length, 2);
  assert.deepEqual(ids, drawQuestionIds(drawSections, draw, {}, "F:U1"));
});

test("drawQuestionIds: ຂໍ້ທີ່ໃຊ້ໜ້ອຍສຸດກ່ອນ → 4 ຄົນທຳອິດ (20/5) ບໍ່ຊ້ຳກັນເລີຍ, ແລ້ວວົນສະເໝີ", () => {
  const draw = toDrawSettings({ enabled: true, perGroup: { B1: 5 } });
  const usage: Record<string, number> = {};
  const seen = new Set<string>();
  for (let person = 0; person < 4; person++) {
    const ids = drawQuestionIds(drawSections, draw, usage, `F:U${person}`);
    for (const id of ids) {
      assert.ok(!seen.has(id), `${id} ຊ້ຳ`);
      seen.add(id);
      usage[id] = (usage[id] ?? 0) + 1;
    }
  }
  assert.equal(seen.size, 20);
  // ຄົນທີ 5–8 ກໍຄືກັນ: ທຸກຂໍ້ຖືກໃຊ້ 2 ເທື່ອພໍດີ
  for (let person = 4; person < 8; person++) {
    for (const id of drawQuestionIds(drawSections, draw, usage, `F:U${person}`)) usage[id] += 1;
  }
  assert.ok(Object.values(usage).every((n) => n === 2));
});

test("filterSections: ເກັບສະເພາະຂໍ້ທີ່ໄດ້ຮັບ ຕາມລຳດັບຟອມ", () => {
  const filtered = filterSections(drawSections, ["y1", "x3", "own0"]);
  assert.deepEqual(filtered[0].questions.map((q) => q.id), ["x3", "y1", "own0"]);
});

test("effectiveFormStatus: ຕັ້ງເວລາເປີດ/ປິດ", () => {
  const at = (iso: string) => new Date(iso);
  const schedule = { openAt: "2026-11-01T01:00:00.000Z", closeAt: "2026-11-05T10:00:00.000Z" };
  assert.equal(effectiveFormStatus("scheduled", schedule, at("2026-11-01T00:59:59.000Z")), "scheduled");
  assert.equal(effectiveFormStatus("scheduled", schedule, at("2026-11-01T01:00:00.000Z")), "open");
  assert.equal(effectiveFormStatus("scheduled", schedule, at("2026-11-05T10:00:00.000Z")), "closed");
  // ເປີດດຽວນີ້ + ຕັ້ງເວລາປິດ
  assert.equal(effectiveFormStatus("open", { closeAt: schedule.closeAt }, at("2026-11-05T09:59:00.000Z")), "open");
  assert.equal(effectiveFormStatus("open", { closeAt: schedule.closeAt }, at("2026-11-05T10:00:01.000Z")), "closed");
  // ເປີດ/ປິດເອງ (ບໍ່ມີເວລາ)
  assert.equal(effectiveFormStatus("open", undefined, at("2030-01-01T00:00:00.000Z")), "open");
  assert.equal(effectiveFormStatus("closed", { closeAt: "2099-01-01T00:00:00.000Z" }, at("2026-01-01T00:00:00.000Z")), "closed");
  assert.equal(effectiveFormStatus("draft", schedule, at("2026-11-03T00:00:00.000Z")), "draft");
  assert.equal(effectiveFormStatus("delete", undefined, at("2026-11-03T00:00:00.000Z")), "draft");
  // scheduled ທີ່ບໍ່ມີ openAt = ເປີດ
  assert.equal(effectiveFormStatus("scheduled", {}, at("2026-11-03T00:00:00.000Z")), "open");
});

const branchSections: FormSection[] = [
  {
    id: "s1",
    title: "ທົ່ວໄປ",
    questions: [
      {
        id: "trained",
        type: "radio",
        title: "ເຄີຍຝຶກບໍ?",
        required: true,
        branching: true,
        options: [
          { id: "yes", label: "ເຄີຍ", goTo: "s2" },
          { id: "no", label: "ບໍ່ເຄີຍ", goTo: "s3" },
          { id: "skip", label: "ບໍ່ແນ່ໃຈ", goTo: SUBMIT_TARGET },
          { id: "default", label: "ອື່ນ" },
        ],
      },
    ],
  },
  { id: "s2", title: "ປະເມີນ", next: SUBMIT_TARGET, questions: [{ id: "rate", type: "rating", title: "ໃຫ້ຄະແນນ", required: true }] },
  { id: "s3", title: "ຢາກຝຶກ", questions: [{ id: "topic", type: "shortText", title: "ຫົວຂໍ້", required: true }] },
  { id: "s4", title: "ສະເໜີແນະ", questions: [{ id: "note", type: "longText", title: "ໝາຍເຫດ", required: false }] },
];

test("visitedSections: ໄປຕາມຄຳຕອບ / section.next / ສົ່ງເລີຍ", () => {
  const ids = (answers: Record<string, string>) => visitedSections(branchSections, answers).map((s) => s.id);
  assert.deepEqual(ids({ trained: "yes" }), ["s1", "s2"]);
  assert.deepEqual(ids({ trained: "no" }), ["s1", "s3", "s4"]);
  assert.deepEqual(ids({ trained: "skip" }), ["s1"]);
  // ຕົວເລືອກບໍ່ມີ goTo / ຍັງບໍ່ຕອບ → section ຖັດໄປ (ແລ້ວ s2.next = ສົ່ງ)
  assert.deepEqual(ids({ trained: "default" }), ["s1", "s2"]);
  assert.deepEqual(ids({}), ["s1", "s2"]);
});

test("nextSectionIndex: ຂ້າມກັບຫຼັງ / ເປົ້າໝາຍບໍ່ມີ → section ຖັດໄປ (ບໍ່ວົນ)", () => {
  const loop: FormSection[] = [
    { id: "a", title: "", questions: [] },
    { id: "b", title: "", next: "a", questions: [] },
    { id: "c", title: "", next: "missing", questions: [] },
  ];
  assert.equal(nextSectionIndex(loop, 1, {}), 2);
  assert.equal(nextSectionIndex(loop, 2, {}), 3);
  assert.deepEqual(visitedSections(loop, {}).map((s) => s.id), ["a", "b", "c"]);
});

test("validateAnswers ກັບ visitedSections: ຂໍ້ບັງຄັບຂອງ section ທີ່ບໍ່ໄດ້ຜ່ານ ບໍ່ບັງຄັບ, ຄຳຕອບຂອງມັນຖືກຕັດ", () => {
  const answers = { trained: "yes", rate: 4, topic: "ບໍ່ຄວນສົ່ງມາ" };
  const clean = validateAnswers(visitedSections(branchSections, answers), answers);
  assert.deepEqual(clean, { trained: "yes", rate: 4 });
});
