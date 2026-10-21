// ແບບຟອມ / ແບບສອບຖາມ (forms, ສ້າງຈາກ admin HRM-System-SSMI). rules ບໍ່ໃຫ້ພະນັກງານອ່ານ/ຂຽນ
// forms ໂດຍກົງ — ທຸກຢ່າງຜ່ານ callable listMyForms / getMyForm / submitFormResponse
// (functions/src/index.ts), ເຊິ່ງກວດສິດຕອບຈາກຂໍ້ມູນພະນັກງານປັດຈຸບັນ ແລະ ກວດຄຳຕອບອີກຮອບ.

import { getFunctions, httpsCallable } from 'firebase/functions'
import app from '@/lib/firebase'

let _fns: ReturnType<typeof getFunctions> | null = null
function fns() {
  if (!_fns) _fns = getFunctions(app, 'asia-southeast1')
  return _fns
}

export type FormQuestionType = 'shortText' | 'longText' | 'radio' | 'checkbox' | 'dropdown' | 'rating'

// goTo: ຕອບຕົວເລືອກນີ້ → ໄປ section ໃດ (ເມື່ອ question.branching)
export type FormOption = { id: string; label: string; goTo?: string }

export type FormQuestion = {
  id: string
  type: FormQuestionType
  title: string
  description?: string
  required: boolean
  options?: FormOption[]
  ratingMax?: number
  // ໄປ section ຕາມຄຳຕອບ (ເລືອກຕອບ/Dropdown)
  branching?: boolean
}

export type FormSection = {
  id: string
  title: string
  description?: string
  questions: FormQuestion[]
  // ຫຼັງຈາກ section ນີ້: ບໍ່ຕັ້ງ = section ຖັດໄປ, SUBMIT_TARGET = ສົ່ງຟອມ, ຫຼື id ຂອງ section ທາງໜ້າ
  next?: string
}

export type FormAnswer = string | string[] | number
export type FormAnswers = Record<string, FormAnswer>

// Quiz — ສິ່ງທີ່ພະນັກງານເຫັນຫຼັງສົ່ງ (admin ຕັ້ງຕໍ່ຟອມ)
export type ShowResult = 'none' | 'score' | 'scoreAndAnswers'

export type QuestionResult = { correct: boolean; earned: number; points: number }

// results ມີສະເພາະ showResult = scoreAndAnswers
export type QuizScore = { earned: number; total: number; results?: Record<string, QuestionResult> }

export type MyFormSummary = {
  id: string
  title: string
  description: string
  // scheduled = ຕັ້ງເວລາເປີດໄວ້ ຍັງບໍ່ຮອດ (ສະແດງໃຫ້ຮູ້ລ່ວງໜ້າ, ເປີດຕອບບໍ່ໄດ້)
  status: 'scheduled' | 'open' | 'closed'
  openAt: string | null
  closeAt: string | null
  questionCount: number
  allowEdit: boolean
  isQuiz: boolean
  openedAt: string
  submittedAt: string | null
  score: QuizScore | null
}

export type MyForm = {
  form: {
    id: string
    title: string
    description: string
    status: 'open' | 'closed'
    // ປິດຮັບອັດຕະໂນມັດ (ISO) — null = admin ປິດເອງ
    closeAt: string | null
    allowEdit: boolean
    isQuiz: boolean
    showResult: ShowResult
    // ຄະແນນຕໍ່ຂໍ້ (ສະເພາະຂໍ້ທີ່ນັບຄະແນນ)
    questionPoints: Record<string, number>
    sections: FormSection[]
  }
  response: {
    answers: FormAnswers
    submittedAt: string
    updatedAt: string
    score: QuizScore | null
    // ເສີຍ — server ສົ່ງໃຫ້ສະເພາະຫຼັງຕອບແລ້ວ ແລະ showResult = scoreAndAnswers
    correctAnswers: Record<string, string[]> | null
  } | null
}

// ຄວາມຍາວສູງສຸດ — ກົງກັບ SHORT_TEXT_MAX / LONG_TEXT_MAX ໃນ functions/src/forms.ts
export const SHORT_TEXT_MAX = 500
export const LONG_TEXT_MAX = 5000

// ວັນທີ/ເວລາ ຕາມເວລາລາວ "dd/mm/yyyy HH:mm" — ບໍ່ຂຶ້ນກັບ timezone ຂອງເຄື່ອງ
const vientianeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Vientiane',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function formatFormDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : vientianeFormatter.format(d).replace(',', '')
}

// ເຫຼືອເວລາໜ້ອຍກວ່າ 24 ຊົ່ວໂມງກ່ອນປິດ — ໃຊ້ເນັ້ນສີເຕືອນ
export const closesSoon = (closeAt: string | null | undefined) =>
  !!closeAt && new Date(closeAt).getTime() - Date.now() < 24 * 60 * 60 * 1000

export const formQuestions = (sections: FormSection[]): FormQuestion[] =>
  sections.flatMap((s) => s.questions ?? [])

// ຄຳຖາມບັງຄັບທີ່ຍັງບໍ່ໄດ້ຕອບ — ກວດກ່ອນສົ່ງ (server ກວດອີກຮອບ)
// ---------- ຂ້າມ section ຕາມຄຳຕອບ ----------
// ສຳເນົາຂອງ nextSectionIndex / visitedSections ໃນ functions/src/forms.ts (server ຄິດຄືນເອງຕອນສົ່ງ) —
// ແກ້ໃຫ້ກົງກັນ. ຂ້າມໄປທາງໜ້າເທົ່ານັ້ນ ຈຶ່ງບໍ່ມີທາງວົນ.
export const SUBMIT_TARGET = '__submit'

const branchingQuestionOf = (section: FormSection) =>
  (section.questions ?? []).find((q) => q.branching && (q.type === 'radio' || q.type === 'dropdown'))

export const formHasBranching = (sections: FormSection[]) =>
  sections.some((s) => !!s.next || !!branchingQuestionOf(s))

// index ຂອງ section ຕໍ່ໄປ; sections.length = ສົ່ງຟອມ
export function nextSectionIndex(sections: FormSection[], index: number, answers: FormAnswers): number {
  const section = sections[index]
  const branching = branchingQuestionOf(section)
  const answer = branching ? answers[branching.id] : undefined
  const target =
    (typeof answer === 'string' ? branching?.options?.find((o) => o.id === answer)?.goTo : undefined) ||
    section.next
  if (!target) return index + 1
  if (target === SUBMIT_TARGET) return sections.length
  const targetIndex = sections.findIndex((s) => s.id === target)
  return targetIndex > index ? targetIndex : index + 1
}

export function visitedSections(sections: FormSection[], answers: FormAnswers): FormSection[] {
  const visited: FormSection[] = []
  for (let i = 0; i < sections.length; i = nextSectionIndex(sections, i, answers)) visited.push(sections[i])
  return visited
}

export function missingRequired(sections: FormSection[], answers: FormAnswers): FormQuestion[] {
  return formQuestions(sections).filter((q) => {
    if (!q.required) return false
    const value = answers[q.id]
    if (value === undefined || value === '') return true
    if (typeof value === 'string') return !value.trim()
    if (Array.isArray(value)) return value.length === 0
    return false
  })
}

export async function listMyForms(): Promise<MyFormSummary[]> {
  const fn = httpsCallable<void, { forms: MyFormSummary[] }>(fns(), 'listMyForms')
  return (await fn()).data.forms
}

export async function getMyForm(formId: string): Promise<MyForm> {
  const fn = httpsCallable<{ formId: string }, MyForm>(fns(), 'getMyForm')
  return (await fn({ formId })).data
}

export async function submitFormResponse(formId: string, answers: FormAnswers) {
  const fn = httpsCallable<
    { formId: string; answers: FormAnswers },
    { submittedAt: string; updatedAt: string; score: QuizScore | null }
  >(fns(), 'submitFormResponse')
  return (await fn({ formId, answers })).data
}
