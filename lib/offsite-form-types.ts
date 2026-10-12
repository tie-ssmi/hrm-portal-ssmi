// Pure definitions for the 4-type workOutside form — no React, no Firestore.
// The form, its review step, the badges/filters and both detail pages read the
// type table and field rules from here so they can't drift apart.

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
}

export const FORM_TYPES: FormType[] = ['workOutside', 'overtime', 'training', 'audit']

export const LEGACY_ACTIVITY_CODES: LegacyActivityCode[] = [
  'MEET_CLIENT',
  'MEETING',
  'BOOTH',
  'PROMO',
  'OTHERS',
]

// Filter dropdowns list the current 4 first, then the old codes so old
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

export type TypeField =
  | 'location'
  | 'details'
  | 'customerName'
  | 'times' // startTime + endTime
  | 'totalHours'
  | 'estimatedCost'
  | 'costItems' // costItems + exchangeRate + costTotals
  | 'trainingInfo' // organizer + registrationDeadline + coordinators
  | 'documentChecklist'
  | 'notes'
  | 'schedule'

export type FieldRule = 'required' | 'optional'

// Absent key = field not shown for that type and never written to the doc.
export const FIELD_RULES: Record<FormType, Partial<Record<TypeField, FieldRule>>> = {
  workOutside: {
    location: 'required',
    details: 'optional',
    customerName: 'optional',
    times: 'optional',
    estimatedCost: 'optional',
    notes: 'optional',
    schedule: 'optional',
  },
  overtime: {
    location: 'optional',
    details: 'optional',
    times: 'required',
    totalHours: 'required',
    notes: 'optional',
    schedule: 'optional',
  },
  training: {
    location: 'required',
    details: 'optional',
    estimatedCost: 'required',
    costItems: 'optional',
    trainingInfo: 'optional',
    notes: 'optional',
    schedule: 'required',
  },
  audit: {
    location: 'required',
    details: 'optional',
    documentChecklist: 'optional',
    notes: 'optional',
    schedule: 'required',
  },
}

// Rules for a given form. Old-code docs get the general field set, but nothing
// on it is required: forcing a location onto an already-filed request would
// block re-saving it for a field it never had.
export function getFieldRules(
  formType: FormType,
  legacy: boolean,
): Partial<Record<TypeField, FieldRule>> {
  const rules = FIELD_RULES[formType]
  if (!legacy) return rules
  return Object.fromEntries(Object.keys(rules).map((k) => [k, 'optional'])) as Partial<
    Record<TypeField, FieldRule>
  >
}

// Every doc key a type-specific field can write. On edit, the keys the chosen
// type doesn't show are deleted so switching type leaves nothing behind.
export const TYPE_SPECIFIC_DOC_KEYS = [
  'location',
  'details',
  'customerName',
  'startTime',
  'endTime',
  'totalHours',
  'estimatedCost',
  'costItems',
  'exchangeRate',
  'costTotals',
  'organizer',
  'registrationDeadline',
  'coordinators',
  'documentChecklist',
  'notes',
] as const

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

// The type-specific doc fields for one form type: only fields that type shows,
// and only those with a value. Fields left out of the result are, on edit,
// deleted from the doc (see TYPE_SPECIFIC_DOC_KEYS).
export type TypeFields = Partial<Pick<WorkOutsideRecord, (typeof TYPE_SPECIFIC_DOC_KEYS)[number]>>

type TextKey = 'location' | 'details' | 'customerName' | 'startTime' | 'endTime' | 'organizer' | 'registrationDeadline'

export function buildTypeFields(formType: FormType, values: TypeFieldValues): TypeFields {
  const rules = FIELD_RULES[formType]
  const out: TypeFields = {}
  const text = (key: TextKey, v: string) => {
    if (v.trim()) out[key] = v.trim()
  }

  if (rules.location) text('location', values.location)
  if (rules.details) text('details', values.details)
  if (rules.customerName) text('customerName', values.customerName)
  if (rules.times) {
    text('startTime', values.startTime)
    text('endTime', values.endTime)
  }
  if (rules.totalHours) {
    const hours = toNumber(values.totalHours)
    if (hours !== null) out.totalHours = hours
  }

  if (rules.costItems) {
    const cost = resolveTrainingCost(values)
    if (cost.costItems.length > 0) out.costItems = cost.costItems
    if (cost.exchangeRate) out.exchangeRate = cost.exchangeRate
    if (cost.costTotals) out.costTotals = cost.costTotals
    if (cost.estimatedCost !== null) out.estimatedCost = cost.estimatedCost
  } else if (rules.estimatedCost) {
    const cost = toNumber(values.estimatedCost)
    if (cost !== null) out.estimatedCost = cost
  }

  if (rules.trainingInfo) {
    text('organizer', values.organizer)
    text('registrationDeadline', values.registrationDeadline)
    const coordinators = values.coordinators
      .map((c) => ({ name: c.name.trim(), phone: c.phone.trim() }))
      .filter((c) => c.name || c.phone)
    if (coordinators.length > 0) out.coordinators = coordinators
  }

  if (rules.documentChecklist) {
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

  if (rules.notes) {
    const notes = values.notes.map((n) => n.trim()).filter(Boolean)
    if (notes.length > 0) out.notes = notes
  }

  return out
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
