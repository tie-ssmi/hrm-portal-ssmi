'use client'

// ** core
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

// ** assets / icons
import {
  Calendar as CalendarIcon, Send, Clock, CheckCircle, XCircle,
  Sun, Sunset, User, Users, AlertTriangle, FileText, ArrowRight,
  Upload, Timer, X, ArrowLeft
} from 'lucide-react'

// ** shared components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

// ** third party
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, isWeekend } from 'date-fns'

// ** config / utils / types / hooks
import { useAuth } from '@/lib/auth-context'
import { useHRM } from '@/lib/hrm-context'
import { formatPolicyLimit } from '@/lib/format'
import { cn } from '@/lib/utils'
import { fetchUserRoleId, fetchRoleByUid } from '@/lib/employees'

// ** services
import { getLeaveApproverRuleText, getLeaveRecipientText } from '@/services/leave-approval'
import { fetchWorkLocationType } from '@/services/workLocations'
import { fetchLeavesByUserUuidFromToday } from '@/services/leaves'
import { fetchPoliciesForGender, resolveEmployeePolicyLimit } from '@/services/policies'
import { fetchActiveLegalBasis } from '@/services/legalBasis'
import { fetchCurrentLeaveBalancesV2 } from '@/services/leave-balances'
import { resolveEmployeeEmploymentStatus } from '@/lib/employment-status'
import { uploadAttachment, UploadTruncatedError, UPLOAD_TRUNCATED_MESSAGE } from '@/services/attachment-upload'
import FileUpload from '@/components/fileUpload'
import { getEmployees } from '@/services/employees'
import { fetchOfficialHolidays, buildHolidayDateKeySet } from '@/services/officialHolidays'
import { calcLeaveDuration } from '@/lib/leave-duration'
type Period = 'morning' | 'afternoon'
type LeaveTypeOption = {
  value: string
  requestType: string
  policyUuid: string | undefined
  policyId: string
  policyName: string | undefined
  label: string
  documentRequired?: 'yes' | 'option' | 'no'
  countMode?: 'workingDays' | 'calendarDays'
  // Balance remaining for this policy at render time, before this request's
  // own duration comes off it. Saved on the leave doc as both
  // remainingDaysBeforeRequest and (minus the duration) remainingDaysAfterRequest.
  remainingDays?: number
}

type DocUploadChoice = 'now' | 'later' | 'skip' | null

function formatDuration(d: number): string {
  return d === 0.5 ? '0.5 ວັນ' : d === 1 ? '1 ວັນ' : `${d} ວັນ`
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'approved': return <CheckCircle className="w-3 h-3" />
    case 'rejected': return <XCircle className="w-3 h-3" />
    default: return <Clock className="w-3 h-3" />
  }
}

function getStatusVariant(status: string) {
  switch (status) {
    case 'approved': return 'default' as const
    case 'rejected': return 'destructive' as const
    default: return 'secondary' as const
  }
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'approved': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'rejected': return 'bg-red-100 text-red-700 border-red-200'
    default: return 'bg-amber-100 text-amber-700 border-amber-200'
  }
}

// ຄະນະອຳນວຍການ (C Level) — secretaries can file leave-on-behalf for this
// department in addition to their own, scoped to their own work location.
const CLEVEL_DEPARTMENT_UID = 'bFbgmtSNSdKmTnKKKDM4'

function SectionHeader({ number, icon: Icon, title }: { number: number; icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
        {number}
      </div>
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm font-semibold">{title}</span>
    </div>
  )
}

export default function InsteadLeaveRequestForm() {
  const router = useRouter()
  const { user } = useAuth()
  const { submitLeaveRequest, leaveBalance } = useHRM()
  const loggedInUserUuid = user?.uuid || user?.uid || user?.id || ''
  const departmentUuid = typeof user?.department === 'object' ? user.department?.uuid : undefined
  const workLocationUuid = typeof user?.workLocation === 'object' && user.workLocation !== null
    ? (user.workLocation as { uuid?: string }).uuid
    : undefined

  const [selectedPolicyValue, setSelectedPolicyValue] = useState('annual')
  const [selectedLeaveForUid, setSelectedLeaveForUid] = useState('')
  const [selectedSuccessorUid, setSelectedSuccessorUid] = useState('')
  const [leaveStartDate, setLeaveStartDate] = useState<Date>()
  const [startPeriod, setStartPeriod] = useState<Period>('morning')
  const [leaveEndDate, setLeaveEndDate] = useState<Date>()
  const [endPeriod, setEndPeriod] = useState<Period>('afternoon')
  const [leaveReason, setLeaveReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  // ມອບໝາຍໜ້າທີ່ໃຫ້ຜູ້ຮັບວຽກຕໍ່ — ຄືກັນກັບຟອມລາພັກເອງ
  const [delegateResponsibilities, setDelegateResponsibilities] = useState(false)
  const [delegateDocumentSigning, setDelegateDocumentSigning] = useState(false)
  const [delegateO9Approval, setDelegateO9Approval] = useState(false)
  const [delegateOther, setDelegateOther] = useState(false)
  const [delegateOtherReason, setDelegateOtherReason] = useState('')

  const [docUploadChoice, setDocUploadChoice] = useState<DocUploadChoice>(null)
  const [docFile, setDocFile] = useState<File | null>(null)

  const isHousekeeper = user?.rolePermissions?.housekeeper === true
  const isSecretary = user?.rolePermissions?.secretaty === true
  const isLPB = user?.rolePermissions?.LPB === true
  const filterByDepartment = isHousekeeper || isLPB || isSecretary

  // Secretaries file leave on behalf of their own department plus the C
  // Level department, still scoped to their own work location — an
  // executive at another branch is out of scope.
  const secretaryDepartmentUuids = useMemo(
    () => Array.from(new Set([departmentUuid, CLEVEL_DEPARTMENT_UID].filter(Boolean))) as string[],
    [departmentUuid],
  )

  const { data: employeesData = [] } = useQuery({
    queryKey: [
      'employees',
      isSecretary ? secretaryDepartmentUuids : filterByDepartment ? departmentUuid : null,
      workLocationUuid ?? null,
    ],
    queryFn: () =>
      getEmployees(
        isSecretary
          ? { departmentUuids: secretaryDepartmentUuids, workLocationUuid }
          : { ...(filterByDepartment ? { departmentUuid } : {}), workLocationUuid },
      ),
    enabled: !!workLocationUuid,
  })

  const empKey = (emp: typeof employeesData[number]) => emp.uid || emp.id || ''

  const leaveForOptions = useMemo(
    () => employeesData.filter(emp => empKey(emp) !== loggedInUserUuid),
    [employeesData, loggedInUserUuid]
  )

  const successorOptions = useMemo(
    () => employeesData.filter(emp => empKey(emp) !== selectedLeaveForUid),
    [employeesData, selectedLeaveForUid]
  )

  const selectedLeaveFor = useMemo(
    () => employeesData.find(emp => empKey(emp) === selectedLeaveForUid),
    [employeesData, selectedLeaveForUid]
  )

  const selectedSuccessor = useMemo(
    () => employeesData.find(emp => empKey(emp) === selectedSuccessorUid),
    [employeesData, selectedSuccessorUid]
  )

  // getEmployees() doesn't join rolePermissions (only auth-context does that
  // for the logged-in user) — fetch it separately for whoever is selected as
  // the leave-taker, so the "to" salutation can reflect their own LPB scope
  // rather than the filer's.
  const { data: selectedLeaveForRole } = useQuery({
    queryKey: ['employeeRole', selectedLeaveForUid],
    queryFn: async () => {
      const roleId = await fetchUserRoleId(selectedLeaveForUid)
      return roleId ? fetchRoleByUid(roleId) : null
    },
    enabled: !!selectedLeaveForUid,
  })

  // ທຸກຢ່າງລຸ່ມນີ້ຕ້ອງອີງໃສ່ "ຜູ້ລາພັກ" ບໍ່ແມ່ນ "ຜູ້ຍື່ນແທນ" — ນະໂຍບາຍ, ຍອດວັນລາ,
  // ວັນພັກລັດຖະການ ແລະ ສະຖານະພະນັກງານ ລ້ວນຕ່າງກັນລະຫວ່າງສອງຄົນ.
  const leaveForWorkLocation =
    typeof selectedLeaveFor?.workLocation === 'object' && selectedLeaveFor.workLocation !== null
      ? (selectedLeaveFor.workLocation as { uuid?: string; nameLo?: string })
      : undefined
  const leaveForWorkLocationUuid =
    typeof selectedLeaveFor?.workLocation === 'string'
      ? selectedLeaveFor.workLocation
      : leaveForWorkLocation?.uuid
  const leaveForWorkLocationNameLo = leaveForWorkLocation?.nameLo

  const { data: officialHolidays = [] } = useQuery({
    queryKey: ['officialHolidays'],
    queryFn: fetchOfficialHolidays,
    enabled: !!loggedInUserUuid,
    staleTime: 24 * 60 * 60 * 1000,
  })

  const holidaySet = useMemo(
    () => buildHolidayDateKeySet(officialHolidays, leaveForWorkLocationUuid),
    [officialHolidays, leaveForWorkLocationUuid],
  )

  const employmentStatus = useMemo(
    () => (selectedLeaveFor ? resolveEmployeeEmploymentStatus(selectedLeaveFor) : 'permanent'),
    [selectedLeaveFor],
  )

  const { data: policyRecords = [] } = useQuery({
    queryKey: ['policies', 'leave-types', selectedLeaveFor?.gender ?? null],
    queryFn: () => fetchPoliciesForGender(selectedLeaveFor?.gender),
    enabled: !!selectedLeaveForUid,
  })

  const { data: leaveBalancesV2 = [] } = useQuery({
    queryKey: ['leaveBalanceV2', selectedLeaveForUid],
    queryFn: () => fetchCurrentLeaveBalancesV2(selectedLeaveForUid),
    enabled: !!selectedLeaveForUid,
  })

  const leaveBalanceByPolicyUuid = useMemo(() => {
    const map = new Map<string, (typeof leaveBalancesV2)[number]>()
    for (const b of leaveBalancesV2) {
      if (b.policyUuid) map.set(b.policyUuid, b)
      if (b.policyId) map.set(b.policyId, b)
    }
    return map
  }, [leaveBalancesV2])

  // Regulation clauses printed on the leave doc. Snapshotted onto the request
  // at submit time so a later edit in admin never rewrites a filed request.
  const { data: legalBasis = [] } = useQuery({
    queryKey: ['legalBasis', 'leave'],
    queryFn: () => fetchActiveLegalBasis('leave'),
    staleTime: 24 * 60 * 60 * 1000,
  })

  const {
    data: myCurrentLeaveRequests = [],
    refetch: refetchMyCurrentLeaves,
    error: myCurrentLeavesError,
  } = useQuery({
    queryKey: ['leaves', 'my-current', selectedLeaveForUid],
    queryFn: () => fetchLeavesByUserUuidFromToday(selectedLeaveForUid),
    enabled: !!selectedLeaveForUid,
  })

  const [selectedLeave, setSelectedLeave] = useState<typeof myCurrentLeaveRequests[number] | null>(null)

  const leaveTypeOptions = useMemo(() => {
    // No employee picked yet (or they have no policies): offer the generic
    // types with no day counts. The filer's own balance must never appear
    // here — it belongs to the wrong person.
    const fallback: LeaveTypeOption[] = [
      { value: 'annual', requestType: 'annual', policyUuid: undefined, policyId: '', policyName: 'Annual Leave', label: 'Annual Leave' },
      { value: 'sick', requestType: 'sick', policyUuid: undefined, policyId: '', policyName: 'Sick Leave', label: 'Sick Leave' },
      { value: 'personal', requestType: 'personal', policyUuid: undefined, policyId: '', policyName: 'Personal Leave', label: 'Personal Leave' },
      { value: 'unpaid', requestType: 'unpaid', policyUuid: undefined, policyId: '', policyName: 'Unpaid Leave', label: 'Unpaid Leave' },
    ]
    const seen = new Set<string>()
    const filtered = policyRecords
      .filter((p) => p.requestType)
      .map((p) => {
        const value = p.uuid || p.id
        if (seen.has(value)) return null
        seen.add(value)

        // Employment-status-specific rule gates eligibility, same as the
        // own-leave form — a probationary employee must not be offered a
        // policy they cannot take.
        const limit = resolveEmployeePolicyLimit(p, employmentStatus)
        if (!limit.eligible) return null

        const balance =
          (p.uuid && leaveBalanceByPolicyUuid.get(p.uuid)) ||
          leaveBalanceByPolicyUuid.get(p.id) ||
          undefined
        if (balance) {
          if (balance.remaining <= 0) return null
          return {
            value,
            requestType: p.requestType,
            policyUuid: p.uuid,
            policyId: p.id,
            policyName: p.name,
            label: `${balance.policyName}(${balance.remaining} ວັນ)`,
            documentRequired: p.documentRequired,
            countMode: p.countMode,
            remainingDays: balance.remaining,
          }
        }

        const baseLabel = p.name?.trim() || p.requestType
        const limitLabel = formatPolicyLimit(limit.limitDay, limit.limitType)
        return {
          value,
          requestType: p.requestType,
          policyUuid: p.uuid,
          policyId: p.id,
          policyName: p.name,
          label: limitLabel ? `${baseLabel} (${limitLabel})` : baseLabel,
          documentRequired: p.documentRequired,
          countMode: p.countMode,
          remainingDays: limit.limitDay,
        }
      })
      .filter((o) => o !== null) as LeaveTypeOption[]
    return filtered.length > 0 ? filtered : fallback
  }, [employmentStatus, leaveBalanceByPolicyUuid, policyRecords])

  const selectedPolicy = useMemo(
    () => leaveTypeOptions.find((o) => o.value === selectedPolicyValue) ?? leaveTypeOptions[0],
    [leaveTypeOptions, selectedPolicyValue]
  )

  const documentRequired = useMemo(
    () => selectedPolicy?.documentRequired ?? 'no',
    [selectedPolicy?.documentRequired],
  )

  const duration = useMemo(
    () =>
      calcLeaveDuration({
        startDate: leaveStartDate,
        startPeriod,
        endDate: leaveEndDate,
        endPeriod,
        holidayDateKeys: holidaySet,
        countMode: selectedPolicy?.countMode,
      }),
    [leaveStartDate, startPeriod, leaveEndDate, endPeriod, holidaySet, selectedPolicy?.countMode]
  )

  // calendarDays policies count every day, so weekends and official holidays
  // are pickable; workingDays policies grey them out.
  const isCalendarDays = selectedPolicy?.countMode === 'calendarDays'
  const isNonWorkingDay = (d: Date) =>
    !isCalendarDays && (isWeekend(d) || holidaySet.has(format(d, 'yyyy-MM-dd')))

  const approverRuleText = useMemo(() => getLeaveApproverRuleText(duration), [duration])

  useEffect(() => {
    if (!selectedPolicy || selectedPolicy.value === selectedPolicyValue) return
    setSelectedPolicyValue(selectedPolicy.value)
  }, [selectedPolicy, selectedPolicyValue])

  useEffect(() => {
    if (myCurrentLeavesError) {
      toast.error('Failed to load leave requests')
      console.error(myCurrentLeavesError)
    }
  }, [myCurrentLeavesError])

  const employeeName = (emp: typeof employeesData[number] | undefined) =>
    [emp?.firstNameLo || emp?.firstNameEn, emp?.lastNameLo || emp?.lastNameEn].filter(Boolean).join(' ') || emp?.email || ''

  function handleStartDateSelect(date?: Date) {
    setLeaveStartDate(date)
    if (date && leaveEndDate && date > leaveEndDate) setLeaveEndDate(undefined)
  }

  function handleStartPeriodChange(period: Period) {
    setStartPeriod(period)
    if (leaveStartDate && leaveEndDate && leaveStartDate.toDateString() === leaveEndDate.toDateString() && period === 'afternoon') {
      setEndPeriod('afternoon')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLeaveForUid) { toast.error('ກະລຸນາເລືອກຜູ້ລາພັກ'); return }
    if (!leaveStartDate || !leaveEndDate) { toast.error('ກະລຸນາເລືອກວັນທີ'); return }
    if (!isCalendarDays && (isWeekend(leaveStartDate) || isWeekend(leaveEndDate))) { toast.error('ບໍ່ສາມາດລາໃນວັນເສົາ-ອາທິດ'); return }
    if (!duration || duration <= 0) { toast.error('ວັນສິ້ນສຸດຕ້ອງຫຼັງວັນເລີ່ມ'); return }
    if (!leaveReason.trim()) { toast.error('ກະລຸນາໃສ່ເຫດຜົນ'); return }
    if ((documentRequired === 'yes' || documentRequired === 'option') && docUploadChoice === null) {
      toast.error('ກະລຸນາເລືອກວິທີອັບໂຫຼດເອກະສານ'); return
    }
    if (docUploadChoice === 'now' && !docFile) {
      toast.error('ກະລຸນາເລືອກໄຟລ໌ເອກະສານ'); return
    }
    if (selectedSuccessor && !delegateResponsibilities && !delegateDocumentSigning
        && !delegateO9Approval && !delegateOther) {
      toast.error('ກະລຸນາເລືອກໜ້າທີ່ທີ່ຈະມອບໝາຍໃຫ້ຜູ້ຮັບວຽກຕໍ່ຢ່າງໜ້ອຍໜຶ່ງຢ່າງ'); return
    }
    if (selectedSuccessor && delegateOther && !delegateOtherReason.trim()) {
      toast.error('ກະລຸນາລະບຸລາຍລະອຽດໜ້າທີ່ອື່ນໆ'); return
    }
    setOpenConfirmDialog(true)
  }

  const doSubmit = async () => {
    if (!leaveStartDate || !leaveEndDate || !duration) {
      toast.error('ຂໍ້ມູນບໍ່ຄົບຖ້ວນ, ກະລຸນາກວດສອບໃໝ່')
      return
    }
    if (!selectedLeaveFor) {
      toast.error('ກະລຸນາເລືອກຜູ້ລາພັກ')
      return
    }

    type DeptShape = { uuid?: string; nameLo?: string; nameEn?: string; title?: string; department?: string }
    const employeeDept = typeof selectedLeaveFor.department === 'object' && selectedLeaveFor.department !== null
      ? selectedLeaveFor.department as DeptShape
      : undefined

    setIsSubmitting(true)
    try {
      const createdBy = [user?.firstNameLo || user?.firstName, user?.lastNameLo || user?.lastName].filter(Boolean).join(' ') || undefined
      const leaveUserName = employeeName(selectedLeaveFor) || undefined

      // Stored under the leave-taker's uuid, not the filer's, so the document
      // lives with the request it belongs to.
      const leaveUserUuid = selectedLeaveFor.uuid || selectedLeaveFor.uid || selectedLeaveFor.id || ''
      let docLink: string | undefined = undefined
      if (docUploadChoice === 'now' && docFile) {
        const ext = docFile.name.split('.').pop() ?? 'file'
        docLink = await uploadAttachment(`leaves/${leaveUserUuid}/${Date.now()}.${ext}`, docFile)
      }
      const leaveForWorkLocationType = await fetchWorkLocationType(leaveForWorkLocationUuid)
      await submitLeaveRequest({
        leaveUserUuid: selectedLeaveFor.uuid || selectedLeaveFor.uid || selectedLeaveFor.id || undefined,
        leaveUserName,
         leaveImage: selectedLeaveFor?.profileImage || selectedLeaveFor?.photo3x4Url || null,
        leaveGender: selectedLeaveFor?.gender,

        species: 'instead',
        type: selectedPolicy?.requestType || 'annual',
        policyUuid: selectedPolicy?.policyUuid,
        policyId: selectedPolicy?.policyId || undefined,
        policyName: selectedPolicy?.policyName || selectedPolicy?.label,
        createdBy,
        createdByUid: user?.uuid || user?.uid || user?.id || undefined,
        startDate: format(leaveStartDate, 'yyyy-MM-dd'),
        startPeriod,
        endDate: format(leaveEndDate, 'yyyy-MM-dd'),
        endPeriod,
        duration,
        reason: leaveReason,
        'legal-basis': legalBasis.length > 0 ? legalBasis : undefined,
        departmentUid: employeeDept?.uuid,
        departmentNameLo: employeeDept?.nameLo || employeeDept?.title || employeeDept?.department,
        departmentNameEn: employeeDept?.nameEn || employeeDept?.title || employeeDept?.department,
        successorUid: selectedSuccessor?.uid,
        successorNameLo: selectedSuccessor ? [selectedSuccessor.firstNameLo, selectedSuccessor.lastNameLo].filter(Boolean).join(' ') : undefined,
        successorNameEn: selectedSuccessor ? [selectedSuccessor.firstNameEn, selectedSuccessor.lastNameEn].filter(Boolean).join(' ') : undefined,
        successorGender: selectedSuccessor?.gender,
        taskDelegation: selectedSuccessor
          ? {
              responsibilities: delegateResponsibilities,
              documentSigning: delegateDocumentSigning,
              o9Approval: delegateO9Approval,
              other: delegateOther,
              otherReason: delegateOther ? delegateOtherReason.trim() || null : null,
            }
          : undefined,
        jobTitle: selectedLeaveFor.jobTitle,
        jobTitleLo: selectedLeaveFor.jobTitleLo || undefined,
        workLocationUid: leaveForWorkLocationUuid,
        workLocationNameLo: leaveForWorkLocationNameLo,
        // Both sides of the deduction: what was left going in, and what is
        // left after this request.
        remainingDaysBeforeRequest: selectedPolicy?.remainingDays,
        remainingDaysAfterRequest:
          selectedPolicy?.remainingDays != null && duration != null
            ? selectedPolicy.remainingDays - duration
            : selectedPolicy?.remainingDays,
        docStatus:
          docUploadChoice === 'now' ? 'now' : docUploadChoice === 'later' ? 'later' : null,
        docLink,
        to: getLeaveRecipientText(
          duration,
          selectedLeaveForRole?.LPB === true,
          leaveForWorkLocationNameLo,
          leaveForWorkLocationType,
        ),
      }, { autoApproveDeptHead: true, reviewedBy: createdBy })
      await refetchMyCurrentLeaves()
      toast.success('ສົ່ງຄໍາຮ້ອງຂໍສໍາເລັດ (ອະນຸມັດຂັ້ນຕົ້ນແລ້ວ)')
      setOpenConfirmDialog(false)
      setConfirmLeave(false)
      
      router.push('/dashboard/approv')
    } catch (err) {
      // A truncated upload needs its own message — the generic one sends people
      // back to re-file a request whose only problem was the attachment.
      toast.error(
        err instanceof UploadTruncatedError
          ? UPLOAD_TRUNCATED_MESSAGE
          : 'ບໍ່ສາມາດສົ່ງຄໍາຮ້ອງຂໍໄດ້',
      )
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
    
      <Card>
        <CardHeader className="pb-3">
               <button
            type="button"
            onClick={() =>
              router.push('/dashboard/approv')
            }
            className="flex gap-1 items-center mb-4"
            aria-label="Go back to employee management"
          >
            <ArrowLeft className="w-5 h-5" />
            ກັບຄືນ
          </button>
          <CardTitle className="text-lg">ແບບຟອມຂໍພັກແທນ</CardTitle>
          <CardDescription>ຍື່ນລາພັກໃຫ້ພະນັກງານທີ່ບໍ່ສາມາດດໍາເນີນການດ້ວຍຕົນເອງໄດ້</CardDescription>
        </CardHeader>

        <CardContent className="space-y-1">
          {/* Warning banner */}
          <div className="flex gap-2.5 items-start rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2.5 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              ການລາພັກແທນໃຊ້ໄດ້ສະເພາະກໍລະນີທີ່ຜູ້ກ່ຽວບໍ່ສາມາດເຂົ້າລະບົບໄດ້ ຫຼື ເຫດສຸດເສີນເທົ່ານັ້ນ
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Section 1: Employee */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <SectionHeader number={1} icon={User} title="ຜູ້ລາພັກ" />
              <Combobox
                value={selectedLeaveForUid}
                onValueChange={(uid) => {
                  setSelectedLeaveForUid(uid)
                  if (selectedSuccessorUid === uid) setSelectedSuccessorUid('')
                }}
                options={leaveForOptions.map((emp) => ({
                  value: empKey(emp),
                  label: employeeName(emp),
                  subLabel: emp.jobTitle,
                }))}
                placeholder="ເລືອກພະນັກງານ..."
                searchPlaceholder="ຄົ້ນຫາຊື່ຫຼືຕໍາແໜ່ງ..."
              />

              {selectedLeaveFor && (
                <div className="flex items-center gap-3 rounded-md bg-muted/60 px-3 py-2.5">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary shrink-0">
                    {/* <User className="w-4 h-4" /> */}
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={selectedLeaveFor.profileImage || selectedLeaveFor.photo3x4Url || undefined} alt={employeeName(selectedLeaveFor)} />
                      <AvatarFallback>SSMI</AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{employeeName(selectedLeaveFor)}</p>
                    <p className="text-xs text-muted-foreground truncate">{selectedLeaveFor.jobTitle}</p>
                  </div>
                  <Badge variant="outline" className="ml-auto shrink-0 text-xs">ເລືອກແລ້ວ</Badge>
                </div>
              )}
            </div>

            {/* Section 2: Leave details */}
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <SectionHeader number={2} icon={FileText} title="ລາຍລະອຽດການລາ" />

              <Field>
                <FieldLabel>ປະເພດການລາ</FieldLabel>
                <Combobox
                  value={selectedPolicyValue}
                  onValueChange={setSelectedPolicyValue}
                  options={leaveTypeOptions.map((o) => ({ value: o.value, label: o.label }))}
                  placeholder="ເລືອກປະເພດ"
                  searchPlaceholder="ຄົ້ນຫາປະເພດ..."
                />
              </Field>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel>ວັນເລີ່ມຕົ້ນ</FieldLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !leaveStartDate && 'text-muted-foreground')}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {leaveStartDate ? format(leaveStartDate, 'dd/MM/yyyy') : 'ເລືອກວັນທີ'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={leaveStartDate} onSelect={handleStartDateSelect}
                        disabled={isNonWorkingDay} />
                    </PopoverContent>
                  </Popover>
                  <div className="flex gap-1 mt-1.5">
                    {(['morning', 'afternoon'] as Period[]).map((p) => (
                      <button key={p} type="button" onClick={() => handleStartPeriodChange(p)}
                        className={cn('flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded border transition-colors',
                          startPeriod === p ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent border-input text-muted-foreground hover:bg-muted')}>
                        {p === 'morning' ? <><Sun className="w-3 h-3" /> ເຊົ້າ</> : <><Sunset className="w-3 h-3" /> ບ່າຍ</>}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field>
                  <FieldLabel>ວັນສິ້ນສຸດ</FieldLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !leaveEndDate && 'text-muted-foreground')}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {leaveEndDate ? format(leaveEndDate, 'dd/MM/yyyy') : 'ເລືອກວັນທີ'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={leaveEndDate} onSelect={setLeaveEndDate}
                        disabled={(d) => isNonWorkingDay(d) || (!!leaveStartDate && d < leaveStartDate)} />
                    </PopoverContent>
                  </Popover>
                  <div className="flex gap-1 mt-1.5">
                    {(['morning', 'afternoon'] as Period[]).map((p) => (
                      <button key={p} type="button"
                        disabled={p === 'morning' && !!(leaveStartDate && leaveEndDate && leaveStartDate.toDateString() === leaveEndDate.toDateString() && startPeriod === 'afternoon')}
                        onClick={() => setEndPeriod(p)}
                        className={cn('flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded border transition-colors',
                          endPeriod === p ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent border-input text-muted-foreground hover:bg-muted',
                          'disabled:opacity-40 disabled:cursor-not-allowed')}>
                        {p === 'morning' ? <><Sun className="w-3 h-3" /> ເຊົ້າ</> : <><Sunset className="w-3 h-3" /> ບ່າຍ</>}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              {/* Duration + approver rule */}
              {duration !== null && (
                <div className="flex items-center gap-3 rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
                  <CalendarIcon className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm text-muted-foreground">ຈຳນວນ:</span>
                  <Badge variant="secondary" className="font-semibold">{formatDuration(duration)}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">{approverRuleText}</span>
                </div>
              )}

              <Field>
                <FieldLabel>ເຫດຜົນ</FieldLabel>
                <Textarea placeholder="ອະທິບາຍເຫດຜົນ..." value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} rows={3} />
              </Field>
            </div>

            {/* Section 3: Successor */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <SectionHeader number={3} icon={Users} title="ຜູ້ຮັບວຽກຕໍ່ (ທາງເລືອກ)" />
              <Combobox
                value={selectedSuccessorUid}
                onValueChange={setSelectedSuccessorUid}
                options={[
                  { value: 'none', label: 'ບໍ່ລະບຸ' },
                  ...successorOptions.map((emp) => ({
                    value: empKey(emp),
                    label: employeeName(emp),
                    subLabel: emp.jobTitle,
                  })),
                ]}
                placeholder="ບໍ່ລະບຸ"
                searchPlaceholder="ຄົ້ນຫາຊື່ຫຼືຕໍາແໜ່ງ..."
              />

              {selectedSuccessor && (
                <div className="flex items-center gap-3 rounded-md bg-muted/60 px-3 py-2.5">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{employeeName(selectedSuccessor)}</p>
                    <p className="text-xs text-muted-foreground truncate">{selectedSuccessor.jobTitle}</p>
                  </div>
                </div>
              )}

              {selectedSuccessor && (
                <div className="space-y-2.5 pt-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    ມອບໝາຍໜ້າທີ່ໃຫ້ຜູ້ຮັບວຽກຕໍ່
                  </p>

                  <div className="flex items-center gap-2.5">
                    <Checkbox
                      id="delegate-responsibilities"
                      checked={delegateResponsibilities}
                      onCheckedChange={(c) => setDelegateResponsibilities(c === true)}
                    />
                    <Label htmlFor="delegate-responsibilities" className="text-sm font-normal cursor-pointer">
                      ໜ້າທີ່ຮັບຜິດຊອບ
                    </Label>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Checkbox
                      id="delegate-document-signing"
                      checked={delegateDocumentSigning}
                      onCheckedChange={(c) => setDelegateDocumentSigning(c === true)}
                    />
                    <Label htmlFor="delegate-document-signing" className="text-sm font-normal cursor-pointer">
                      ສິດໃນການເຊັນເອກະສານຕ່າງໆ
                    </Label>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Checkbox
                      id="delegate-o9-approval"
                      checked={delegateO9Approval}
                      onCheckedChange={(c) => setDelegateO9Approval(c === true)}
                    />
                    <Label htmlFor="delegate-o9-approval" className="text-sm font-normal cursor-pointer">
                      ສິດອະນຸມັດລະບົບ O9
                    </Label>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Checkbox
                      id="delegate-other"
                      checked={delegateOther}
                      onCheckedChange={(c) => {
                        const checked = c === true
                        setDelegateOther(checked)
                        if (!checked) setDelegateOtherReason('')
                      }}
                    />
                    <Label htmlFor="delegate-other" className="text-sm font-normal cursor-pointer">
                      ອື່ນໆ
                    </Label>
                  </div>

                  {delegateOther && (
                    <Textarea
                      placeholder="ລະບຸລາຍລະອຽດໜ້າທີ່ອື່ນໆ ຢູ່ບ່ອນນີ້..."
                      value={delegateOtherReason}
                      onChange={(e) => setDelegateOtherReason(e.target.value)}
                      rows={2}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Section 4: Document Upload */}
            {documentRequired !== 'no' && (
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <SectionHeader
                  number={4}
                  icon={Upload}
                  title={documentRequired === 'yes' ? 'ເອກະສານປະກອບ (ຕ້ອງການ)' : 'ເອກະສານປະກອບ (ທາງເລືອກ)'}
                />

                {documentRequired === 'yes' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">
                    ປະເພດການລານີ້ຕ້ອງການເອກະສານ — ກະລຸນາເລືອກ
                  </p>
                )}

                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setDocUploadChoice('now')}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm text-left transition-colors',
                      docUploadChoice === 'now'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-input hover:bg-muted',
                    )}
                  >
                    <Upload className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="font-medium">ອັບໂຫຼດຕອນນີ້</p>
                      <p className="text-xs text-muted-foreground">ເລືອກໄຟລ໌ແນບທັນທີ</p>
                    </div>
                    {docUploadChoice === 'now' && <CheckCircle className="w-4 h-4 ml-auto shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDocUploadChoice('later')
                      setDocFile(null)
                    }}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm text-left transition-colors',
                      docUploadChoice === 'later'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-input hover:bg-muted',
                    )}
                  >
                    <Timer className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="font-medium">ອັບໂຫຼດພາຍຫຼັງ</p>
                      <p className="text-xs text-muted-foreground">ສົ່ງຄໍາຮ້ອງກ່ອນ ແລ້ວຄ່ອຍແນບໃຫ້ທີ່ຫຼັງ</p>
                    </div>
                    {docUploadChoice === 'later' && <CheckCircle className="w-4 h-4 ml-auto shrink-0" />}
                  </button>

                  {documentRequired === 'option' && (
                    <button
                      type="button"
                      onClick={() => {
                        setDocUploadChoice('skip')
                        setDocFile(null)
                      }}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm text-left transition-colors',
                        docUploadChoice === 'skip'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-input hover:bg-muted',
                      )}
                    >
                      <X className="w-4 h-4 shrink-0" />
                      <div>
                        <p className="font-medium">ບໍ່ຕ້ອງການເອກະສານ</p>
                        <p className="text-xs text-muted-foreground">ດໍາເນີນການໂດຍບໍ່ຕ້ອງແນບໄຟລ໌</p>
                      </div>
                      {docUploadChoice === 'skip' && <CheckCircle className="w-4 h-4 ml-auto shrink-0" />}
                    </button>
                  )}
                </div>

                {docUploadChoice === 'now' && (
                  <div className="space-y-2">
                    <FileUpload file={docFile} onFileSelect={setDocFile} />
                    {docFile && (
                      <button
                        type="button"
                        onClick={() => setDocFile(null)}
                        className="flex items-center gap-1 text-xs text-destructive hover:underline"
                      >
                        <X className="w-3 h-3" /> ລຶບໄຟລ໌
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <Button type="submit" className="w-full h-11" size="lg">
              <Send className="w-4 h-4 mr-2" />
              ສົ່ງຄໍາຮ້ອງຂໍ
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Confirm dialog */}
      <Dialog open={openConfirmDialog} onOpenChange={(open) => { setOpenConfirmDialog(open); if (!open) setConfirmLeave(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              ຢືນຢັນການລາພັກແທນ
            </DialogTitle>
            <DialogDescription className="text-amber-700 dark:text-amber-400">
              ການລາພັກແທນໃຊ້ໄດ້ສະເພາະກໍລະນີສຸດເສີນ ຫຼື ບໍ່ສາມາດເຂົ້າລະບົບໄດ້
            </DialogDescription>
          </DialogHeader>

          {/* Summary */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground shrink-0">ຜູ້ລາພັກ</span>
              <span className="font-medium text-right">{employeeName(selectedLeaveFor)}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground shrink-0">ປະເພດ</span>
              <span className="font-medium">{selectedPolicy?.policyName || selectedPolicy?.label}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground shrink-0">ວັນທີ</span>
              <span className="font-medium flex items-center gap-1.5">
                {leaveStartDate && format(leaveStartDate, 'dd/MM/yyyy')}
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                {leaveEndDate && format(leaveEndDate, 'dd/MM/yyyy')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground shrink-0">ຈຳນວນ</span>
              <Badge variant="secondary">{duration !== null ? formatDuration(duration) : '—'}</Badge>
            </div>
            {selectedSuccessor && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground shrink-0">ຜູ້ຮັບວຽກ</span>
                <span className="font-medium text-right">{employeeName(selectedSuccessor)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 rounded-md border px-3 py-2.5 cursor-pointer" onClick={() => setConfirmLeave(v => !v)}>
            <Checkbox id="confirmLeave" checked={confirmLeave} onCheckedChange={(c) => setConfirmLeave(c === true)} />
            <label htmlFor="confirmLeave" className="text-sm cursor-pointer select-none">
              ຂ້ອຍຢືນຢັນວ່າໄດ້ຮັບອະນຸຍາດໃຫ້ຍື່ນລາພັກແທນຜູ້ກ່ຽວ
            </label>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" className="flex-1">ຍົກເລີກ</Button>
            </DialogClose>
            <Button className="flex-1" disabled={isSubmitting || !confirmLeave} onClick={doSubmit}>
              {isSubmitting ? <Spinner className="mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              ຢືນຢັນ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recent requests */}
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {selectedLeaveFor
              ? `ຄໍາຮ້ອງຂໍລ່າສຸດຂອງ ${employeeName(selectedLeaveFor)}`
              : 'ຄໍາຮ້ອງຂໍລ່າສຸດ'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedLeaveForUid ? (
            <div className="flex flex-col items-center py-6 text-muted-foreground gap-2">
              <FileText className="w-8 h-8 opacity-30" />
              <p className="text-sm">ເລືອກຜູ້ລາພັກກ່ອນເພື່ອເບິ່ງຄໍາຮ້ອງຂໍລ່າສຸດ</p>
            </div>
          ) : myCurrentLeaveRequests.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-muted-foreground gap-2">
              <FileText className="w-8 h-8 opacity-30" />
              <p className="text-sm">ຍັງບໍ່ມີຄໍາຮ້ອງຂໍ</p>
            </div>
          ) : (
            <div className="space-y-2">
              {myCurrentLeaveRequests.slice(0, 5).map((request) => (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => setSelectedLeave(request)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border border-l-4 bg-card text-card-foreground text-left hover:bg-muted/50 transition-colors ${
                    request.status === 'approved' ? 'border-l-emerald-400' : request.status === 'rejected' ? 'border-l-red-400' : 'border-l-amber-400'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{request.policyName || request.type}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <CalendarIcon className="w-3 h-3" />
                      {format(new Date(request.startDate), 'dd/MM')}
                      <ArrowRight className="w-3 h-3" />
                      {format(new Date(request.endDate), 'dd/MM/yyyy')}
                      {request.duration !== undefined && (
                        <span className="ml-1 text-muted-foreground/70">· {formatDuration(request.duration)}</span>
                      )}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${getStatusBadgeClass(request.status)}`}>
                    {getStatusIcon(request.status)}
                    {request.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selectedLeave} onOpenChange={(open) => { if (!open) setSelectedLeave(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedLeave?.policyName || selectedLeave?.type}</DialogTitle>
          </DialogHeader>
          {selectedLeave && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">ສະຖານະ</span>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${getStatusBadgeClass(selectedLeave.status)}`}>
                  {getStatusIcon(selectedLeave.status)}
                  {selectedLeave.status}
                </span>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">ວັນເລີ່ມຕົ້ນ</p>
                  <p className="font-medium">{format(new Date(selectedLeave.startDate), 'dd MMM yyyy')}</p>
                  <p className="text-xs text-muted-foreground capitalize">{selectedLeave.startPeriod === 'morning' ? 'ຕອນເຊົ້າ' : 'ຕອນບ່າຍ'}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">ວັນສິ້ນສຸດ</p>
                  <p className="font-medium">{format(new Date(selectedLeave.endDate), 'dd MMM yyyy')}</p>
                  <p className="text-xs text-muted-foreground capitalize">{selectedLeave.endPeriod === 'morning' ? 'ຕອນເຊົ້າ' : 'ຕອນບ່າຍ'}</p>
                </div>
              </div>
              {selectedLeave.duration !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ຈຳນວນ</span>
                  <Badge variant="secondary">{formatDuration(selectedLeave.duration)}</Badge>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">ວັນທີຍື່ນ</span>
                <span>{selectedLeave.createdAt}</span>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1">ເຫດຜົນ</p>
                <p>{selectedLeave.reason}</p>
              </div>
              {selectedLeave.approvals && selectedLeave.approvals.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">ການອານຸມັດ</p>
                    <div className="space-y-1.5">
                      {selectedLeave.approvals.map((approval, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-xs capitalize">{approval.role}</span>
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${getStatusBadgeClass(approval.decision)}`}>
                            {getStatusIcon(approval.decision)}
                            {approval.decision}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
