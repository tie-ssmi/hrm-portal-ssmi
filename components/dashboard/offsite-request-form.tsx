'use client'

// ** core
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'

// ** assets / icons
import {
  Handshake,
  Users,
  Store,
  Megaphone,
  BookOpen,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Send,
  X,
  Check,
  UserPlus,
  Pencil,
  Plus,
  Car,
} from 'lucide-react'

// ** shared components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'

// ** third party
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, isWeekend, parseISO } from 'date-fns'
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
} from 'firebase/firestore'

// ** config / utils / types / hooks
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import type {
  ActivityCode,
  RoleInTrip,
  TeammateEntry,
  EmployeeDoc,
  Department,
  WorkLocation,
  OffsiteRequestDoc,
} from '@/types/workOutside'
import { LAO_PROVINCES } from '@/public/data/laos-provinces'

// ** services
import { fetchOfficialHolidays } from '@/services/officialHolidays'

// ─── Constants ───────────────────────────────────────────────────────────────

const ACTIVITIES = [
  {
    code: 'MEET_CLIENT' as ActivityCode,
    Icon: Handshake,
    nameLo: 'ໂຄສະນາພາຍນອກ',
    nameEn: 'Meet Client',
    desc: 'ນຳສະເໜີ ຫຼື ປະສານງານກັບລູກຄ້າ',
  },
  {
    code: 'MEETING' as ActivityCode,
    Icon: Users,
    nameLo: 'ປະຊຸມພາຍນອກ',
    nameEn: 'External Meeting',
    desc: 'ປະຊຸມນອກສຳນັກງານ',
  },
  {
    code: 'BOOTH' as ActivityCode,
    Icon: Store,
    nameLo: 'ອອກບູດງານ',
    nameEn: 'Booth Exhibition',
    desc: 'ນຳສະເໜີຜະລິດຕະພັນໃນງານ',
  },
  {
    code: 'PROMO' as ActivityCode,
    Icon: Megaphone,
    nameLo: 'ໂປຣໂມຊັນ',
    nameEn: 'Promotion',
    desc: 'ໂຄສະນາ ແລະ ການຕະຫຼາດ',
  },
  {
    code: 'TRAINING' as ActivityCode,
    Icon: BookOpen,
    nameLo: 'ຝຶກອົບຮົມ',
    nameEn: 'Training',
    desc: 'ສຳມະນາ ແລະ ການອົບຮົມ',
  },
  {
    code: 'OTHERS' as ActivityCode,
    Icon: Plus,
    nameLo: 'ອື່ນໆ',
    nameEn: 'Others',
    desc: 'ກິດຈະກຳອື່ນໆ ທີ່ບໍ່ໄດ້ກໍານົດຂ້າງເທິງ',
  },
] as const

const ROLE_OPTIONS: RoleInTrip[] = ['Lead', 'Support', 'Presenter', 'Coordinator', 'Observer']
const CUSTOMER_REQUIRED_TYPES: ActivityCode[] = ['MEET_CLIENT', 'MEETING', 'BOOTH']

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onSuccess?: () => void
  onDirtyChange?: (dirty: boolean) => void
  initialData?: OffsiteRequestDoc
}

// ─── Small helpers ────────────────────────────────────────────────────────────


function StepIndicator({ current }: { current: number }) {
  const steps = ['ປະເພດກິດຈະກຳ', 'ລາຍລະອຽດ', 'ທີມ & ກວດສອບ']
  return (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((label, i) => {
        const s = i + 1
        const done = s < current
        const active = s === current
        return (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                  active && 'bg-primary text-primary-foreground',
                  done && 'bg-primary/20 text-primary',
                  !active && !done && 'bg-muted text-muted-foreground',
                )}
              >
                {done ? <Check className="w-4 h-4" /> : s}
              </div>
              <span
                className={cn(
                  'text-xs hidden sm:block whitespace-nowrap',
                  active ? 'text-foreground font-medium' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </div>
            {s < 3 && (
              <div
                className={cn('flex-1 h-0.5 mb-4', done ? 'bg-primary/50' : 'bg-muted')}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

function DatePickerButton({
  value,
  onSelect,
  placeholder,
  minDate,
}: {
  value: Date | undefined
  onSelect: (d: Date | undefined) => void
  placeholder: string
  minDate?: Date
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {value ? format(value, 'dd/MM/yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            onSelect(d)
            setOpen(false)
          }}
          disabled={minDate ? (d) => d < minDate : undefined}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

function formatThousands(val: string) {
  const digits = val.replace(/\D/g, '')
  return digits ? Number(digits).toLocaleString('en-US') : ''
}

// Firestore rejects undefined values — strip them via JSON round-trip
function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T
}

// photoUrl can be stored as string, null, or { uid: { profileImage: url } } (legacy bug)
function resolvePhotoUrl(raw: unknown): string | undefined {
  if (!raw || typeof raw === 'boolean') return undefined
  if (typeof raw === 'string') return raw
  if (typeof raw === 'object') {
    const values = Object.values(raw as Record<string, unknown>)
    for (const v of values) {
      if (typeof v === 'string') return v
      if (v && typeof v === 'object') {
        const inner = (v as Record<string, unknown>).profileImage
        if (typeof inner === 'string') return inner
      }
    }
  }
  return undefined
}

function generateRequestNo(): string {
  const now = new Date()
  const year = now.getFullYear()
  // base36 last-6 chars of epoch ms — unique per ms, no Firestore read needed
  const suffix = now.getTime().toString(36).slice(-6).toUpperCase()
  return `WO-${year}-${suffix}`
}

type VehicleDoc = {
  nameLocation: string
  typeVehicle: string
  vehicleName: string
  workLocationUid: string
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OffsiteRequestForm({ onSuccess, onDirtyChange, initialData }: Props) {
  const { user } = useAuth()
  const isEditMode = !!initialData

  // ── step ──
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scrollable = containerRef.current?.closest('[data-slot="dialog-content"]')
    scrollable?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  // ── step 1 ──
  const [activityCode, setActivityCode] = useState<ActivityCode | null>(
    () => initialData?.activityType.code ?? null,
  )

  // ── step 2 ──
  const [subject, setSubject] = useState(() => initialData?.subject ?? '')
  const [details, setDetails] = useState(() => initialData?.details ?? '')
  const [customerName, setCustomerName] = useState(() => initialData?.customerName ?? '')
  const [provinceId, setProvinceId] = useState(() => {
    if (!initialData?.workLocationUid) return ''
    return LAO_PROVINCES.find((p) =>
      p.districts.some((d) => d.id === initialData.workLocationUid),
    )?.id ?? ''
  })
  const [districtId, setDistrictId] = useState(() => initialData?.workLocationUid ?? '')
  const [startDate, setStartDate] = useState<Date | undefined>(
    () => (initialData?.startDate ? parseISO(initialData.startDate) : undefined),
  )
  const [endDate, setEndDate] = useState<Date | undefined>(
    () => (initialData?.endDate ? parseISO(initialData.endDate) : undefined),
  )
  const [costDisplay, setCostDisplay] = useState(
    () => (initialData ? initialData.estimatedCost.toLocaleString('en-US') : '0'),
  )

  // ── step 3 ──
  const [teammates, setTeammates] = useState<TeammateEntry[]>(() => initialData?.teammate ?? [])
  const [teammateSearchOpen, setTeammateSearchOpen] = useState(false)

  // ── validation errors ──
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})

  // ── dirty tracking ──
  const markDirty = useCallback(() => onDirtyChange?.(true), [onDirtyChange])
  useEffect(() => {
    if (activityCode !== null) markDirty()
  }, [activityCode, markDirty])
  useEffect(() => {
    if (subject || details || customerName || districtId || startDate || endDate || costDisplay) markDirty()
  }, [subject, details, customerName, districtId, startDate, endDate, costDisplay, markDirty])

  // ─── Firestore queries ──────────────────────────────────────────────────────

  // workLocation can be string (legacy uuid) or WorkLocationInfo object
  const workLocationUuid =
    typeof user?.workLocation === 'object'
      ? user.workLocation?.uuid
      : user?.workLocation ?? undefined

  const { data: employeesList = [] } = useQuery<EmployeeDoc[]>({
    queryKey: ['employees-all', workLocationUuid],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'employees'))
      return snap.docs
        .map((d) => d.data() as EmployeeDoc)
        .filter((e) => {
          if (e.status === 'delete') return false
          if (!workLocationUuid) return true
          const empLocationUuid =
            typeof e.workLocation === 'object'
              ? e.workLocation?.uuid
              : e.workLocation ?? e.workLocationUid
          return empLocationUuid === workLocationUuid
        })
    },
    enabled: !!user,
  })

  const { data: vehiclesList = [] } = useQuery<VehicleDoc[]>({
    queryKey: ['vehicles-all', workLocationUuid],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'vehicles'))
      return snap.docs
        .map((d) => d.data() as VehicleDoc)
        .filter((v) => v.workLocationUid === workLocationUuid)
    },
    enabled: !!user,
  })

  // ─── Derived ────────────────────────────────────────────────────────────────

  const activityMeta = useMemo(() => ACTIVITIES.find((a) => a.code === activityCode), [activityCode])

  const { data: officialHolidays = [] } = useQuery({
    queryKey: ['officialHolidays'],
    queryFn: fetchOfficialHolidays,
    staleTime: 24 * 60 * 60 * 1000,
  })

  const holidaySet = useMemo(
    () => new Set(officialHolidays.map((h) => h.date)),
    [officialHolidays],
  )

  const durationDays = useMemo(() => {
    if (!startDate || !endDate) return 0
    const start = new Date(startDate)
    const end = new Date(endDate)
    start.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)
    if (start > end) return 0
    let count = 0
    const cursor = new Date(start)
    while (cursor <= end) {
      const dateKey = format(cursor, 'yyyy-MM-dd')
      if (!isWeekend(cursor) && !holidaySet.has(dateKey)) count++
      cursor.setDate(cursor.getDate() + 1)
    }
    return count
  }, [startDate, endDate, holidaySet])

  const selectedProvince = useMemo(
    () => LAO_PROVINCES.find((p) => p.id === provinceId),
    [provinceId],
  )
  const selectedDistrict = useMemo(
    () => selectedProvince?.districts.find((d) => d.id === districtId),
    [selectedProvince, districtId],
  )
  const locationDisplay = selectedProvince && selectedDistrict
    ? `${selectedProvince.name} - ${selectedDistrict.name}`
    : ''

  const needsCustomer = activityCode ? CUSTOMER_REQUIRED_TYPES.includes(activityCode) : false

  // ─── Validation ─────────────────────────────────────────────────────────────

  function validateStep2() {
    const e: Partial<Record<string, string>> = {}
    if (!subject.trim()) e.subject = 'ກະລຸນາໃສ່ຫົວຂໍ້'
    if (!details.trim()) e.details = 'ກະລຸນາໃສ່ລາຍລະອຽດ'
    if (needsCustomer && !customerName.trim()) e.customerName = 'ກະລຸນາເລືອກລົດ'
    if (!provinceId) e.provinceId = 'ກະລຸນາເລືອກແຂວງ'
    if (!districtId) e.districtId = 'ກະລຸນາເລືອກເມືອງ'
    if (!startDate) e.startDate = 'ກະລຸນາເລືອກວັນທີເລີ່ມ'
    if (!endDate) e.endDate = 'ກະລຸນາເລືອກວັນທີສິ້ນສຸດ'
    if (startDate && endDate && endDate < startDate) e.endDate = 'ວັນທີສິ້ນສຸດຕ້ອງຫຼັງວັນທີເລີ່ມ'
    if (!costDisplay) e.estimatedCost = 'ກະລຸນາໃສ່ຄ່າໃຊ້ຈ່າຍ'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ─── Teammate helpers ────────────────────────────────────────────────────────

  function addTeammate(emp: EmployeeDoc) {
    if (teammates.some((t) => t.uid === emp.uid)) return
    markDirty()
    setTeammates((prev) => [
      ...prev,
      {
        uid: emp.uid,
        fullNameEn: `${emp.firstNameEn} ${emp.lastNameEn}`,
        fullNameLo: `${emp.firstNameLo} ${emp.lastNameLo}`,
        email: emp.email,
        jobTitle: emp.jobTitle,
        department: emp.department,
        roleInTrip: 'Support',
        photoUrl: resolvePhotoUrl(emp.profileImage) ?? resolvePhotoUrl(emp.photo3x4Url),
      },
    ])
    setTeammateSearchOpen(false)
  }

  function removeTeammate(uid: string) {
    setTeammates((prev) => prev.filter((t) => t.uid !== uid))
  }

  function updateRole(uid: string, role: RoleInTrip) {
    setTeammates((prev) => prev.map((t) => (t.uid === uid ? { ...t, roleInTrip: role } : t)))
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────

  function resetForm() {
    setStep(1)
    setActivityCode(null)
    setSubject('')
    setDetails('')
    setCustomerName('')
    setProvinceId('')
    setDistrictId('')
    setStartDate(undefined)
    setEndDate(undefined)
    setCostDisplay('0')
    setTeammates([])
    setErrors({})
    onDirtyChange?.(false)
  }

  async function handleSubmit() {
    if (!user) return
    setIsSubmitting(true)
    try {
      const activity = activityMeta!
      const now = new Date().toISOString()
      const monthKey = format(startDate!, 'MM-yyyy')
      const estimatedCost = Number(costDisplay.replace(/,/g, ''))

      const requesterDept: Department =
        typeof user.department === 'object' && user.department !== null
          ? (user.department as Department)
          : { uuid: '', title: String(user.department ?? ''), department: String(user.department ?? '') }

      const requesterLoc: WorkLocation =
        typeof user.workLocation === 'object' && user.workLocation !== null
          ? (user.workLocation as WorkLocation)
          : { uuid: '', code: '', nameLo: String(user.workLocation ?? '') }

      const fullNameEn = `${user.firstNameEn ?? user.firstName ?? ''} ${user.lastNameEn ?? user.lastName ?? ''}`.trim()
      const fullNameLo = `${user.firstNameLo ?? ''} ${user.lastNameLo ?? ''}`.trim()
      const userImage = user.profileImage || user.photo3x4Url

      const participantIds = [...new Set([user.uid, ...teammates.map((t) => t.uid)])]

      const payload = {
        requester: {
          uid: user.uid,
          fullNameEn,
          fullNameLo,
          email: user.email,
          jobTitle: user.jobTitle ?? user.position ?? '',
          department: requesterDept,
          workLocation: requesterLoc,
        },
        activityType: { code: activityCode!, name: activity.nameLo },
        subject,
        details,
        customerName,
        location: locationDisplay,
        workLocationUid: districtId,
        startDate: format(startDate!, 'yyyy-MM-dd'),
        endDate: format(endDate!, 'yyyy-MM-dd'),
        durationDays,
        monthKey,
        estimatedCost,
        teammateTitle: teammates.length,
        teammate: teammates,
        participantIds,
        participantUids: participantIds,
        participantCount: participantIds.length,
        updatedAt: now,
        updatedBy: fullNameEn,
      }

      if (isEditMode && initialData) {
        await updateDoc(doc(db, 'workOutside', initialData.id), stripUndefined(payload))
        toast.success(`ແກ້ໄຂສຳເລັດ — ${initialData.requestNo}`)
      } else {
        const requestNo = generateRequestNo()
        await addDoc(collection(db, 'workOutside'), stripUndefined({
          ...payload,
          requestNo,
          status: 'pending',
          requiredApprovers: ['departmentHead', 'hr', 'manager'],
          approvals: [
            { role: 'departmentHead', decision: 'pending' },
            { role: 'hr', decision: 'pending' },
            { role: 'manager', decision: 'pending' },
          ],
          rejectReason: null,
          createdAt: now,
          createdBy: fullNameEn,
          createdByUid: user.uid,
        }))
        toast.success(`ສົ່ງຄຳຂໍສຳເລັດ — ${requestNo}`)
      }

      onSuccess?.()
      resetForm()
    } catch (err) {
      console.error(err)
      toast.error('ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="space-y-4">
      <StepIndicator current={step} />

      {/* ── Step 1: Activity Type ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">ເລືອກປະເພດກິດຈະກຳ</h2>
            <p className="text-sm text-muted-foreground">ເລືອກປະເພດທີ່ກົງກັບຄຳຂໍຂອງທ່ານ</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ACTIVITIES.map(({ code, Icon, nameLo, nameEn, desc }) => {
              const selected = activityCode === code
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setActivityCode(code)}
                  className={cn(
                    'flex flex-col gap-2 rounded-xl border p-4 text-left transition-all',
                    'hover:border-primary/60 hover:bg-primary/5',
                    selected
                      ? 'border-primary ring-2 ring-primary bg-primary/5'
                      : 'border-border bg-card',
                  )}
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{nameLo}</p>
                    <p className="text-xs text-muted-foreground">{nameEn}</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
                </button>
              )
            })}
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => setStep(2)} disabled={!activityCode}>
              ຕໍ່ໄປ
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Trip Details ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">ລາຍລະອຽດການປະຕິບັດງານ</h2>
            <p className="text-sm text-muted-foreground">
              ປະເພດ:{' '}
              <span className="font-medium text-foreground">{activityMeta?.nameLo}</span>
            </p>
          </div>

          <FieldGroup>
            <Field>
              <FieldLabel>
                ຫົວຂໍ້ <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                placeholder="ຫົວຂໍ້ຂອງການເດີນທາງ..."
              />
              {errors.subject && <FieldError>{errors.subject}</FieldError>}
            </Field>

            <Field>
              <FieldLabel>
                ລາຍລະອຽດ <span className="text-destructive">*</span>
              </FieldLabel>
              <Textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="ອະທິບາຍຈຸດປະສົງ ແລະ ລາຍລະອຽດ..."
              />
              {errors.details && <FieldError>{errors.details}</FieldError>}
            </Field>

            <Field>
              <FieldLabel className="flex items-center gap-1.5">
                <Car className="h-4 w-4" />
                ເລືອກລົດ{' '}
                {needsCustomer ? (
                  <span className="text-destructive">*</span>
                ) : (
                  <span className="text-muted-foreground text-xs">(ທາງເລືອກ)</span>
                )}
              </FieldLabel>
              <Select
                value={customerName}
                onValueChange={(v) => setCustomerName(v)}
              >
                <SelectTrigger className={cn(!customerName && 'text-muted-foreground')}>
                  <SelectValue placeholder="ເລືອກລົດ..." />
                </SelectTrigger>
                <SelectContent>
                  {vehiclesList.map((v) => (
                    <SelectItem key={v.vehicleName} value={v.vehicleName}>
                      <div className="flex flex-col">
                        <span>{v.vehicleName}</span>
                        <span className="text-xs text-muted-foreground">
                          {v.typeVehicle} · {v.nameLocation}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.customerName && <FieldError>{errors.customerName}</FieldError>}
            </Field>

            {/* Province */}
            <Field>
              <FieldLabel>
                ແຂວງ <span className="text-destructive">*</span>
              </FieldLabel>
              <Select
                value={provinceId}
                onValueChange={(v) => {
                  setProvinceId(v)
                  setDistrictId('')
                }}
              >
                <SelectTrigger className={cn(!provinceId && 'text-muted-foreground')}>
                  <SelectValue placeholder="ເລືອກແຂວງ..." />
                </SelectTrigger>
                <SelectContent>
                  {LAO_PROVINCES.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.provinceId && <FieldError>{errors.provinceId}</FieldError>}
            </Field>

            {/* District */}
            <Field>
              <FieldLabel>
                ເມືອງ <span className="text-destructive">*</span>
              </FieldLabel>
              <Select
                value={districtId}
                onValueChange={setDistrictId}
                disabled={!provinceId}
              >
                <SelectTrigger className={cn(!districtId && 'text-muted-foreground')}>
                  <SelectValue placeholder={provinceId ? 'ເລືອກເມືອງ...' : 'ກະລຸນາເລືອກແຂວງກ່ອນ'} />
                </SelectTrigger>
                <SelectContent>
                  {selectedProvince?.districts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      ເມືອງ {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.districtId && <FieldError>{errors.districtId}</FieldError>}
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field>
                <FieldLabel>
                  ວັນທີເລີ່ມ <span className="text-destructive">*</span>
                </FieldLabel>
                <DatePickerButton
                  value={startDate}
                  onSelect={(d) => {
                    setStartDate(d)
                    if (endDate && d && endDate < d) setEndDate(undefined)
                  }}
                  placeholder="ເລືອກວັນທີ..."
                />
                {errors.startDate && <FieldError>{errors.startDate}</FieldError>}
              </Field>

              <Field>
                <FieldLabel>
                  ວັນທີສິ້ນສຸດ <span className="text-destructive">*</span>
                </FieldLabel>
                <DatePickerButton
                  value={endDate}
                  onSelect={setEndDate}
                  placeholder="ເລືອກວັນທີ..."
                  minDate={startDate}
                />
                {errors.endDate && <FieldError>{errors.endDate}</FieldError>}
              </Field>
            </div>

            {startDate && endDate && durationDays > 0 && (
              <p className="text-sm text-muted-foreground -mt-2">
                ໄລຍະເວລາ:{' '}
                <span className="font-medium text-foreground">{durationDays} ມື້</span>
              </p>
            )}

            <Field>
              <FieldLabel>
                ຄ່າໃຊ້ຈ່າຍປະມານ <span className="text-destructive">*</span>
              </FieldLabel>
              <div className="relative">
                <Input
                  value={costDisplay}
                  onChange={(e) => setCostDisplay(formatThousands(e.target.value))}
                  inputMode="numeric"
                  placeholder="0"
                  className="pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  ກີບ
                </span>
              </div>
              {errors.estimatedCost && <FieldError>{errors.estimatedCost}</FieldError>}
            </Field>
          </FieldGroup>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              ກັບຄືນ
            </Button>
            <Button
              onClick={() => {
                if (validateStep2()) setStep(3)
              }}
            >
              ຕໍ່ໄປ
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Teammates + Review ── */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">ສະມາຊິກທີມ</h2>
              <Popover open={teammateSearchOpen} onOpenChange={setTeammateSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <UserPlus className="w-4 h-4 mr-2" />
                    ເພີ່ມສະມາຊິກ
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 overflow-hidden" align="end">
                  <Command>
                    <CommandInput placeholder="ຄົ້ນຫາພະນັກງານ..." />
                    <CommandList className="max-h-56 overflow-y-auto overscroll-contain [touch-action:pan-y]">
                      <CommandEmpty>ບໍ່ພົບຂໍ້ມູນ</CommandEmpty>
                      <CommandGroup>
                        {employeesList
                          .filter((e) => !teammates.some((t) => t.uid === e.uid))
                          .map((emp, idx) => (
                            <CommandItem
                              key={emp.uid || emp.email || idx}
                              value={`${emp.firstNameLo} ${emp.lastNameLo} ${emp.firstNameEn} ${emp.lastNameEn}`}
                              onSelect={() => addTeammate(emp)}
                            >
                              <div className="flex items-center gap-2 w-full min-w-0">
                                <Avatar className="w-8 h-8 shrink-0">
                                  <AvatarImage
                                    src={resolvePhotoUrl(emp.profileImage) ?? resolvePhotoUrl(emp.photo3x4Url)}
                                    alt={`${emp.firstNameLo} ${emp.lastNameLo}`}
                                  />
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                    {`${emp.firstNameLo} ${emp.lastNameLo}`
                                      .split(' ')
                                      .map((w) => w[0])
                                      .join('')
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {emp.firstNameLo} {emp.lastNameLo}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {emp.jobTitle}
                                    {emp.department?.title ? ` · ${emp.department.title}` : ''}
                                  </p>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {teammates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4 rounded-lg border border-dashed">
                ຍັງບໍ່ມີສະມາຊິກ — ກົດ &quot;ເພີ່ມສະມາຊິກ&quot; ເພື່ອເພີ່ມ
              </p>
            ) : (
              <div className="space-y-2">
                {teammates.map((tm) => (
                  <div key={tm.uid || tm.email} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={resolvePhotoUrl(tm.photoUrl)} alt={tm.fullNameLo || tm.fullNameEn} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {(tm.fullNameLo || tm.fullNameEn)
                          .split(' ')
                          .map((w) => w[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tm.fullNameLo}</p>
                      <p className="text-xs text-muted-foreground truncate">{tm.jobTitle}</p>
                    </div>
                    <Select
                      value={tm.roleInTrip}
                      onValueChange={(v) => updateRole(tm.uid, v as RoleInTrip)}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r} value={r} className="text-xs">
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeTeammate(tm.uid)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Review */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">ກວດສອບຂໍ້ມູນ</h2>

            <Card>
              <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">ປະເພດກິດຈະກຳ</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-muted-foreground"
                  onClick={() => setStep(1)}
                >
                  <Pencil className="w-3 h-3" />
                  ແກ້ໄຂ
                </Button>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {activityMeta && (
                  <div className="flex items-center gap-2">
                    <activityMeta.Icon className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm">
                      {activityMeta.nameLo}{' '}
                      <span className="text-muted-foreground">({activityMeta.nameEn})</span>
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">ລາຍລະອຽດ</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-muted-foreground"
                  onClick={() => setStep(2)}
                >
                  <Pencil className="w-3 h-3" />
                  ແກ້ໄຂ
                </Button>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">ຫົວຂໍ້</dt>
                  <dd className="font-medium break-words">{subject || '—'}</dd>

                  <dt className="text-muted-foreground">ລາຍລະອຽດ</dt>
                  <dd className="font-medium break-words line-clamp-2">{details || '—'}</dd>

                  {customerName && (
                    <>
                      <dt className="text-muted-foreground">ລົດ</dt>
                      <dd className="font-medium">{customerName}</dd>
                    </>
                  )}

                  <dt className="text-muted-foreground">ສະຖານທີ່</dt>
                  <dd className="font-medium">{locationDisplay || '—'}</dd>

                  <dt className="text-muted-foreground">ວັນທີ</dt>
                  <dd className="font-medium">
                    {startDate ? format(startDate, 'dd/MM/yyyy') : '—'}
                    {endDate && startDate ? ` – ${format(endDate, 'dd/MM/yyyy')}` : ''}
                  </dd>

                  <dt className="text-muted-foreground">ໄລຍະເວລາ</dt>
                  <dd className="font-medium">{durationDays} ມື້</dd>

                  <dt className="text-muted-foreground">ຄ່າໃຊ້ຈ່າຍ</dt>
                  <dd className="font-medium">{costDisplay || '0'} ກີບ</dd>
                </dl>
              </CardContent>
            </Card>

            {teammates.length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm font-semibold">
                    ສະມາຊິກທີມ ({teammates.length} ຄົນ)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="space-y-1.5">
                    {teammates.map((tm) => (
                      <div key={tm.uid} className="flex items-center justify-between text-sm">
                        <span>{tm.fullNameLo}</span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {tm.roleInTrip}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              ກັບຄືນ
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || teammates.length === 0}>
              {isSubmitting ? (
                <Spinner className="mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {isEditMode ? 'ບັນທຶກການແກ້ໄຂ' : 'ສົ່ງຄຳຂໍ'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
