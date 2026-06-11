"use client";

// ** core
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// ** assets / icons
import {
  Calendar as CalendarIcon,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Sun,
  Sunset,
  User,
  Users,
  AlertTriangle,
  FileText,
  ArrowRight,
} from "lucide-react";

// ** shared components
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

// ** third party
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, isWeekend } from "date-fns";

// ** config / utils / types / hooks
import { useAuth } from "@/lib/auth-context";
import { useHRM } from "@/lib/hrm-context";
import { cn } from "@/lib/utils";
import type { LeaveRequest } from "@/lib/types";

// ** services
import {
  buildInitialLeaveApprovals,
  getLeaveApproverRuleText,
} from "@/services/leave-approval";
import { fetchLeavesByUserUuidFromToday } from "@/services/leaves";
import { fetchPoliciesForGender } from "@/services/policies";
import { getEmployees } from "@/services/employees";
import { fetchOfficialHolidays } from "@/services/officialHolidays";

type Period = "morning" | "afternoon";
type LeaveTypeOption = {
  value: string;
  requestType: string;
  policyUuid: string | undefined;
  policyId: string;
  policyName: string | undefined;
  label: string;
};

function empKey(emp: { uid?: string; id?: string }): string {
  return emp.uid || emp.id || "";
}

function employeeName(
  emp:
    | {
        firstNameLo?: string;
        firstNameEn?: string;
        lastNameLo?: string;
        lastNameEn?: string;
        email?: string;
      }
    | undefined,
): string {
  return (
    [emp?.firstNameLo || emp?.firstNameEn, emp?.lastNameLo || emp?.lastNameEn]
      .filter(Boolean)
      .join(" ") ||
    emp?.email ||
    ""
  );
}

function calcDuration(
  startDate?: Date,
  startPeriod: Period = "morning",
  endDate?: Date,
  endPeriod: Period = "afternoon",
  holidays: Set<string> = new Set(),
): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (start > end) return null;
  let halfDays = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const dateKey = format(cursor, "yyyy-MM-dd");
    if (!isWeekend(cursor) && !holidays.has(dateKey)) {
      const isStartDay = cursor.getTime() === start.getTime();
      const isEndDay = cursor.getTime() === end.getTime();
      if (isStartDay && isEndDay) {
        const startIndex = startPeriod === "morning" ? 0 : 1;
        const endIndex = endPeriod === "morning" ? 0 : 1;
        const sameDayHalfDays = endIndex - startIndex + 1;
        if (sameDayHalfDays <= 0) return null;
        halfDays += sameDayHalfDays;
      } else if (isStartDay) {
        halfDays += startPeriod === "morning" ? 2 : 1;
      } else if (isEndDay) {
        halfDays += endPeriod === "afternoon" ? 2 : 1;
      } else {
        halfDays += 2;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return halfDays > 0 ? halfDays / 2 : null;
}

function formatDuration(d: number): string {
  return d === 0.5 ? "0.5 ວັນ" : d === 1 ? "1 ວັນ" : `${d} ວັນ`;
}

const POLICY_LIMIT_TYPE: Record<string, string> = {
  time: "ຄັ້ງ",
  week: "ອາທິດ",
  month: "ເດືອນ",
  year: "ປີ",
};

function formatPolicyLimit(
  limitDay?: number,
  limitType?: string,
): string | null {
  if (limitDay === undefined) return null;
  if (!limitType) return `${limitDay} ວັນ`;
  const translatedType = POLICY_LIMIT_TYPE[limitType.trim().toLowerCase()] || limitType;
  return `${limitDay} ວັນ / ${translatedType}`;
}

const STATUS_ICON_APPROVED = <CheckCircle className="h-3 w-3" />;
const STATUS_ICON_REJECTED = <XCircle className="h-3 w-3" />;
const STATUS_ICON_PENDING = <Clock className="h-3 w-3" />;

function getStatusIcon(status: string) {
  if (status === "approved") return STATUS_ICON_APPROVED;
  if (status === "rejected") return STATUS_ICON_REJECTED;
  return STATUS_ICON_PENDING;
}

const ICON_SUN = <Sun className="h-3 w-3" />;
const ICON_SUNSET = <Sunset className="h-3 w-3" />;

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "approved":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "rejected":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-amber-100 text-amber-700 border-amber-200";
  }
}

const SectionHeader = memo(function SectionHeader({
  number,
  icon: Icon,
  title,
}: {
  number: number;
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
        {number}
      </div>
      <Icon className="text-muted-foreground h-4 w-4" />
      <span className="text-sm font-semibold">{title}</span>
    </div>
  );
});

const RequestCard = memo(function RequestCard({
  request,
  onSelect,
}: {
  request: LeaveRequest;
  onSelect: (r: LeaveRequest) => void;
}) {
  const handleClick = useCallback(() => onSelect(request), [onSelect, request]);
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`bg-card flex w-full items-center gap-3 rounded-lg border-l-4 p-3 text-left shadow-sm transition-all hover:shadow-md ${
        request.status === "approved"
          ? "border-l-emerald-400"
          : request.status === "rejected"
            ? "border-l-red-400"
            : "border-l-amber-400"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {request.policyName || request.type}
        </p>
        <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
          <CalendarIcon className="h-3 w-3" />
          {format(new Date(request.startDate), "dd/MM")}
          <ArrowRight className="h-3 w-3" />
          {format(new Date(request.endDate), "dd/MM/yyyy")}
          {request.duration !== undefined && (
            <span className="text-muted-foreground/70 ml-1">
              · {formatDuration(request.duration)}
            </span>
          )}
        </p>
      </div>
      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(request.status)}`}
      >
        {getStatusIcon(request.status)}
        {request.status}
      </span>
    </button>
  );
});

export default function InsteadLeaveRequestForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { submitLeaveRequest, leaveBalance } = useHRM();

  const { loggedInUserUuid, departmentUuid, workLocationUuid } = useMemo(
    () => ({
      loggedInUserUuid: user?.uuid || user?.uid || user?.id || "",
      departmentUuid:
        typeof user?.department === "object"
          ? (user.department as { uuid?: string })?.uuid
          : undefined,
      workLocationUuid:
        typeof user?.workLocation === "object" && user.workLocation !== null
          ? (user.workLocation as { uuid?: string }).uuid
          : undefined,
    }),
    [user],
  );

  const { annualRemaining, sickRemaining, personalRemaining } = useMemo(
    () => ({
      annualRemaining: leaveBalance.annual - leaveBalance.annualUsed,
      sickRemaining: leaveBalance.sick - leaveBalance.sickUsed,
      personalRemaining: leaveBalance.personal - leaveBalance.personalUsed,
    }),
    [leaveBalance],
  );

  const [selectedPolicyValue, setSelectedPolicyValue] = useState("annual");
  const [selectedLeaveForUid, setSelectedLeaveForUid] = useState("");
  const [selectedSuccessorUid, setSelectedSuccessorUid] = useState("");
  const [leaveStartDate, setLeaveStartDate] = useState<Date>();
  const [startPeriod, setStartPeriod] = useState<Period>("morning");
  const [leaveEndDate, setLeaveEndDate] = useState<Date>();
  const [endPeriod, setEndPeriod] = useState<Period>("afternoon");
  const [leaveReason, setLeaveReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const { data: officialHolidays = [] } = useQuery({
    queryKey: ["officialHolidays"],
    queryFn: fetchOfficialHolidays,
    enabled: !!loggedInUserUuid,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const holidaySet = useMemo(
    () => new Set(officialHolidays.map((h) => h.date)),
    [officialHolidays],
  );

  const duration = useMemo(
    () =>
      calcDuration(
        leaveStartDate,
        startPeriod,
        leaveEndDate,
        endPeriod,
        holidaySet,
      ),
    [leaveStartDate, startPeriod, leaveEndDate, endPeriod, holidaySet],
  );

  const approverRuleText = useMemo(
    () => getLeaveApproverRuleText(duration),
    [duration],
  );

  const { data: policyRecords = [] } = useQuery({
    queryKey: ["policies", "leave-types", user?.gender ?? null],
    queryFn: () => fetchPoliciesForGender(user?.gender),
  });

  const {
    data: myCurrentLeaveRequests = [],
    refetch: refetchMyCurrentLeaves,
    error: myCurrentLeavesError,
  } = useQuery({
    queryKey: ["leaves", "my-current", loggedInUserUuid],
    queryFn: () => fetchLeavesByUserUuidFromToday(loggedInUserUuid),
    enabled: !!loggedInUserUuid,
  });

  const { data: employeesData = [] } = useQuery({
    queryKey: ["employees", departmentUuid ?? null],
    queryFn: () => getEmployees({ departmentUuid }),
    enabled: !!departmentUuid,
  });

  const leaveForOptions = useMemo(
    () => employeesData.filter((emp) => empKey(emp) !== loggedInUserUuid),
    [employeesData, loggedInUserUuid],
  );

  const successorOptions = useMemo(
    () => employeesData.filter((emp) => empKey(emp) !== selectedLeaveForUid),
    [employeesData, selectedLeaveForUid],
  );

  const leaveTypeOptions = useMemo(() => {
    const fallback: LeaveTypeOption[] = [
      {
        value: "annual",
        requestType: "annual",
        policyUuid: undefined,
        policyId: "",
        policyName: "Annual Leave",
        label: `Annual Leave (ສູງສຸດ ${annualRemaining} ມື້)`,
      },
      {
        value: "sick",
        requestType: "sick",
        policyUuid: undefined,
        policyId: "",
        policyName: "Sick Leave",
        label: `Sick Leave (ສູງສຸດ ${sickRemaining} ມື້)`,
      },
      {
        value: "personal",
        requestType: "personal",
        policyUuid: undefined,
        policyId: "",
        policyName: "Personal Leave",
        label: `Personal Leave (ສູງສຸດ ${personalRemaining} ມື້)`,
      },
      {
        value: "unpaid",
        requestType: "unpaid",
        policyUuid: undefined,
        policyId: "",
        policyName: "Unpaid Leave",
        label: "Unpaid Leave",
      },
    ];
    const seen = new Set<string>();
    const filtered = policyRecords
      .filter((p) => p.requestType)
      .map((p) => {
        const value = p.uuid || p.id;
        if (seen.has(value)) return null;
        seen.add(value);
        const baseLabel = p.name?.trim() || p.requestType;
        const limitLabel = formatPolicyLimit(p.limitDay, p.limitType);
        return {
          value,
          requestType: p.requestType,
          policyUuid: p.uuid,
          policyId: p.id,
          policyName: p.name,
          label: limitLabel ? `${baseLabel} (${limitLabel})` : baseLabel,
        };
      })
      .filter((o): o is LeaveTypeOption => o !== null);
    return filtered.length > 0 ? filtered : fallback;
  }, [annualRemaining, sickRemaining, personalRemaining, policyRecords]);

  const selectedPolicy = useMemo(
    () =>
      leaveTypeOptions.find((o) => o.value === selectedPolicyValue) ??
      leaveTypeOptions[0],
    [leaveTypeOptions, selectedPolicyValue],
  );

  const selectedLeaveFor = useMemo(
    () => employeesData.find((emp) => empKey(emp) === selectedLeaveForUid),
    [employeesData, selectedLeaveForUid],
  );

  const selectedSuccessor = useMemo(
    () => employeesData.find((emp) => empKey(emp) === selectedSuccessorUid),
    [employeesData, selectedSuccessorUid],
  );

  // ── Combobox option arrays ──────────────────────────────────────────────────
  const leaveForComboOptions = useMemo(
    () =>
      leaveForOptions.map((emp) => ({
        value: empKey(emp),
        label: employeeName(emp),
        subLabel: emp.jobTitle,
      })),
    [leaveForOptions],
  );

  const leaveTypeComboOptions = useMemo(
    () => leaveTypeOptions.map((o) => ({ value: o.value, label: o.label })),
    [leaveTypeOptions],
  );

  const successorComboOptions = useMemo(
    () => [
      { value: "none", label: "ບໍ່ລະບຸ" },
      ...successorOptions.map((emp) => ({
        value: empKey(emp),
        label: employeeName(emp),
        subLabel: emp.jobTitle,
      })),
    ],
    [successorOptions],
  );

  const recentRequests = useMemo(
    () => myCurrentLeaveRequests.slice(0, 5),
    [myCurrentLeaveRequests],
  );

  const endMorningDisabled = useMemo(
    () =>
      !!(
        leaveStartDate &&
        leaveEndDate &&
        leaveStartDate.toDateString() === leaveEndDate.toDateString() &&
        startPeriod === "afternoon"
      ),
    [leaveStartDate, leaveEndDate, startPeriod],
  );

  useEffect(() => {
    const valid = leaveTypeOptions.some((o) => o.value === selectedPolicyValue);
    if (!valid && leaveTypeOptions.length > 0) {
      setSelectedPolicyValue(leaveTypeOptions[0].value);
    }
  }, [leaveTypeOptions]);

  useEffect(() => {
    if (myCurrentLeavesError) {
      toast.error("Failed to load leave requests");
      console.error(myCurrentLeavesError);
    }
  }, [myCurrentLeavesError]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleLeaveForChange = useCallback(
    (uid: string) => {
      setSelectedLeaveForUid(uid);
      if (selectedSuccessorUid === uid) setSelectedSuccessorUid("");
    },
    [selectedSuccessorUid],
  );

  const handleStartDateSelect = useCallback(
    (date?: Date) => {
      setLeaveStartDate(date);
      if (date && leaveEndDate && date > leaveEndDate)
        setLeaveEndDate(undefined);
    },
    [leaveEndDate],
  );

  const handleStartPeriodChange = useCallback(
    (period: Period) => {
      setStartPeriod(period);
      if (
        leaveStartDate &&
        leaveEndDate &&
        leaveStartDate.toDateString() === leaveEndDate.toDateString() &&
        period === "afternoon"
      ) {
        setEndPeriod("afternoon");
      }
    },
    [leaveStartDate, leaveEndDate],
  );

  const handleSelectStartMorning = useCallback(
    () => handleStartPeriodChange("morning"),
    [handleStartPeriodChange],
  );
  const handleSelectStartAfternoon = useCallback(
    () => handleStartPeriodChange("afternoon"),
    [handleStartPeriodChange],
  );
  const handleSelectEndMorning = useCallback(() => setEndPeriod("morning"), []);
  const handleSelectEndAfternoon = useCallback(
    () => setEndPeriod("afternoon"),
    [],
  );

  const isStartDateDisabled = useCallback(
    (d: Date) => isWeekend(d) || holidaySet.has(format(d, "yyyy-MM-dd")),
    [holidaySet],
  );

  const isEndDateDisabled = useCallback(
    (d: Date) =>
      isWeekend(d) ||
      holidaySet.has(format(d, "yyyy-MM-dd")) ||
      (!!leaveStartDate && d < leaveStartDate),
    [holidaySet, leaveStartDate],
  );

  const handleLeaveReasonChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLeaveReason(e.target.value);
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedLeaveForUid) {
        toast.error("ກະລຸນາເລືອກຜູ້ລາພັກ");
        return;
      }
      if (!leaveStartDate || !leaveEndDate) {
        toast.error("ກະລຸນາເລືອກວັນທີ");
        return;
      }
      if (isWeekend(leaveStartDate) || isWeekend(leaveEndDate)) {
        toast.error("ບໍ່ສາມາດລາໃນວັນເສົາ-ອາທິດ");
        return;
      }
      if (!duration || duration <= 0) {
        toast.error("ວັນສິ້ນສຸດຕ້ອງຫຼັງວັນເລີ່ມ");
        return;
      }
      if (!leaveReason.trim()) {
        toast.error("ກະລຸນາໃສ່ເຫດຜົນ");
        return;
      }
      setOpenConfirmDialog(true);
    },
    [selectedLeaveForUid, leaveStartDate, leaveEndDate, duration, leaveReason],
  );

  const doSubmit = useCallback(async () => {
    if (!leaveStartDate || !leaveEndDate || !duration) {
      toast.error("ຂໍ້ມູນບໍ່ຄົບຖ້ວນ, ກະລຸນາກວດສອບໃໝ່");
      return;
    }
    if (!selectedLeaveFor) {
      toast.error("ກະລຸນາເລືອກຜູ້ລາພັກ");
      return;
    }

    type DeptShape = {
      uuid?: string;
      nameLo?: string;
      nameEn?: string;
      title?: string;
      department?: string;
    };
    const employeeDept =
      typeof selectedLeaveFor.department === "object" &&
      selectedLeaveFor.department !== null
        ? (selectedLeaveFor.department as DeptShape)
        : undefined;

    setIsSubmitting(true);
    try {
      const createdBy =
        [
          user?.firstNameLo || user?.firstName,
          user?.lastNameLo || user?.lastName,
        ]
          .filter(Boolean)
          .join(" ") || undefined;
      const leaveUserName = employeeName(selectedLeaveFor) || undefined;
      const now = new Date().toISOString();

      const initialApprovals = buildInitialLeaveApprovals(duration);
      const autoApprovedApprovals = initialApprovals.map((step, index) => {
        if (index === 0 && step.role === "departmentHead") {
          return {
            ...step,
            decision: "approved" as const,
            reviewedAt: now,
            reviewedBy: createdBy,
          };
        }
        return step;
      });

      await submitLeaveRequest(
        {
          leaveUserUuid:
            selectedLeaveFor.uuid ||
            selectedLeaveFor.uid ||
            selectedLeaveFor.id ||
            undefined,
          leaveUserName,
          leaveImage:
            selectedLeaveFor?.profileImage ||
            selectedLeaveFor?.photo3x4Url ||
            null,
          species: "instead",
          type: selectedPolicy?.requestType || "annual",
          policyUuid: selectedPolicy?.policyUuid,
          policyId: selectedPolicy?.policyId || undefined,
          policyName: selectedPolicy?.policyName || selectedPolicy?.label,
          createdBy,
          createdByUid: user?.uuid || user?.uid || user?.id || undefined,
          startDate: format(leaveStartDate, "yyyy-MM-dd"),
          startPeriod,
          endDate: format(leaveEndDate, "yyyy-MM-dd"),
          endPeriod,
          duration,
          reason: leaveReason,
          departmentUid: employeeDept?.uuid,
          departmentNameLo:
            employeeDept?.nameLo ||
            employeeDept?.title ||
            employeeDept?.department,
          departmentNameEn:
            employeeDept?.nameEn ||
            employeeDept?.title ||
            employeeDept?.department,
          successorUid: selectedSuccessor?.uid,
          successorNameLo: selectedSuccessor
            ? [selectedSuccessor.firstNameLo, selectedSuccessor.lastNameLo]
                .filter(Boolean)
                .join(" ")
            : undefined,
          successorNameEn: selectedSuccessor
            ? [selectedSuccessor.firstNameEn, selectedSuccessor.lastNameEn]
                .filter(Boolean)
                .join(" ")
            : undefined,
          jobTitle: selectedLeaveFor.jobTitle,
          workLocationUid:
            typeof selectedLeaveFor.workLocation === "string"
              ? selectedLeaveFor.workLocation
              : selectedLeaveFor.workLocation?.uuid,
        },
        autoApprovedApprovals,
      );
      await refetchMyCurrentLeaves();
      toast.success("ສົ່ງຄໍາຮ້ອງຂໍສໍາເລັດ (ອະນຸມັດຂັ້ນຕົ້ນແລ້ວ)");
      setOpenConfirmDialog(false);
      setConfirmLeave(false);
      router.push("/dashboard/approv");
    } catch (err) {
      toast.error("ບໍ່ສາມາດສົ່ງຄໍາຮ້ອງຂໍໄດ້");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    leaveStartDate,
    leaveEndDate,
    duration,
    selectedLeaveFor,
    selectedPolicy,
    selectedSuccessor,
    leaveReason,
    startPeriod,
    endPeriod,
    user,
    submitLeaveRequest,
    refetchMyCurrentLeaves,
    router,
  ]);

  const handleConfirmDialogChange = useCallback((open: boolean) => {
    setOpenConfirmDialog(open);
    if (!open) setConfirmLeave(false);
  }, []);

  const handleToggleConfirmLeave = useCallback(
    () => setConfirmLeave((v) => !v),
    [],
  );
  const handleConfirmLeaveChange = useCallback(
    (c: boolean | "indeterminate") => setConfirmLeave(c === true),
    [],
  );
  const handleDetailDialogChange = useCallback((open: boolean) => {
    if (!open) setSelectedLeave(null);
  }, []);
  const handleSelectLeave = useCallback(
    (r: LeaveRequest) => setSelectedLeave(r),
    [],
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">ແບບຟອມຂໍພັກແທນ</CardTitle>
          <CardDescription>
            ຍື່ນລາພັກໃຫ້ພະນັກງານທີ່ບໍ່ສາມາດດໍາເນີນການດ້ວຍຕົນເອງໄດ້
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-1">
          {/* Warning banner */}
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800 dark:bg-amber-950/20">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              ການລາພັກແທນໃຊ້ໄດ້ສະເພາະກໍລະນີທີ່ຜູ້ກ່ຽວບໍ່ສາມາດເຂົ້າລະບົບໄດ້ ຫຼື
              ເຫດສຸດເສີນເທົ່ານັ້ນ
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Section 1: Employee */}
            <div className="bg-card space-y-3 rounded-lg border p-4">
              <SectionHeader number={1} icon={User} title="ຜູ້ລາພັກ" />
              <Combobox
                value={selectedLeaveForUid}
                onValueChange={handleLeaveForChange}
                options={leaveForComboOptions}
                placeholder="ເລືອກພະນັກງານ..."
                searchPlaceholder="ຄົ້ນຫາຊື່ຫຼືຕໍາແໜ່ງ..."
              />

              {selectedLeaveFor && (
                <div className="bg-muted/60 flex items-center gap-3 rounded-md px-3 py-2.5">
                  <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={
                          selectedLeaveFor.profileImage ||
                          selectedLeaveFor.photo3x4Url ||
                          undefined
                        }
                        alt={employeeName(selectedLeaveFor)}
                      />
                      <AvatarFallback>SSMI</AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {employeeName(selectedLeaveFor)}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {selectedLeaveFor.jobTitle}
                    </p>
                  </div>
                  <Badge variant="outline" className="ml-auto shrink-0 text-xs">
                    ເລືອກແລ້ວ
                  </Badge>
                </div>
              )}
            </div>

            {/* Section 2: Leave details */}
            <div className="bg-card space-y-4 rounded-lg border p-4">
              <SectionHeader number={2} icon={FileText} title="ລາຍລະອຽດການລາ" />

              <Field>
                <FieldLabel>ປະເພດການລາ</FieldLabel>
                <Combobox
                  value={selectedPolicyValue}
                  onValueChange={setSelectedPolicyValue}
                  options={leaveTypeComboOptions}
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
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !leaveStartDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {leaveStartDate
                          ? format(leaveStartDate, "dd/MM/yyyy")
                          : "ເລືອກວັນທີ"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={leaveStartDate}
                        onSelect={handleStartDateSelect}
                        disabled={isStartDateDisabled}
                      />
                    </PopoverContent>
                  </Popover>
                  <div className="mt-1.5 flex gap-1">
                    <button
                      type="button"
                      onClick={handleSelectStartMorning}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1 rounded border py-1.5 text-xs transition-colors",
                        startPeriod === "morning"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-input text-muted-foreground hover:bg-muted bg-transparent",
                      )}
                    >
                      {ICON_SUN} ເຊົ້າ
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectStartAfternoon}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1 rounded border py-1.5 text-xs transition-colors",
                        startPeriod === "afternoon"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-input text-muted-foreground hover:bg-muted bg-transparent",
                      )}
                    >
                      {ICON_SUNSET} ບ່າຍ
                    </button>
                  </div>
                </Field>

                <Field>
                  <FieldLabel>ວັນສິ້ນສຸດ</FieldLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !leaveEndDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {leaveEndDate
                          ? format(leaveEndDate, "dd/MM/yyyy")
                          : "ເລືອກວັນທີ"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={leaveEndDate}
                        onSelect={setLeaveEndDate}
                        disabled={isEndDateDisabled}
                      />
                    </PopoverContent>
                  </Popover>
                  <div className="mt-1.5 flex gap-1">
                    <button
                      type="button"
                      onClick={handleSelectEndMorning}
                      disabled={endMorningDisabled}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1 rounded border py-1.5 text-xs transition-colors",
                        endPeriod === "morning"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-input text-muted-foreground hover:bg-muted bg-transparent",
                        "disabled:cursor-not-allowed disabled:opacity-40",
                      )}
                    >
                      {ICON_SUN} ເຊົ້າ
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectEndAfternoon}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1 rounded border py-1.5 text-xs transition-colors",
                        endPeriod === "afternoon"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-input text-muted-foreground hover:bg-muted bg-transparent",
                        "disabled:cursor-not-allowed disabled:opacity-40",
                      )}
                    >
                      {ICON_SUNSET} ບ່າຍ
                    </button>
                  </div>
                </Field>
              </div>

              {/* Duration + approver rule */}
              {duration !== null && (
                <div className="bg-primary/5 border-primary/20 flex items-center gap-3 rounded-md border px-3 py-2">
                  <CalendarIcon className="text-primary h-4 w-4 shrink-0" />
                  <span className="text-muted-foreground text-sm">ຈຳນວນ:</span>
                  <Badge variant="secondary" className="font-semibold">
                    {formatDuration(duration)}
                  </Badge>
                  <span className="text-muted-foreground ml-auto text-xs">
                    {approverRuleText}
                  </span>
                </div>
              )}

              <Field>
                <FieldLabel>ເຫດຜົນ</FieldLabel>
                <Textarea
                  placeholder="ອະທິບາຍເຫດຜົນ..."
                  value={leaveReason}
                  onChange={handleLeaveReasonChange}
                  rows={3}
                />
              </Field>
            </div>

            {/* Section 3: Successor */}
            <div className="bg-card space-y-3 rounded-lg border p-4">
              <SectionHeader
                number={3}
                icon={Users}
                title="ຜູ້ຮັບວຽກຕໍ່ (ທາງເລືອກ)"
              />
              <Combobox
                value={selectedSuccessorUid}
                onValueChange={setSelectedSuccessorUid}
                options={successorComboOptions}
                placeholder="ບໍ່ລະບຸ"
                searchPlaceholder="ຄົ້ນຫາຊື່ຫຼືຕໍາແໜ່ງ..."
              />

              {selectedSuccessor && (
                <div className="bg-muted/60 flex items-center gap-3 rounded-md px-3 py-2.5">
                  <div className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {employeeName(selectedSuccessor)}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {selectedSuccessor.jobTitle}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Button type="submit" className="h-11 w-full" size="lg">
              <Send className="mr-2 h-4 w-4" />
              ສົ່ງຄໍາຮ້ອງຂໍ
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Confirm dialog */}
      <Dialog open={openConfirmDialog} onOpenChange={handleConfirmDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              ຢືນຢັນການລາພັກແທນ
            </DialogTitle>
            <DialogDescription className="text-amber-700 dark:text-amber-400">
              ການລາພັກແທນໃຊ້ໄດ້ສະເພາະກໍລະນີສຸດເສີນ ຫຼື ບໍ່ສາມາດເຂົ້າລະບົບໄດ້
            </DialogDescription>
          </DialogHeader>

          {/* Summary */}
          <div className="bg-muted/30 space-y-2.5 rounded-lg border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground shrink-0">ຜູ້ລາພັກ</span>
              <span className="text-right font-medium">
                {employeeName(selectedLeaveFor)}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground shrink-0">ປະເພດ</span>
              <span className="font-medium">
                {selectedPolicy?.policyName || selectedPolicy?.label}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground shrink-0">ວັນທີ</span>
              <span className="flex items-center gap-1.5 font-medium">
                {leaveStartDate && format(leaveStartDate, "dd/MM/yyyy")}
                <ArrowRight className="text-muted-foreground h-3 w-3" />
                {leaveEndDate && format(leaveEndDate, "dd/MM/yyyy")}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground shrink-0">ຈຳນວນ</span>
              <Badge variant="secondary">
                {duration !== null ? formatDuration(duration) : "—"}
              </Badge>
            </div>
            {selectedSuccessor && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground shrink-0">
                  ຜູ້ຮັບວຽກ
                </span>
                <span className="text-right font-medium">
                  {employeeName(selectedSuccessor)}
                </span>
              </div>
            )}
          </div>

          <div
            className="flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5"
            onClick={handleToggleConfirmLeave}
          >
            <Checkbox
              id="confirmLeave"
              checked={confirmLeave}
              onCheckedChange={handleConfirmLeaveChange}
            />
            <label
              htmlFor="confirmLeave"
              className="cursor-pointer text-sm select-none"
            >
              ຂ້ອຍຢືນຢັນວ່າໄດ້ຮັບອະນຸຍາດໃຫ້ຍື່ນລາພັກແທນຜູ້ກ່ຽວ
            </label>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" className="flex-1">
                ຍົກເລີກ
              </Button>
            </DialogClose>
            <Button
              className="flex-1"
              disabled={isSubmitting || !confirmLeave}
              onClick={doSubmit}
            >
              {isSubmitting ? (
                <Spinner className="mr-2" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              ຢືນຢັນ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recent requests */}
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ຄໍາຮ້ອງຂໍລ່າສຸດ</CardTitle>
        </CardHeader>
        <CardContent>
          {recentRequests.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-6">
              <FileText className="h-8 w-8 opacity-30" />
              <p className="text-sm">ຍັງບໍ່ມີຄໍາຮ້ອງຂໍ</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentRequests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  onSelect={handleSelectLeave}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selectedLeave} onOpenChange={handleDetailDialogChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedLeave?.policyName || selectedLeave?.type}
            </DialogTitle>
          </DialogHeader>
          {selectedLeave && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">ສະຖານະ</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(selectedLeave.status)}`}
                >
                  {getStatusIcon(selectedLeave.status)}
                  {selectedLeave.status}
                </span>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <p className="text-muted-foreground text-xs">ວັນເລີ່ມຕົ້ນ</p>
                  <p className="font-medium">
                    {format(new Date(selectedLeave.startDate), "dd MMM yyyy")}
                  </p>
                  <p className="text-muted-foreground text-xs capitalize">
                    {selectedLeave.startPeriod === "morning"
                      ? "ຕອນເຊົ້າ"
                      : "ຕອນບ່າຍ"}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground text-xs">ວັນສິ້ນສຸດ</p>
                  <p className="font-medium">
                    {format(new Date(selectedLeave.endDate), "dd MMM yyyy")}
                  </p>
                  <p className="text-muted-foreground text-xs capitalize">
                    {selectedLeave.endPeriod === "morning"
                      ? "ຕອນເຊົ້າ"
                      : "ຕອນບ່າຍ"}
                  </p>
                </div>
              </div>
              {selectedLeave.duration !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ຈຳນວນ</span>
                  <Badge variant="secondary">
                    {formatDuration(selectedLeave.duration)}
                  </Badge>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">ວັນທີຍື່ນ</span>
                <span>{selectedLeave.createdAt}</span>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-1 text-xs">ເຫດຜົນ</p>
                <p>{selectedLeave.reason}</p>
              </div>
              {selectedLeave.approvals &&
                selectedLeave.approvals.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground mb-2 text-xs">
                        ການອານຸມັດ
                      </p>
                      <div className="space-y-1.5">
                        {selectedLeave.approvals.map((approval, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between"
                          >
                            <span className="text-xs capitalize">
                              {approval.role}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(approval.decision)}`}
                            >
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
  );
}
