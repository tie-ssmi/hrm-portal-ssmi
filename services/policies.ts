import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { LeavePolicy, LeaveRequest, PolicyRecord } from '@/lib/types'

const LEAVE_TYPE_ALIASES: Record<string, LeaveRequest['type']> = {
  annual: 'annual',
  annualleave: 'annual',
  annual_leave: 'annual',
  sick: 'sick',
  sickleave: 'sick',
  sick_leave: 'sick',
  personal: 'personal',
  personalleave: 'personal',
  personal_leave: 'personal',
  unpaid: 'unpaid',
  unpaidleave: 'unpaid',
  unpaid_leave: 'unpaid',
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function parseLeavePolicy(data: Record<string, unknown>): LeavePolicy {
  const leaveBalance = (data.leaveBalance ?? data.leavePolicy) as Record<string, unknown> | undefined

  return {
    annual: toNumber(leaveBalance?.annual ?? data.annualLeave ?? data.annual, 15),
    sick: toNumber(leaveBalance?.sick ?? data.sickLeave ?? data.sick, 10),
    personal: toNumber(leaveBalance?.personal ?? data.personalLeave ?? data.personal, 5),
  }
}

function normalizeValue(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function parsePolicyType(data: Record<string, unknown>): LeaveRequest['type'] | undefined {
  const candidates = [data.type, data.leaveType, data.name, data.code]

  for (const candidate of candidates) {
    const normalized = normalizeValue(candidate).replace(/\s+/g, '').replace(/-/g, '_')
    const mapped = LEAVE_TYPE_ALIASES[normalized] ?? LEAVE_TYPE_ALIASES[normalized.replace(/_/g, '')]
    if (mapped) {
      return mapped
    }
  }

  return undefined
}

function toPolicyRecord(id: string, data: Record<string, unknown>): PolicyRecord {
  const role = typeof data.role === 'string' ? data.role : data.role === null ? null : undefined
  const businessId =
    typeof data.id === 'string'
      ? data.id
      : typeof data.uuid === 'string'
        ? data.uuid
        : id
  const name =
    typeof data.name === 'string'
      ? data.name
      : typeof data.leaveType === 'string'
        ? data.leaveType
        : typeof data.type === 'string'
          ? data.type
          : undefined
  const parsedType = parsePolicyType(data)
  const requestType = parsedType ?? name ?? businessId

  const docReq = data.documentRequired
  const documentRequired: 'yes' | 'option' | 'no' | undefined =
    docReq === 'yes' || docReq === 'option' || docReq === 'no' ? docReq : undefined

  return {
    id: businessId,
    uuid: id,
    role,
    name,
    description: typeof data.description === 'string' ? data.description : undefined,
    note: typeof data.note === 'string' ? data.note : undefined,
    days: toOptionalNumber(data.days),
    limitDay: toOptionalNumber(data.limitDay),
    limitType: typeof data.limitType === 'string' ? data.limitType : undefined,
    requestType,
    leavePolicy: parseLeavePolicy(data),
    documentRequired,
  }
}

export async function fetchPolicyByUuid(uuid: string): Promise<PolicyRecord | null> {
  try {
    const policiesRef = collection(db, 'policies')
    const q = query(policiesRef, where('uuid', '==', uuid), limit(1))
    const snapshot = await getDocs(q)

    if (snapshot.empty) return null

    const policyDoc = snapshot.docs[0]
    const data = policyDoc.data() as Record<string, unknown>

    return toPolicyRecord(policyDoc.id, data)
  } catch (error) {
    console.error('Error fetching policy by uuid:', error)
    return null
  }
}

export async function fetchPoliciesForGender(gender?: string | null): Promise<PolicyRecord[]> {
  try {
    const policiesRef = collection(db, 'policies')
    const snapshot = await getDocs(policiesRef)
    const normalizedGender = normalizeValue(gender)

    return snapshot.docs
      .map((docSnapshot) => toPolicyRecord(docSnapshot.id, docSnapshot.data() as Record<string, unknown>))
      .filter((policy) => {
        const normalizedRole = normalizeValue(policy.role)
        return normalizedRole === '' || normalizedRole === normalizedGender
      })
  } catch (error) {
    console.error('Error fetching policies for gender:', error)
    return []
  }
}
