"use client";

// ** core
import { useEffect, useRef, useState, useMemo } from "react";
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
  FileText,
  Users,
  ArrowRight,
  User,
  Upload,
  Timer,
  X,
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
  DialogContent,
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
import { Combobox } from "@/components/ui/combobox";

// ** third party
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, isWeekend } from "date-fns";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// ** config / utils / types / hooks
import { useAuth } from "@/lib/auth-context";
import { useHRM } from "@/lib/hrm-context";
import { storage } from "@/lib/firebase";
import { usePendingDocLeaves, useUpcomingLeaves } from "@/lib/use-leave-queries";
import { cn } from "@/lib/utils";

// ** services
import { getLeaveApproverRuleText } from "@/services/leave-approval";
import { fetchOfficialHolidays } from "@/services/officialHolidays";
import { fetchPoliciesForGender } from "@/services/policies";
import { getEmployees } from "@/services/employees";

type Period = "morning" | "afternoon";
type LeaveTypeOption = {
  value: string;
  requestType: string;
  policyUuid: string | undefined;
  policyId: string;
  policyName: string | undefined;
  label: string;
  documentRequired?: "yes" | "option" | "no";
};

type DocUploadChoice = "now" | "later" | "skip" | null;

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

function formatPolicyLimit(
  limitDay?: number,
  limitType?: string,
): string | null {
  if (limitDay === undefined) return null;
  const typeMap: Record<string, string> = {
    time: "ຄັ້ງ",
    week: "ອາທິດ",
    month: "ເດືອນ",
    year: "ປີ",
  };
  if (!limitType) return `${limitDay} ວັນ`;
  const translatedType = typeMap[limitType.trim().toLowerCase()] || limitType;
  return `${limitDay} ວັນ / ${translatedType}`;
}

function getStatusIcon(status: string) {
  switch (status) {
    case "approved":
      return <CheckCircle className="w-3 h-3" />;
    case "rejected":
      return <XCircle className="w-3 h-3" />;
    default:
      return <Clock className="w-3 h-3" />;
  }
}

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

function getStatusVariant(status: string) {
  switch (status) {
    case "approved":
      return "default" as const;
    case "rejected":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function SectionHeader({
  number,
  icon: Icon,
  title,
}: {
  number: number;
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
        {number}
      </div>
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm font-semibold">{title}</span>
    </div>
  );
}

export default function LeaveRequestForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { submitLeaveRequest, leaveBalance } = useHRM();
  const loggedInUserUuid = user?.uid || user?.id || "";
  const departmentUuid =
    typeof user?.department === "object" ? user.department?.uuid : undefined;
  const workLocationUuid =
    typeof user?.workLocation === "object"
      ? user.workLocation?.uuid
      : undefined;

  const [selectedPolicyValue, setSelectedPolicyValue] = useState("annual");
  const [selectedSuccessorUid, setSelectedSuccessorUid] = useState("");
  const [leaveStartDate, setLeaveStartDate] = useState<Date>();
  const [startPeriod, setStartPeriod] = useState<Period>("morning");
  const [leaveEndDate, setLeaveEndDate] = useState<Date>();
  const [endPeriod, setEndPeriod] = useState<Period>("afternoon");
  const [leaveReason, setLeaveReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [docUploadChoice, setDocUploadChoice] = useState<DocUploadChoice>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const annualRemaining = leaveBalance.annual - leaveBalance.annualUsed;
  const sickRemaining = leaveBalance.sick - leaveBalance.sickUsed;
  const personalRemaining = leaveBalance.personal - leaveBalance.personalUsed;

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
  } = useUpcomingLeaves(loggedInUserUuid);

  const { data: pendingDocLeaves = [] } = usePendingDocLeaves(loggedInUserUuid);

  // Declared after myCurrentLeaveRequests so typeof resolves correctly
  const [selectedLeave, setSelectedLeave] = useState<
    (typeof myCurrentLeaveRequests)[number] | null
  >(null);

  const { data: employeesData = [] } = useQuery({
    queryKey: ["employees", departmentUuid ?? null],
    queryFn: () => getEmployees({ departmentUuid }),
    enabled: !!departmentUuid,
  });

  const successorOptions = useMemo(
    () =>
      employeesData.filter((emp) => (emp.uid || emp.id) !== loggedInUserUuid),
    [employeesData, loggedInUserUuid],
  );

  const selectedSuccessor = useMemo(
    () =>
      successorOptions.find(
        (emp) => (emp.uid || emp.id) === selectedSuccessorUid,
      ),
    [successorOptions, selectedSuccessorUid],
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
          documentRequired: p.documentRequired,
        };
      })
      .filter((o) => o !== null) as LeaveTypeOption[];
    return filtered.length > 0 ? filtered : fallback;
  }, [
    annualRemaining,
    leaveBalance.annualUsed,
    leaveBalance.personalUsed,
    leaveBalance.sickUsed,
    personalRemaining,
    policyRecords,
    sickRemaining,
  ]);

  const selectedPolicy = useMemo(
    () =>
      leaveTypeOptions.find((o) => o.value === selectedPolicyValue) ??
      leaveTypeOptions[0],
    [leaveTypeOptions, selectedPolicyValue],
  );

  const documentRequired = useMemo(
    () => selectedPolicy?.documentRequired ?? "no",
    [selectedPolicy],
  );

  useEffect(() => {
    setDocUploadChoice(null);
    setDocFile(null);
  }, [selectedPolicyValue]);

  const prevOptionsRef = useRef<string>("");
  useEffect(() => {
    const firstValue = leaveTypeOptions[0]?.value;
    if (!firstValue) return;
    const optionsKey = leaveTypeOptions.map((o) => o.value).join(",");
    if (optionsKey === prevOptionsRef.current) return;
    prevOptionsRef.current = optionsKey;
    const exists = leaveTypeOptions.some(
      (o) => o.value === selectedPolicyValue,
    );
    if (!exists) setSelectedPolicyValue(firstValue);
  }, [leaveTypeOptions, selectedPolicyValue]);

  useEffect(() => {
    if (myCurrentLeavesError) {
      toast.error("ໂຫຼດຄໍາຮ້ອງຂໍລາພັກບໍ່ໄດ້");
      console.error(myCurrentLeavesError);
    }
  }, [myCurrentLeavesError]);

  function handleStartDateSelect(date?: Date) {
    setLeaveStartDate(date);
    if (date && leaveEndDate && date > leaveEndDate) setLeaveEndDate(undefined);
  }

  function handleStartPeriodChange(period: Period) {
    setStartPeriod(period);
    if (
      leaveStartDate &&
      leaveEndDate &&
      leaveStartDate.toDateString() === leaveEndDate.toDateString() &&
      period === "afternoon"
    ) {
      setEndPeriod("afternoon");
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    if (
      (documentRequired === "yes" || documentRequired === "option") &&
      docUploadChoice === null
    ) {
      toast.error("ກະລຸນາເລືອກວິທີອັບໂຫຼດເອກະສານ");
      return;
    }
    if (docUploadChoice === "now" && !docFile) {
      toast.error("ກະລຸນາເລືອກໄຟລ໌ເອກະສານ");
      return;
    }

    setIsSubmitting(true);
    try {
      const createdBy =
        [
          user?.firstNameLo || user?.firstName,
          user?.lastNameLo || user?.lastName,
        ]
          .filter(Boolean)
          .join(" ") || undefined;
      const dept =
        typeof user?.department === "object" && user.department
          ? (user.department as any)
          : undefined;

      // Upload file to Firebase Storage if user chose 'now'
      let docLink: string | undefined = undefined;
      if (docUploadChoice === "now" && docFile) {
        const ext = docFile.name.split(".").pop() ?? "file";
        const storageRef = ref(
          storage,
          `leaves/${loggedInUserUuid}/${Date.now()}.${ext}`,
        );
        const snapshot = await uploadBytes(storageRef, docFile);
        docLink = await getDownloadURL(snapshot.ref);
      }

      await submitLeaveRequest({
        leaveUserUuid: loggedInUserUuid || undefined,
        leaveImage: user?.profileImage || user?.photo3x4Url || null,
        leaveUserName: createdBy,
        species: "owner",
        createdByUid: loggedInUserUuid || undefined,
        type: selectedPolicy?.requestType || "annual",
        policyUuid: selectedPolicy?.policyUuid,
        policyId: selectedPolicy?.policyId || undefined,
        policyName: selectedPolicy?.policyName || selectedPolicy?.label,
        createdBy,
        startDate: format(leaveStartDate, "yyyy-MM-dd"),
        startPeriod,
        endDate: format(leaveEndDate, "yyyy-MM-dd"),
        endPeriod,
        duration: duration ?? undefined,
        reason: leaveReason,
        departmentUid: departmentUuid || dept?.uuid,
        departmentNameLo: dept?.department,
        departmentNameEn: dept?.title,
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
        jobTitle: user?.jobTitle || user?.position,
        workLocationUid: workLocationUuid,
        docStatus:
          docUploadChoice === "now"
            ? "now"
            : docUploadChoice === "later"
              ? "later"
              : null,
        docLink,
      });
      await refetchMyCurrentLeaves();
      toast.success("ສົ່ງຄໍາຮ້ອງຂໍສໍາເລັດ");
      setSelectedPolicyValue(leaveTypeOptions[0]?.value || "annual");
      setSelectedSuccessorUid("");
      setLeaveStartDate(undefined);
      setStartPeriod("morning");
      setLeaveEndDate(undefined);
      setEndPeriod("afternoon");
      setLeaveReason("");
      setDocUploadChoice(null);
      setDocFile(null);
    } catch (err) {
      toast.error("ບໍ່ສາມາດສົ່ງຄໍາຮ້ອງຂໍໄດ້");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">ແບບຟອມຂໍພັກຜ່ອນ</CardTitle>
          <CardDescription>ຍື່ນຄໍາຮ້ອງຂໍລາພັກ</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Section 1: Leave type */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <SectionHeader number={1} icon={FileText} title="ປະເພດການລາ" />
              <Combobox
                value={selectedPolicyValue}
                onValueChange={setSelectedPolicyValue}
                options={leaveTypeOptions.map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
                placeholder="ເລືອກປະເພດ"
                searchPlaceholder="ຄົ້ນຫາປະເພດ..."
              />
            </div>

            {/* Section 2: Dates */}
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <SectionHeader
                number={2}
                icon={CalendarIcon}
                title="ໄລຍະເວລາລາ"
              />

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
                        disabled={(d) =>
                          isWeekend(d) ||
                          holidaySet.has(format(d, "yyyy-MM-dd"))
                        }
                      />
                    </PopoverContent>
                  </Popover>
                  <div className="flex gap-1 mt-1.5">
                    {(["morning", "afternoon"] as Period[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleStartPeriodChange(p)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded border transition-colors",
                          startPeriod === p
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-transparent border-input text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {p === "morning" ? (
                          <>
                            <Sun className="w-3 h-3" /> ເຊົ້າ
                          </>
                        ) : (
                          <>
                            <Sunset className="w-3 h-3" /> ບ່າຍ
                          </>
                        )}
                      </button>
                    ))}
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
                        disabled={(d) =>
                          isWeekend(d) ||
                          holidaySet.has(format(d, "yyyy-MM-dd")) ||
                          (!!leaveStartDate && d < leaveStartDate)
                        }
                      />
                    </PopoverContent>
                  </Popover>
                  <div className="flex gap-1 mt-1.5">
                    {(["morning", "afternoon"] as Period[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        disabled={
                          p === "morning" &&
                          !!(
                            leaveStartDate &&
                            leaveEndDate &&
                            leaveStartDate.toDateString() ===
                              leaveEndDate.toDateString() &&
                            startPeriod === "afternoon"
                          )
                        }
                        onClick={() => setEndPeriod(p)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded border transition-colors",
                          endPeriod === p
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-transparent border-input text-muted-foreground hover:bg-muted",
                          "disabled:opacity-40 disabled:cursor-not-allowed",
                        )}
                      >
                        {p === "morning" ? (
                          <>
                            <Sun className="w-3 h-3" /> ເຊົ້າ
                          </>
                        ) : (
                          <>
                            <Sunset className="w-3 h-3" /> ບ່າຍ
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              {duration !== null && (
                <div className="flex items-center gap-3 rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
                  <CalendarIcon className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm text-muted-foreground">ຈຳນວນ:</span>
                  <Badge variant="secondary" className="font-semibold">
                    {formatDuration(duration)}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {approverRuleText}
                  </span>
                </div>
              )}

              <Field>
                <FieldLabel>ເຫດຜົນ</FieldLabel>
                <Textarea
                  placeholder="ອະທິບາຍເຫດຜົນການລາ..."
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  rows={3}
                />
              </Field>
            </div>

            {/* Section 3: Successor */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <SectionHeader
                number={3}
                icon={Users}
                title="ຜູ້ຮັບວຽກຕໍ່ (ທາງເລືອກ)"
              />
              <Combobox
                value={selectedSuccessorUid}
                onValueChange={setSelectedSuccessorUid}
                options={[
                  { value: "none", label: "ບໍ່ລະບຸ" },
                  ...successorOptions.map((emp) => ({
                    value: emp.uid || emp.id || "",
                    label:
                      [
                        emp.firstNameLo || emp.firstNameEn,
                        emp.lastNameLo || emp.lastNameEn,
                      ]
                        .filter(Boolean)
                        .join(" ") ||
                      emp.email ||
                      "",
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
                    <p className="text-sm font-medium truncate">
                      {[
                        selectedSuccessor.firstNameLo ||
                          selectedSuccessor.firstNameEn,
                        selectedSuccessor.lastNameLo ||
                          selectedSuccessor.lastNameEn,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedSuccessor.jobTitle}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Section 4: Document Upload */}
            {documentRequired !== "no" && (
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <SectionHeader
                  number={4}
                  icon={Upload}
                  title={
                    documentRequired === "yes"
                      ? "ເອກະສານປະກອບ (ຕ້ອງການ)"
                      : "ເອກະສານປະກອບ (ທາງເລືອກ)"
                  }
                />

                {documentRequired === "yes" && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    ປະເພດການລານີ້ຕ້ອງການເອກະສານ — ກະລຸນາເລືອກ
                  </p>
                )}

                <div className="grid grid-cols-1 gap-2">
                  {/* Upload now */}
                  <button
                    type="button"
                    onClick={() => setDocUploadChoice("now")}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm text-left transition-colors",
                      docUploadChoice === "now"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-input hover:bg-muted",
                    )}
                  >
                    <Upload className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="font-medium">ອັບໂຫຼດຕອນນີ້</p>
                      <p className="text-xs text-muted-foreground">
                        ເລືອກໄຟລ໌ແນບທັນທີ
                      </p>
                    </div>
                    {docUploadChoice === "now" && (
                      <CheckCircle className="w-4 h-4 ml-auto shrink-0" />
                    )}
                  </button>

                  {/* Upload later */}
                  <button
                    type="button"
                    onClick={() => {
                      setDocUploadChoice("later");
                      setDocFile(null);
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm text-left transition-colors",
                      docUploadChoice === "later"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-input hover:bg-muted",
                    )}
                  >
                    <Timer className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="font-medium">ອັບໂຫຼດພາຍຫຼັງ</p>
                      <p className="text-xs text-muted-foreground">
                        ສົ່ງຄໍາຮ້ອງກ່ອນ ແລ້ວຄ່ອຍແນບໃຫ້ທີ່ຫຼັງ
                      </p>
                    </div>
                    {docUploadChoice === "later" && (
                      <CheckCircle className="w-4 h-4 ml-auto shrink-0" />
                    )}
                  </button>

                  {/* Skip — only for optional */}
                  {documentRequired === "option" && (
                    <button
                      type="button"
                      onClick={() => {
                        setDocUploadChoice("skip");
                        setDocFile(null);
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm text-left transition-colors",
                        docUploadChoice === "skip"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-input hover:bg-muted",
                      )}
                    >
                      <X className="w-4 h-4 shrink-0" />
                      <div>
                        <p className="font-medium">ບໍ່ຕ້ອງການເອກະສານ</p>
                        <p className="text-xs text-muted-foreground">
                          ດໍາເນີນການໂດຍບໍ່ຕ້ອງແນບໄຟລ໌
                        </p>
                      </div>
                      {docUploadChoice === "skip" && (
                        <CheckCircle className="w-4 h-4 ml-auto shrink-0" />
                      )}
                    </button>
                  )}
                </div>

                {/* File input — shown when 'now' selected */}
                {docUploadChoice === "now" && (
                  <div className="space-y-2">
                    <label
                      htmlFor="doc-file-input"
                      className="block"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div
                        className={cn(
                          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer transition-colors active:bg-primary/10",
                          docFile
                            ? "border-primary bg-primary/5"
                            : "border-input hover:bg-muted",
                        )}
                      >
                        <Upload className="w-6 h-6 text-muted-foreground" />
                        {docFile ? (
                          <div className="text-center">
                            <p className="text-sm font-medium text-primary">
                              {docFile.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(docFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        ) : (
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">
                              ກົດເພື່ອເລືອກໄຟລ໌
                            </p>
                            <p className="text-xs text-muted-foreground">
                              PDF, JPG, PNG (ສູງສຸດ 10MB)
                            </p>
                          </div>
                        )}
                        <input
                          ref={fileInputRef}
                          id="doc-file-input"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) =>
                            setDocFile(e.target.files?.[0] ?? null)
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </label>
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

            <Button
              type="submit"
              className="w-full h-11"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Spinner className="mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              ສົ່ງຄໍາຮ້ອງຂໍ
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Recent requests */}
      <Card className="mt-4">
        <CardHeader className="flex justify-between pb-3">
          <CardTitle className="text-base">ຄໍາຮ້ອງຂໍລ່າສຸດ</CardTitle>
          {pendingDocLeaves.length > 0 && (
            <Button
              variant="link"
              size="sm"
              onClick={() => router.push("/dashboard/request/leave-doc")}
            >
              ເອກະສານຍ້ອນຫຼັງ
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold">
                {pendingDocLeaves.length}
              </span>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {myCurrentLeaveRequests.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-muted-foreground gap-2">
              <FileText className="w-8 h-8 opacity-30" />
              <p className="text-sm">ຍັງບໍ່ມີຄໍາຮ້ອງຂໍ</p>
            </div>
          ) : (
            <div className="space-y-2 ">
              {myCurrentLeaveRequests.map((request) => (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => setSelectedLeave(request)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {request.policyName || request.type}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <CalendarIcon className="w-3 h-3" />
                      {format(new Date(request.startDate), "dd/MM")}
                      <ArrowRight className="w-3 h-3" />
                      {format(new Date(request.endDate), "dd/MM/yyyy")}
                      {request.duration !== undefined && (
                        <span className="ml-1 opacity-70">
                          · {formatDuration(request.duration)}
                        </span>
                      )}
                    </p>
                  </div>
                  <Badge
                    variant={getStatusVariant(request.status)}
                    className="flex items-center gap-1 shrink-0"
                  >
                    {getStatusIcon(request.status)}
                    {request.status}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog
        open={!!selectedLeave}
        onOpenChange={(open) => {
          if (!open) setSelectedLeave(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedLeave?.policyName || selectedLeave?.type}
            </DialogTitle>
          </DialogHeader>
          {selectedLeave && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">ສະຖານະ</span>
                <Badge
                  variant={getStatusVariant(selectedLeave.status)}
                  className="flex items-center gap-1"
                >
                  {getStatusIcon(selectedLeave.status)}
                  {selectedLeave.status}
                </Badge>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">ວັນເລີ່ມຕົ້ນ</p>
                  <p className="font-medium">
                    {format(new Date(selectedLeave.startDate), "dd MMM yyyy")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedLeave.startPeriod === "morning"
                      ? "ຕອນເຊົ້າ"
                      : "ຕອນບ່າຍ"}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">ວັນສິ້ນສຸດ</p>
                  <p className="font-medium">
                    {format(new Date(selectedLeave.endDate), "dd MMM yyyy")}
                  </p>
                  <p className="text-xs text-muted-foreground">
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
                <p className="text-xs text-muted-foreground mb-1">ເຫດຜົນ</p>
                <p>{selectedLeave.reason}</p>
                {selectedLeave.species === "instead" && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    ແທນດ້ວຍ: {selectedLeave.createdBy}
                  </p>
                )}
              </div>
              {selectedLeave.approvals &&
                selectedLeave.approvals.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        ການອານຸມັດ
                      </p>
                      <div className="space-y-1.5">
                        {selectedLeave.approvals
                          .filter(Boolean)
                          .map((approval, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between"
                            >
                              <span className="text-xs capitalize">
                                {approval.role}
                              </span>
                              <Badge
                                variant={getStatusVariant(approval.decision)}
                                className="flex items-center gap-1 text-xs"
                              >
                                {getStatusIcon(approval.decision)}
                                {approval.decision}
                              </Badge>
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
