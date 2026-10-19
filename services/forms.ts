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

export type FormOption = { id: string; label: string }

export type FormQuestion = {
  id: string
  type: FormQuestionType
  title: string
  description?: string
  required: boolean
  options?: FormOption[]
  ratingMax?: number
}

export type FormSection = {
  id: string
  title: string
  description?: string
  questions: FormQuestion[]
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
  status: 'open' | 'closed'
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

export const formQuestions = (sections: FormSection[]): FormQuestion[] =>
  sections.flatMap((s) => s.questions ?? [])

// ຄຳຖາມບັງຄັບທີ່ຍັງບໍ່ໄດ້ຕອບ — ກວດກ່ອນສົ່ງ (server ກວດອີກຮອບ)
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
