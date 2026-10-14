// Pure definitions for the 4-type workOutside form — no React, no Firestore.
// The form, its review step, the badges/filters and both detail pages read the
// type table and field rules from here so they can't drift apart.

import { differenceInCalendarDays, parseISO } from 'date-fns'

import type {
  ActivityCode,
  CostItem,
  CostTotals,
  CurrentActivityCode,
  FormType,
  LegacyActivityCode,
  WorkOutsideRecord,
} from '@/types/workOutside'

export const ACTIVITY_TYPES: Record<FormType, { code: CurrentActivityCode; name: string }> = {
  workOutside: { code: 'GENERAL', name: 'ອອກວຽກນອກທົ່ວໄປ' },
  overtime: { code: 'OVERTIME', name: 'ເຮັດວຽກວັນພັກ (OT)' },
  training: { code: 'TRAINING', name: 'ຝຶກອົບຮົມ / ທັດສະນະສຶກສາ' },
  audit: { code: 'AUDIT', name: 'ລົງກວດກາ' },
  visit: { code: 'VISIT', name: 'ຢ້ຽມຢາມ / ຕິດຕາມ' },
}

export const FORM_TYPES: FormType[] = ['workOutside', 'overtime', 'training', 'audit', 'visit']

export const LEGACY_ACTIVITY_CODES: LegacyActivityCode[] = [
  'MEET_CLIENT',
  'MEETING',
  'BOOTH',
  'PROMO',
  'OTHERS',
]

// Filter dropdowns list the current types first, then the old codes so old
// requests stay findable. TRAINING appears once and matches both eras.
export const ACTIVITY_FILTER_CODES: ActivityCode[] = [
  ...FORM_TYPES.map((t) => ACTIVITY_TYPES[t].code),
  ...LEGACY_ACTIVITY_CODES,
]

export function getFormType(doc: { formType?: FormType | null }): FormType {
  return doc.formType ?? 'workOutside'
}

// A doc saved by the old 6-type form: no formType (so it reads as
// 'workOutside') but a code other than GENERAL. Such a doc keeps its code and
// stored name on edit and gets the general field set.
export function isLegacyActivity(formType: FormType, code: ActivityCode | null | undefined): boolean {
  return formType === 'workOutside' && !!code && code !== 'GENERAL'
}

// ── Field rules ──────────────────────────────────────────────────────────────

// Every field the form can show. Some cover several doc keys (see
// DOC_KEY_FIELD): times = startTime + endTime, costItems = costItems +
// exchangeRate + costTotals, trainingInfo = organizer + registrationDeadline +
// coordinators.
export type FieldKey =
  | 'subject'
  | 'dates' // startDate + endDate, picked on their own (not from the schedule)
  | 'references'
  | 'objective'
  | 'details'
  | 'location'
  | 'customerName'
  | 'schedule'
  | 'times'
  | 'totalHours'
  | 'equipmentUsed'
  | 'estimatedCost'
  | 'costItems'
  | 'trainingInfo'
  | 'documentChecklist'
  | 'notes'
  | 'docLink'

export type FieldRule = 'required' | 'optional' | 'hidden'
export type FieldRules = Record<FieldKey, FieldRule>

// The one table that rendering, validation, the review step and the payload
// all read. 'hidden' = not rendered, not validated, not reviewed, never
// written to the doc.
export const FIELDS_BY_TYPE: Record<CurrentActivityCode, FieldRules> = {
  GENERAL: {
    subject: 'required',
    dates: 'required',
    references: 'optional',
    objective: 'optional',
    details: 'optional',
    location: 'required',
    customerName: 'optional',
    schedule: 'optional',
    times: 'optional',
    totalHours: 'hidden',
    equipmentUsed: 'optional',
    estimatedCost: 'optional',
    costItems: 'hidden',
    trainingInfo: 'hidden',
    documentChecklist: 'hidden',
    notes: 'optional',
    docLink: 'optional',
  },
  OVERTIME: {
    subject: 'required',
    dates: 'required',
    references: 'optional',
    objective: 'required',
    details: 'hidden',
    location: 'optional',
    customerName: 'hidden',
    schedule: 'optional',
    times: 'required',
    totalHours: 'required',
    equipmentUsed: 'hidden',
    estimatedCost: 'hidden',
    costItems: 'hidden',
    trainingInfo: 'hidden',
    documentChecklist: 'hidden',
    notes: 'optional',
    docLink: 'optional',
  },
  TRAINING: {
    subject: 'required',
    dates: 'required',
    references: 'optional',
    objective: 'optional',
    details: 'optional',
    location: 'required',
    customerName: 'hidden',
    schedule: 'required',
    times: 'hidden',
    totalHours: 'hidden',
    equipmentUsed: 'hidden',
    estimatedCost: 'required',
    costItems: 'optional',
    trainingInfo: 'optional',
    documentChecklist: 'hidden',
    notes: 'optional',
    docLink: 'optional',
  },
  AUDIT: {
    subject: 'required',
    dates: 'required',
    references: 'optional',
    objective: 'optional',
    details: 'optional',
    location: 'required',
    customerName: 'hidden',
    schedule: 'required',
    times: 'hidden',
    totalHours: 'hidden',
    equipmentUsed: 'optional',
    estimatedCost: 'hidden',
    costItems: 'hidden',
    trainingInfo: 'hidden',
    documentChecklist: 'optional',
    notes: 'optional',
    docLink: 'optional',
  },
  VISIT: {
    subject: 'required',
    dates: 'required',
    references: 'optional',
    objective: 'required',
    details: 'optional',
    location: 'required',
    customerName: 'hidden',
    schedule: 'required',
    times: 'hidden',
    totalHours: 'hidden',
    equipmentUsed: 'optional',
    estimatedCost: 'optional',
    costItems: 'hidden',
    trainingInfo: 'hidden',
    documentChecklist: 'hidden',
    notes: 'optional',
    docLink: 'optional',
  },
}

export function isShown(rule: FieldRule | undefined): rule is 'required' | 'optional' {
  return rule === 'required' || rule === 'optional'
}

// Rules for the form being filled. Old-code docs get GENERAL's field set with
// only the subject and dates required: forcing a location onto an
// already-filed request would block re-saving it for a field it never had.
// Dates stay required — an old doc whose startDate is empty must get one.
export function getFieldRules(formType: FormType, legacy: boolean): FieldRules {
  if (!legacy) return FIELDS_BY_TYPE[ACTIVITY_TYPES[formType].code]
  return Object.fromEntries(
    Object.entries(FIELDS_BY_TYPE.GENERAL).map(([key, rule]) => [
      key,
      key !== 'subject' && key !== 'dates' && rule === 'required' ? 'optional' : rule,
    ]),
  ) as FieldRules
}

// ── Approvers ────────────────────────────────────────────────────────────────

export type OffsiteApproverRole = 'departmentHead' | 'hr' | 'manager'

// LPB requesters normally go departmentHead → hr → manager; these types skip
// hr. Non-LPB requesters are always departmentHead → hr.
const LPB_APPROVERS_BY_TYPE: Partial<Record<ActivityCode, OffsiteApproverRole[]>> = {
  AUDIT: ['departmentHead', 'manager'],
}

export function getRequiredApprovers(code: ActivityCode, lpb: boolean): OffsiteApproverRole[] {
  if (!lpb) return ['departmentHead', 'hr']
  return LPB_APPROVERS_BY_TYPE[code] ?? ['departmentHead', 'hr', 'manager']
}

// ── Dates ────────────────────────────────────────────────────────────────────

export type DateMode = 'single' | 'range'

// How an existing doc opens: equal dates (or none at all, from the old
// typed-date bug) → single; two different dates → range.
export function dateModeFromDoc(doc?: { startDate?: string; endDate?: string }): DateMode {
  return doc?.startDate && doc.endDate && doc.endDate !== doc.startDate ? 'range' : 'single'
}

// Calendar days from start to end, both included, weekends counted.
// "2026-09-13".."2026-09-18" → 6; a single day → 1.
export function calcDurationDays(startDate: string, endDate: string): number {
  return differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1
}

// Doc keys the config controls, and the field each belongs to. On edit, keys
// the chosen type hides are deleted so a type switch leaves nothing behind —
// except on old-code docs, whose values in hidden fields are left untouched.
export const DOC_KEY_FIELD = {
  references: 'references',
  objective: 'objective',
  details: 'details',
  location: 'location',
  customerName: 'customerName',
  scheduleDetails: 'schedule',
  startTime: 'times',
  endTime: 'times',
  totalHours: 'totalHours',
  equipmentUsed: 'equipmentUsed',
  estimatedCost: 'estimatedCost',
  costItems: 'costItems',
  exchangeRate: 'costItems',
  costTotals: 'costItems',
  organizer: 'trainingInfo',
  registrationDeadline: 'trainingInfo',
  coordinators: 'trainingInfo',
  documentChecklist: 'documentChecklist',
  notes: 'notes',
} as const satisfies Record<string, FieldKey>

export type ContentDocKey = keyof typeof DOC_KEY_FIELD
export const CONTENT_DOC_KEYS = Object.keys(DOC_KEY_FIELD) as ContentDocKey[]

// ── Calculations ─────────────────────────────────────────────────────────────

function parseHHmm(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

// Hours between two "HH:mm" times, to 2 decimals. Null when either is
// missing/invalid or the end isn't after the start (no overnight shifts).
export function calcTotalHours(startTime: string, endTime: string): number | null {
  const start = parseHHmm(startTime)
  const end = parseHHmm(endTime)
  if (start === null || end === null || end <= start) return null
  return Math.round(((end - start) / 60) * 100) / 100
}

export function computeCostTotals(
  items: Pick<CostItem, 'lak' | 'usd'>[],
  lakPerUsd: number,
): CostTotals {
  const lak = items.reduce((sum, i) => sum + (i.lak ?? 0), 0)
  const usd = items.reduce((sum, i) => sum + (i.usd ?? 0), 0)
  const usdConvertedToLak = Math.round(usd * (lakPerUsd || 0))
  return { lak, usd, usdConvertedToLak, grandTotalLak: lak + usdConvertedToLak }
}

// ── Payload ──────────────────────────────────────────────────────────────────

// Form-side shape of a cost row: one amount plus which currency it's in.
export interface CostRowInput {
  item: string
  currency: 'lak' | 'usd'
  amount: string
  remark: string
}

export interface ChecklistGroupInput {
  group: string
  items: { item: string; remark: string }[]
}

export interface TypeFieldValues {
  location: string
  details: string
  customerName: string
  startTime: string
  endTime: string
  totalHours: string
  estimatedCost: string
  costRows: CostRowInput[]
  lakPerUsd: string
  organizer: string
  registrationDeadline: string
  coordinators: { name: string; phone: string }[]
  documentChecklist: ChecklistGroupInput[]
  notes: string[]
}

function toNumber(value: string): number | null {
  const n = Number(value.replace(/,/g, '').trim())
  return value.trim() !== '' && Number.isFinite(n) ? n : null
}

export function toCostItems(rows: CostRowInput[]): CostItem[] {
  return rows
    .filter((r) => r.item.trim() || r.amount.trim())
    .map((r, i) => {
      const amount = toNumber(r.amount)
      return {
        no: i + 1,
        item: r.item.trim(),
        lak: r.currency === 'lak' ? amount : null,
        usd: r.currency === 'usd' ? amount : null,
        ...(r.remark.trim() ? { remark: r.remark.trim() } : {}),
      }
    })
}

// Cost figures for a training form. With cost rows, estimatedCost is the
// computed grand total; without, it's whatever the user typed.
export function resolveTrainingCost(values: Pick<TypeFieldValues, 'costRows' | 'lakPerUsd' | 'estimatedCost'>) {
  const costItems = toCostItems(values.costRows)
  if (costItems.length === 0) {
    return { costItems, exchangeRate: null, costTotals: null, estimatedCost: toNumber(values.estimatedCost) }
  }
  const lakPerUsd = toNumber(values.lakPerUsd) ?? 0
  const costTotals = computeCostTotals(costItems, lakPerUsd)
  return {
    costItems,
    exchangeRate: costTotals.usd > 0 ? { lakPerUsd } : null,
    costTotals,
    estimatedCost: costTotals.grandTotalLak,
  }
}

// Fields that predate the 4-type form. They follow the config too now.
export interface CoreFieldValues {
  references: string[]
  objective: string
  scheduleDetails: WorkOutsideRecord['scheduleDetails']
  equipmentUsed: string
}

export type ContentFields = Partial<Pick<WorkOutsideRecord, ContentDocKey>>

type TextKey = 'location' | 'details' | 'customerName' | 'startTime' | 'endTime' | 'organizer' | 'registrationDeadline'

// The content fields to write: only fields the rules show. The original four
// are written as before when shown (empty string / array included); the newer
// ones only when they have a value.
export function buildContentFields(
  rules: FieldRules,
  values: TypeFieldValues,
  core: CoreFieldValues,
): ContentFields {
  const out: ContentFields = {}
  const text = (key: TextKey, v: string) => {
    if (v.trim()) out[key] = v.trim()
  }

  if (isShown(rules.references)) out.references = core.references.filter((r) => r.trim())
  if (isShown(rules.objective)) out.objective = core.objective
  if (isShown(rules.schedule)) out.scheduleDetails = core.scheduleDetails
  if (isShown(rules.equipmentUsed)) out.equipmentUsed = core.equipmentUsed

  if (isShown(rules.location)) text('location', values.location)
  if (isShown(rules.details)) text('details', values.details)
  if (isShown(rules.customerName)) text('customerName', values.customerName)
  if (isShown(rules.times)) {
    text('startTime', values.startTime)
    text('endTime', values.endTime)
  }
  if (isShown(rules.totalHours)) {
    const hours = toNumber(values.totalHours)
    if (hours !== null) out.totalHours = hours
  }

  if (isShown(rules.costItems)) {
    const cost = resolveTrainingCost(values)
    if (cost.costItems.length > 0) out.costItems = cost.costItems
    if (cost.exchangeRate) out.exchangeRate = cost.exchangeRate
    if (cost.costTotals) out.costTotals = cost.costTotals
    if (isShown(rules.estimatedCost) && cost.estimatedCost !== null) {
      out.estimatedCost = cost.estimatedCost
    }
  } else if (isShown(rules.estimatedCost)) {
    const cost = toNumber(values.estimatedCost)
    if (cost !== null) out.estimatedCost = cost
  }

  if (isShown(rules.trainingInfo)) {
    text('organizer', values.organizer)
    text('registrationDeadline', values.registrationDeadline)
    const coordinators = values.coordinators
      .map((c) => ({ name: c.name.trim(), phone: c.phone.trim() }))
      .filter((c) => c.name || c.phone)
    if (coordinators.length > 0) out.coordinators = coordinators
  }

  if (isShown(rules.documentChecklist)) {
    const groups = values.documentChecklist
      .map((g) => ({
        group: g.group.trim(),
        items: g.items
          .filter((it) => it.item.trim())
          .map((it, i) => ({
            no: i + 1,
            item: it.item.trim(),
            ...(it.remark.trim() ? { remark: it.remark.trim() } : {}),
          })),
      }))
      .filter((g) => g.group || g.items.length > 0)
    if (groups.length > 0) out.documentChecklist = groups
  }

  if (isShown(rules.notes)) {
    const notes = values.notes.map((n) => n.trim()).filter(Boolean)
    if (notes.length > 0) out.notes = notes
  }

  return out
}

// Content keys an edit should delete: ones the doc has but this save doesn't
// write. On an old-code doc, keys GENERAL hides are left as they are.
export function contentKeysToDelete(
  rules: FieldRules,
  legacy: boolean,
  written: object,
  doc: Partial<Record<ContentDocKey, unknown>>,
): ContentDocKey[] {
  return CONTENT_DOC_KEYS.filter(
    (key) =>
      !(key in written) &&
      doc[key] !== undefined &&
      !(legacy && rules[DOC_KEY_FIELD[key]] === 'hidden'),
  )
}

// Form values for a saved doc (edit mode), or blanks for a new request.
export function typeFieldValuesFromDoc(doc?: Partial<WorkOutsideRecord>): TypeFieldValues {
  return {
    location: doc?.location ?? '',
    details: doc?.details ?? '',
    customerName: doc?.customerName ?? '',
    startTime: doc?.startTime ?? '',
    endTime: doc?.endTime ?? '',
    totalHours: doc?.totalHours != null ? String(doc.totalHours) : '',
    estimatedCost: doc?.estimatedCost != null ? String(doc.estimatedCost) : '',
    costRows: (doc?.costItems ?? []).map((c) => ({
      item: c.item ?? '',
      currency: c.usd != null ? 'usd' : 'lak',
      amount: String((c.usd != null ? c.usd : c.lak) ?? ''),
      remark: c.remark ?? '',
    })),
    lakPerUsd: doc?.exchangeRate?.lakPerUsd != null ? String(doc.exchangeRate.lakPerUsd) : '',
    organizer: doc?.organizer ?? '',
    registrationDeadline: doc?.registrationDeadline ?? '',
    coordinators: (doc?.coordinators ?? []).map((c) => ({ name: c.name ?? '', phone: c.phone ?? '' })),
    documentChecklist: (doc?.documentChecklist ?? []).map((g) => ({
      group: g.group ?? '',
      items: (g.items ?? []).map((it) => ({ item: it.item ?? '', remark: it.remark ?? '' })),
    })),
    notes: doc?.notes ?? [],
  }
}

export function formatLak(n: number): string {
  return `${n.toLocaleString('en-US')} ກີບ`
}

export function formatUsd(n: number): string {
  return `${n.toLocaleString('en-US')} USD`
}
