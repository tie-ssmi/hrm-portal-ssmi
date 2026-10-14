"use client";

// ** core
import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";

// ** assets / icons
import {
  Briefcase,
  Clock,
  GraduationCap,
  ClipboardCheck,
  MapPinned,
  History,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Send,
  X,
  Check,
  UserPlus,
  Pencil,
  Plus,
  FileSpreadsheet,
} from "lucide-react";

// ** shared components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import FileUpload from "@/components/fileUpload";

// ** third party
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  collection,
  getDoc,
  getDocs,
  addDoc,
  deleteField,
  doc,
  updateDoc,
  type FieldValue,
} from "firebase/firestore";

// ** config / utils / types / hooks
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_TYPES,
  FIELDS_BY_TYPE,
  getRequiredApprovers,
  buildContentFields,
  calcDurationDays,
  calcTotalHours,
  dateModeFromDoc,
  type DateMode,
  contentKeysToDelete,
  isShown,
  formatLak,
  getFieldRules,
  getFormType,
  isLegacyActivity,
  resolveTrainingCost,
  typeFieldValuesFromDoc,
  type FieldRule,
  type TypeFieldValues,
} from "@/lib/offsite-form-types";
import type {
  ActivityCode,
  FormType,
  TeammateEntry,
  EmployeeDoc,
  Department,
  WorkLocation,
  OffsiteRequestDoc,
  ScheduleDay,
} from "@/types/workOutside";

// ** services
import { hasNoOffsiteDecisionYet } from "@/services/offsite-approval";
import { logAudit, extractWorkLocationLog } from "@/services/audit-log";
import {
  uploadAttachment,
  UploadTruncatedError,
  UPLOAD_TRUNCATED_MESSAGE,
} from "@/services/attachment-upload";

// ─── Constants ───────────────────────────────────────────────────────────────

// Codes and names come from ACTIVITY_TYPES; this adds only the card UI.
const ACTIVITIES: {
  formType: FormType;
  Icon: React.ElementType;
  nameEn: string;
  desc: string;
}[] = [
  {
    formType: "workOutside",
    Icon: Briefcase,
    nameEn: "General",
    desc: "ພົບລູກຄ້າ, ປະຊຸມ, ອອກບູດ ແລະ ວຽກນອກສຳນັກງານອື່ນໆ",
  },
  {
    formType: "overtime",
    Icon: Clock,
    nameEn: "Overtime",
    desc: "ເຮັດວຽກໃນວັນພັກ ພ້ອມເວລາ ແລະ ຈຳນວນຊົ່ວໂມງ",
  },
  {
    formType: "training",
    Icon: GraduationCap,
    nameEn: "Training / Study visit",
    desc: "ຝຶກອົບຮົມ, ສຳມະນາ, ທັດສະນະສຶກສາ ພ້ອມຄ່າໃຊ້ຈ່າຍ",
  },
  {
    formType: "audit",
    Icon: ClipboardCheck,
    nameEn: "Audit",
    desc: "ລົງກວດກາ ພ້ອມລາຍການເອກະສານທີ່ຕ້ອງກະກຽມ",
  },
  {
    formType: "visit",
    Icon: MapPinned,
    nameEn: "Visit / Follow-up",
    desc: "ລົງຢ້ຽມຢາມ, ຕິດຕາມ ແລະ ແລກປ່ຽນບົດຮຽນກັບສາຂາ",
  },
];

const LAO_WEEKDAYS = [
  "ວັນອາທິດ",
  "ວັນຈັນ",
  "ວັນອັງຄານ",
  "ວັນພຸດ",
  "ວັນພະຫັດ",
  "ວັນສຸກ",
  "ວັນເສົາ",
];

function formatScheduleDate(d: Date) {
  return `${LAO_WEEKDAYS[d.getDay()]} ${format(d, "dd/MM/yyyy")}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onSuccess?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  initialData?: OffsiteRequestDoc;
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const steps = ["ປະເພດກິດຈະກຳ", "ລາຍລະອຽດ", "ທີມ & ກວດສອບ"];
  return (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((label, i) => {
        const s = i + 1;
        const done = s < current;
        const active = s === current;
        return (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                  active && "bg-primary text-primary-foreground",
                  done && "bg-primary/20 text-primary",
                  !active && !done && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="w-4 h-4" /> : s}
              </div>
              <span
                className={cn(
                  "text-xs hidden sm:block whitespace-nowrap",
                  active
                    ? "text-foreground font-medium"
                    : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {s < 3 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mb-4",
                  done ? "bg-primary/50" : "bg-muted",
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ScheduleDatePickerButton({
  onSelect,
}: {
  onSelect: (d: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="shrink-0">
          <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
          ເລືອກວັນທີ
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          onSelect={(d) => {
            if (d) onSelect(d);
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// Calendar-only date input (no typing), holding a "yyyy-MM-dd" string.
function DatePickerField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (iso: string) => void;
  disabled?: (d: Date) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="w-4 h-4 mr-2" />
          {selected ? formatScheduleDate(selected) : "ເລືອກວັນທີ"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          disabled={disabled}
          onSelect={(d) => {
            if (d) onChange(format(d, "yyyy-MM-dd"));
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// Label suffix in the style the form already uses: red * or "(ທາງເລືອກ)".
function RuleMark({ rule }: { rule: FieldRule }) {
  return rule === "required" ? (
    <span className="text-destructive">*</span>
  ) : (
    <span className="text-muted-foreground text-xs">(ທາງເລືອກ)</span>
  );
}

// Firestore rejects undefined values — strip them via JSON round-trip
function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

// photoUrl can be stored as string, null, or { uid: { profileImage: url } } (legacy bug)
function resolvePhotoUrl(raw: unknown): string | undefined {
  if (!raw || typeof raw === "boolean") return undefined;
  if (typeof raw === "string") return raw;
  if (typeof raw === "object") {
    const values = Object.values(raw as Record<string, unknown>);
    for (const v of values) {
      if (typeof v === "string") return v;
      if (v && typeof v === "object") {
        const inner = (v as Record<string, unknown>).profileImage;
        if (typeof inner === "string") return inner;
      }
    }
  }
  return undefined;
}

function generateRequestNo(): string {
  const now = new Date();
  const year = now.getFullYear();
  // base36 last-6 chars of epoch ms — unique per ms, no Firestore read needed
  const suffix = now.getTime().toString(36).slice(-6).toUpperCase();
  return `WO-${year}-${suffix}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OffsiteRequestForm({
  onSuccess,
  onDirtyChange,
  initialData,
}: Props) {
  const { user } = useAuth();
  const isEditMode = !!initialData;

  // ── step ──
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollable = containerRef.current?.closest(
      '[data-slot="dialog-content"]',
    );
    scrollable?.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  // ── step 1 ──
  // formType and activityCode move together for the 4 current types. They're
  // kept apart so an old-code doc (formType 'workOutside', code e.g. BOOTH)
  // can be edited without its code being rewritten.
  const [formType, setFormType] = useState<FormType | null>(() =>
    initialData ? getFormType(initialData) : null,
  );
  const [activityCode, setActivityCode] = useState<ActivityCode | null>(
    () => initialData?.activityType.code ?? null,
  );
  // The doc's own old-era type, so the user can switch back to it after
  // clicking one of the 4 new cards.
  const initialLegacy =
    initialData &&
    isLegacyActivity(getFormType(initialData), initialData.activityType.code)
      ? initialData.activityType
      : null;
  const isLegacy = !!formType && isLegacyActivity(formType, activityCode);

  // AUDIT is offered only to roles with AuditDashboard. An existing audit
  // request keeps its card so the user can still see and keep its type.
  const visibleActivities = useMemo(() => {
    const canAudit =
      !!user?.rolePermissions?.AuditDashboard ||
      (!!initialData && getFormType(initialData) === "audit");
    return ACTIVITIES.filter((a) => a.formType !== "audit" || canAudit);
  }, [user?.rolePermissions?.AuditDashboard, initialData]);

  function selectFormType(type: FormType) {
    setFormType(type);
    setActivityCode(ACTIVITY_TYPES[type].code);
  }

  function selectInitialLegacy() {
    if (!initialLegacy) return;
    setFormType("workOutside");
    setActivityCode(initialLegacy.code);
  }

  // ── step 2 ──
  const [subject, setSubject] = useState(() => initialData?.subject ?? "");
  // Request dates, picked on their own — the schedule below is description
  // only and no longer sets them.
  const [dateMode, setDateMode] = useState<DateMode>(() =>
    dateModeFromDoc(initialData),
  );
  const [startDate, setStartDate] = useState(() => initialData?.startDate ?? "");
  const [endDate, setEndDate] = useState(() =>
    dateModeFromDoc(initialData) === "range" ? (initialData?.endDate ?? "") : "",
  );

  function changeDateMode(mode: DateMode) {
    markDirty();
    setDateMode(mode);
    // range → single keeps the start day; single → range waits for an end day
    setEndDate("");
  }

  function changeStartDate(iso: string) {
    markDirty();
    setStartDate(iso);
    if (endDate && endDate <= iso) setEndDate("");
  }
  const [references, setReferences] = useState<string[]>(
    () => initialData?.references ?? [],
  );
  const [objective, setObjective] = useState(
    () => initialData?.objective ?? "",
  );
  const [scheduleDetails, setScheduleDetails] = useState<ScheduleDay[]>(
    () => initialData?.scheduleDetails ?? [],
  );
  const [equipmentUsed, setEquipmentUsed] = useState(
    () => initialData?.equipmentUsed ?? "",
  );
  // Fields that depend on the form type. Switching type keeps them all in
  // state; buildContentFields picks only the chosen type's fields at submit.
  const [typeValues, setTypeValues] = useState<TypeFieldValues>(() =>
    typeFieldValuesFromDoc(initialData),
  );
  // Overtime hours follow start/end time until the user types their own.
  const [totalHoursEdited, setTotalHoursEdited] = useState(
    () => initialData?.totalHours != null,
  );

  function setTypeField<K extends keyof TypeFieldValues>(
    key: K,
    value: TypeFieldValues[K],
  ) {
    markDirty();
    setTypeValues((prev) => ({ ...prev, [key]: value }));
  }

  function setTime(key: "startTime" | "endTime", value: string) {
    markDirty();
    setTypeValues((prev) => {
      const next = { ...prev, [key]: value };
      if (!totalHoursEdited) {
        const hours = calcTotalHours(next.startTime, next.endTime);
        next.totalHours = hours !== null ? String(hours) : "";
      }
      return next;
    });
  }

  // ── step 3 ──
  const [teammates, setTeammates] = useState<TeammateEntry[]>(
    () => initialData?.teammate ?? [],
  );
  const [teammateSearchOpen, setTeammateSearchOpen] = useState(false);

  // ── doc upload ──
  const [docFile, setDocFile] = useState<File | null>(null);

  // ── excel auto-fill ──
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [isParsingExcel, setIsParsingExcel] = useState(false);

  // ── validation errors ──
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  // ── dirty tracking ──
  const markDirty = useCallback(() => onDirtyChange?.(true), [onDirtyChange]);
  useEffect(() => {
    if (activityCode !== null) markDirty();
  }, [activityCode, markDirty]);
  useEffect(() => {
    if (
      subject ||
      references.length > 0 ||
      objective ||
      scheduleDetails.length > 0 ||
      equipmentUsed
    )
      markDirty();
  }, [
    subject,
    references,
    objective,
    scheduleDetails,
    equipmentUsed,
    markDirty,
  ]);

  // ─── Firestore queries ──────────────────────────────────────────────────────

  // workLocation can be string (legacy uuid) or WorkLocationInfo object
  const workLocationUuid =
    typeof user?.workLocation === "object"
      ? user.workLocation?.uuid
      : (user?.workLocation ?? undefined);

  const { data: employeesList = [] } = useQuery<EmployeeDoc[]>({
    queryKey: ["employees-all", workLocationUuid],
    queryFn: async () => {
      const snap = await getDocs(collection(db, "employees"));
      return snap.docs
        .map((d) => d.data() as EmployeeDoc)
        .filter((e) => {
          if (e.status === "delete") return false;
          if (!workLocationUuid) return true;
          const empLocationUuid =
            typeof e.workLocation === "object"
              ? e.workLocation?.uuid
              : (e.workLocation ?? e.workLocationUid);
          return empLocationUuid === workLocationUuid;
        });
    },
    enabled: !!user,
  });

  // ─── Derived ────────────────────────────────────────────────────────────────

  // What step 2 shows and requires, and the name written to activityType.
  // Step 2 can't be reached without a type; GENERAL is only a typing fallback.
  const rules = useMemo(
    () =>
      formType ? getFieldRules(formType, isLegacy) : FIELDS_BY_TYPE.GENERAL,
    [formType, isLegacy],
  );
  // Overtime asks for the work done, not a trip purpose.
  const objectiveLabel = formType === "overtime" && !isLegacy ? "ໜ້າວຽກ" : "ຈຸດປະສົງ";
  // The Excel box names only the fields an import can fill for this type.
  const excelFieldsText = useMemo(() => {
    const labels = (
      [
        ["subject", "ຫົວຂໍ້"],
        ["references", "ອີງຕາມ"],
        ["objective", objectiveLabel],
        ["equipmentUsed", "ອຸປະກອນ"],
        ["schedule", "ຕາຕະລາງກຳນົດການ"],
      ] as const
    )
      .filter(([key]) => isShown(rules[key]))
      .map(([, label]) => label);
    return labels.length > 1
      ? `${labels.slice(0, -1).join(", ")} ແລະ ${labels[labels.length - 1]}`
      : labels.join("");
  }, [rules, objectiveLabel]);
  const activityMeta = useMemo(() => {
    if (!formType || !activityCode) return null;
    if (isLegacy) {
      return {
        Icon: History,
        name: initialLegacy?.code === activityCode ? initialLegacy.name : activityCode,
        nameEn: "ປະເພດເດີມ",
      };
    }
    const card = ACTIVITIES.find((a) => a.formType === formType);
    return {
      Icon: card?.Icon ?? Briefcase,
      name: ACTIVITY_TYPES[formType].name,
      nameEn: card?.nameEn ?? "",
    };
  }, [formType, activityCode, isLegacy, initialLegacy]);

  // Training cost: with cost rows the total is computed and read-only.
  const trainingCost = useMemo(
    () => resolveTrainingCost(typeValues),
    [typeValues],
  );
  const hasCostRows = trainingCost.costItems.length > 0;
  // Exactly what submit will write, so the review never shows a field the
  // chosen type drops.
  const contentFields = useMemo(
    () =>
      buildContentFields(rules, typeValues, {
        references,
        objective,
        scheduleDetails,
        equipmentUsed,
      }),
    [rules, typeValues, references, objective, scheduleDetails, equipmentUsed],
  );

  // ─── Validation ─────────────────────────────────────────────────────────────

  function validateStep2() {
    const e: Partial<Record<string, string>> = {};
    const v = typeValues;
    if (!subject.trim()) e.subject = "ກະລຸນາໃສ່ຫົວຂໍ້";
    if (rules.dates === "required") {
      if (!startDate) {
        e.dates = dateMode === "single" ? "ກະລຸນາເລືອກວັນທີ" : "ກະລຸນາເລືອກວັນເລີ່ມ";
      } else if (dateMode === "range") {
        if (!endDate) e.dates = "ກະລຸນາເລືອກວັນສິ້ນສຸດ";
        else if (endDate === startDate)
          e.dates = "ວັນເລີ່ມ ແລະ ວັນສິ້ນສຸດເປັນມື້ດຽວກັນ — ກະລຸນາໃຊ້ແບບ \"ມື້ດຽວ\"";
        else if (endDate < startDate) e.dates = "ວັນສິ້ນສຸດຕ້ອງຫຼັງວັນເລີ່ມ";
      }
    }
    if (rules.objective === "required" && !objective.trim())
      e.objective = `ກະລຸນາໃສ່${objectiveLabel}`;
    if (rules.location === "required" && !v.location.trim())
      e.location = "ກະລຸນາໃສ່ສະຖານທີ່";
    if (rules.times === "required") {
      if (!v.startTime) e.startTime = "ກະລຸນາໃສ່ເວລາເລີ່ມ";
      if (!v.endTime) e.endTime = "ກະລຸນາໃສ່ເວລາສິ້ນສຸດ";
    }
    if (isShown(rules.times) && v.startTime && v.endTime && v.endTime <= v.startTime)
      e.endTime = "ເວລາສິ້ນສຸດຕ້ອງຫຼັງເວລາເລີ່ມ";
    if (rules.totalHours === "required" && !(Number(v.totalHours) > 0))
      e.totalHours = "ກະລຸນາໃສ່ຈຳນວນຊົ່ວໂມງ";
    if (isShown(rules.costItems) && trainingCost.costTotals && trainingCost.costTotals.usd > 0) {
      if (!(Number(v.lakPerUsd) > 0)) e.lakPerUsd = "ມີລາຍການເປັນໂດລາ ກະລຸນາໃສ່ອັດຕາແລກປ່ຽນ";
    }
    if (
      isShown(rules.costItems) &&
      v.costRows.some(
        (r) => r.item.trim() && !(r.amount.trim() && Number(r.amount) >= 0),
      )
    )
      e.costItems = "ກະລຸນາໃສ່ຈຳນວນເງິນໃຫ້ທຸກລາຍການ";
    if (rules.estimatedCost === "required") {
      const cost = isShown(rules.costItems) ? trainingCost.estimatedCost : Number(v.estimatedCost);
      if (!(cost != null && cost > 0)) e.estimatedCost = "ກະລຸນາໃສ່ຄ່າໃຊ້ຈ່າຍລວມ";
    }
    if (rules.schedule === "required" && scheduleDetails.length === 0)
      e.schedule = "ກະລຸນາເພີ່ມຕາຕະລາງກຳນົດການຢ່າງໜ້ອຍ 1 ມື້";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ─── Teammate helpers ────────────────────────────────────────────────────────

  function addTeammate(emp: EmployeeDoc) {
    if (teammates.some((t) => t.uid === emp.uid)) return;
    markDirty();
    setTeammates((prev) => [
      ...prev,
      {
        uid: emp.uid,
        fullNameEn: `${emp.firstNameEn} ${emp.lastNameEn}`,
        fullNameLo: `${emp.firstNameLo} ${emp.lastNameLo}`,
        email: emp.email,
        jobTitle: emp.jobTitle,
        // Dropped by stripUndefined at submit when the employee has none
        jobTitleLo: emp.jobTitleLo || undefined,
        department: emp.department,
        position: emp.jobTitle,
        remark: "",
        photoUrl:
          resolvePhotoUrl(emp.profileImage) ?? resolvePhotoUrl(emp.photo3x4Url),
      },
    ]);
    setTeammateSearchOpen(false);
  }

  function removeTeammate(uid: string) {
    setTeammates((prev) => prev.filter((t) => t.uid !== uid));
  }

  function updatePosition(uid: string, position: string) {
    setTeammates((prev) =>
      prev.map((t) => (t.uid === uid ? { ...t, position } : t)),
    );
  }

  function updateRemark(uid: string, remark: string) {
    setTeammates((prev) =>
      prev.map((t) => (t.uid === uid ? { ...t, remark } : t)),
    );
  }

  // ─── Reference helpers ────────────────────────────────────────────────────────

  function addReference() {
    markDirty();
    setReferences((prev) => [...prev, ""]);
  }

  function updateReference(idx: number, value: string) {
    setReferences((prev) => prev.map((r, i) => (i === idx ? value : r)));
  }

  function removeReference(idx: number) {
    setReferences((prev) => prev.filter((_, i) => i !== idx));
  }

  // ─── Schedule helpers ─────────────────────────────────────────────────────────

  function addScheduleDay() {
    markDirty();
    setScheduleDetails((prev) => [
      ...prev,
      { date: "", timeline: [{ time: "", details: "" }] },
    ]);
  }

  function removeScheduleDay(dayIdx: number) {
    setScheduleDetails((prev) => prev.filter((_, i) => i !== dayIdx));
  }

  function updateScheduleDayDate(
    dayIdx: number,
    date: string,
    dateIso?: string,
  ) {
    setScheduleDetails((prev) =>
      prev.map((d, i) => (i === dayIdx ? { ...d, date, dateIso } : d)),
    );
  }

  function addTimelineEntry(dayIdx: number) {
    setScheduleDetails((prev) =>
      prev.map((d, i) =>
        i === dayIdx
          ? { ...d, timeline: [...d.timeline, { time: "", details: "" }] }
          : d,
      ),
    );
  }

  function removeTimelineEntry(dayIdx: number, entryIdx: number) {
    setScheduleDetails((prev) =>
      prev.map((d, i) =>
        i === dayIdx
          ? { ...d, timeline: d.timeline.filter((_, j) => j !== entryIdx) }
          : d,
      ),
    );
  }

  function updateTimelineEntry(
    dayIdx: number,
    entryIdx: number,
    field: "time" | "details",
    value: string,
  ) {
    setScheduleDetails((prev) =>
      prev.map((d, i) =>
        i === dayIdx
          ? {
              ...d,
              timeline: d.timeline.map((t, j) =>
                j === entryIdx ? { ...t, [field]: value } : t,
              ),
            }
          : d,
      ),
    );
  }

  // ─── Excel auto-fill ───────────────────────────────────────────────────────────

  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;

    setIsParsingExcel(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
      });

      let newSubject = "";
      let newObjective = "";
      let newEquipmentUsed = "";
      const newReferences: string[] = [];
      const newSchedule: ScheduleDay[] = [];
      let currentLabel = "";
      let inSchedule = false;

      for (const row of rows.slice(1)) {
        const a = String(row[0] ?? "").trim();
        const b = String(row[1] ?? "").trim();
        const c = String(row[2] ?? "").trim();

        if (!inSchedule && a.includes("ວັນທີ") && b.includes("ຊ່ວງເວລາ")) {
          inSchedule = true;
          continue;
        }

        if (inSchedule) {
          if (!a && !b && !c) continue;
          if (a) {
            const isDateCell = row[0] instanceof Date;
            const dateLabel = isDateCell
              ? formatScheduleDate(row[0] as Date)
              : a;
            const dateIso = isDateCell
              ? format(row[0] as Date, "yyyy-MM-dd")
              : undefined;
            newSchedule.push({
              date: dateLabel,
              dateIso,
              timeline: [{ time: b, details: c }],
            });
          } else if (newSchedule.length > 0) {
            newSchedule[newSchedule.length - 1].timeline.push({
              time: b,
              details: c,
            });
          }
          continue;
        }

        if (a) currentLabel = a;
        if (!b) continue;

        if (currentLabel.includes("ເລື່ອງ")) {
          newSubject ||= b;
        } else if (
          currentLabel.includes("ອີງຕາມ") ||
          currentLabel.includes("ອ້າງອີງ")
        ) {
          newReferences.push(b);
        } else if (currentLabel.includes("ຈຸດປະສົງ")) {
          newObjective = newObjective ? `${newObjective} ${b}` : b;
        } else if (currentLabel.includes("ອຸປະກອນ")) {
          newEquipmentUsed = newEquipmentUsed ? `${newEquipmentUsed} ${b}` : b;
        }
      }

      // Fill only what the current type shows — a hidden field would carry
      // the value in state without the user ever seeing it.
      const fill = {
        subject: isShown(rules.subject) && !!newSubject,
        objective: isShown(rules.objective) && !!newObjective,
        equipmentUsed: isShown(rules.equipmentUsed) && !!newEquipmentUsed,
        references: isShown(rules.references) && newReferences.length > 0,
        schedule: isShown(rules.schedule) && newSchedule.length > 0,
      };
      if (!Object.values(fill).some(Boolean)) {
        toast.error("ບໍ່ພົບຂໍ້ມູນທີ່ກົງກັບຮູບແບບໄຟລ໌");
        return;
      }

      if (fill.subject) setSubject(newSubject);
      if (fill.objective) setObjective(newObjective);
      if (fill.equipmentUsed) setEquipmentUsed(newEquipmentUsed);
      if (fill.references) setReferences(newReferences);
      if (fill.schedule) setScheduleDetails(newSchedule);
      markDirty();
      toast.success("ດຶງຂໍ້ມູນຈາກ Excel ສຳເລັດ");
    } catch (err) {
      console.error(err);
      toast.error("ອ່ານໄຟລ໌ Excel ລົ້ມເຫຼວ ກະລຸນາກວດສອບຮູບແບບໄຟລ໌");
    } finally {
      setIsParsingExcel(false);
    }
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────

  function resetForm() {
    setStep(1);
    setFormType(null);
    setActivityCode(null);
    setTypeValues(typeFieldValuesFromDoc());
    setTotalHoursEdited(false);
    setSubject("");
    setDateMode("single");
    setStartDate("");
    setEndDate("");
    setReferences([]);
    setObjective("");
    setScheduleDetails([]);
    setEquipmentUsed("");
    setTeammates([]);
    setDocFile(null);
    setErrors({});
    onDirtyChange?.(false);
  }

  async function handleSubmit() {
    if (!user) return;
    setIsSubmitting(true);
    try {
      // Re-check the LIVE document, not the copy the list rendered: an approver
      // may have decided since this form was opened, and editing is only
      // allowed while nobody has (hasNoOffsiteDecisionYet). Runs before the
      // file upload so a refused edit doesn't leave an orphaned attachment.
      if (isEditMode && initialData) {
        const fresh = await getDoc(doc(db, "workOutside", initialData.id));
        const freshData = fresh.data() as
          | { status?: string; approvals?: ({ decision?: string } | null)[] }
          | undefined;
        if (
          !freshData ||
          freshData.status !== "pending" ||
          !hasNoOffsiteDecisionYet(freshData.approvals)
        ) {
          toast.error("ຄຳຂໍນີ້ຖືກດຳເນີນການອະນຸມັດແລ້ວ ບໍ່ສາມາດແກ້ໄຂໄດ້");
          return;
        }
      }

      const activity = activityMeta!;
      const now = new Date().toISOString();

      // Dates come from the date picker only; the schedule doesn't touch them.
      // validateStep2 has already made sure they're set and in order.
      const requestEndDate = dateMode === "single" ? startDate : endDate;
      const durationDays = calcDurationDays(startDate, requestEndDate);
      const monthKey = format(parseISO(startDate), "MM-yyyy");

      const requesterDept: Department =
        typeof user.department === "object" && user.department !== null
          ? (user.department as Department)
          : {
              uuid: "",
              title: String(user.department ?? ""),
              department: String(user.department ?? ""),
            };

      const requesterLoc: WorkLocation =
        typeof user.workLocation === "object" && user.workLocation !== null
          ? (user.workLocation as WorkLocation)
          : { uuid: "", code: "", nameLo: String(user.workLocation ?? "") };

      const fullNameEn =
        `${user.firstNameEn ?? user.firstName ?? ""} ${user.lastNameEn ?? user.lastName ?? ""}`.trim();
      const fullNameLo =
        `${user.firstNameLo ?? ""} ${user.lastNameLo ?? ""}`.trim();
      const userImage = user.profileImage || user.photo3x4Url;

      // Editing without choosing a new file must keep the current attachment.
      // This used to start at null on every submit, so saving an edit wrote
      // `docLink: null` over the existing link and silently deleted it.
      let docLink: string | null = isEditMode ? (initialData?.docLink ?? null) : null;
      if (docFile) {
        const ext = docFile.name.split(".").pop() ?? "file";
        docLink = await uploadAttachment(
          `workOutside/${user.uid}/${Date.now()}.${ext}`,
          docFile,
        );
      }

      const participantIds = [
        ...new Set([user.uid, ...teammates.map((t) => t.uid)]),
      ];

      // Content comes only from fields the chosen type shows (contentFields).
      // An old-code doc keeps its code and stored name and gets no formType,
      // so it still reads exactly as before.
      const payload = {
        requester: {
          uid: user.uid,
          fullNameEn,
          fullNameLo,
          email: user.email,
          jobTitle: user.jobTitle ?? user.position ?? "",
          department: requesterDept,
          workLocation: requesterLoc,
          photoUrl: userImage || undefined,
        },
        ...(isLegacy ? {} : { formType: formType! }),
        activityType: { code: activityCode!, name: activity.name },
        subject,
        departmentUid: requesterDept.uuid || "",
        requesterWorkLocationUid: requesterLoc.uuid || "",
        startDate,
        endDate: requestEndDate,
        durationDays,
        monthKey,
        teammateTitle: teammates.length,
        teammate: teammates,
        participantIds,
        participantUids: participantIds,
        participantCount: participantIds.length,
        updatedAt: now,
        updatedBy: fullNameEn,
        docLink,
        ...contentFields,
      };

      if (isEditMode && initialData) {
        // A type switch can change the approver chain (AUDIT skips hr for
        // LPB). Edits only run before any decision, so a rebuilt chain is all
        // pending. LPB is read from the doc's chain, not the editor's role.
        const docApprovers = initialData.requiredApprovers ?? [];
        const nextApprovers = getRequiredApprovers(
          activityCode!,
          docApprovers.includes("manager"),
        );
        const chainChanged =
          docApprovers.length > 0 &&
          nextApprovers.join() !== docApprovers.join();
        const cleanPayload = stripUndefined({
          ...payload,
          ...(chainChanged
            ? {
                requiredApprovers: nextApprovers,
                approvals: nextApprovers.map((role) => ({
                  role,
                  decision: "pending",
                })),
              }
            : {}),
        });
        const initialDataRecord = initialData as unknown as Record<string, unknown>;
        // Content keys the doc has but this save doesn't write — left over
        // from a type switch, or a field the user cleared — are deleted. An
        // old-code doc keeps whatever it has in fields GENERAL hides.
        const removedKeys = contentKeysToDelete(
          rules,
          isLegacy,
          cleanPayload,
          initialData,
        );
        const deletions: Record<string, FieldValue> = Object.fromEntries(
          removedKeys.map((key) => [key, deleteField()]),
        );
        const before = Object.fromEntries(
          [...Object.keys(cleanPayload), ...removedKeys].map((key) => [
            key,
            initialDataRecord[key],
          ]),
        );
        await updateDoc(doc(db, "workOutside", initialData.id), {
          ...cleanPayload,
          ...deletions,
        });
        await logAudit({
          action: "offsite.request.update",
          actorUid: user.uid ?? user.id ?? "",
          actorName: fullNameEn,
          actorRoleUuid: user.rolesUid ?? "",
          actorRoleName: user.rolesName,
          workLocation: extractWorkLocationLog(user.workLocation),
          targetType: "workOutside",
          targetId: initialData.id,
          targetName: fullNameLo || fullNameEn,
          before,
          after: cleanPayload,
          status: "SUCCESS",
        });
        toast.success(`ແກ້ໄຂສຳເລັດ — ${initialData.requestNo}`);
      } else {
        const requestNo = generateRequestNo();
        const requiredApprovers = getRequiredApprovers(
          activityCode!,
          !!user.rolePermissions?.LPB,
        );
        const approvals = requiredApprovers.map((role) => ({
          role,
          decision: "pending",
        }));
        const createPayload = stripUndefined({
          ...payload,
          requestNo,
          status: "pending",
          requiredApprovers,
          approvals,
          rejectReason: null,
          createdAt: now,
          createdBy: fullNameEn,
          createdByUid: user.uid,
        });
        const docRef = await addDoc(collection(db, "workOutside"), createPayload);
        await logAudit({
          action: "offsite.request.create",
          actorUid: user.uid ?? user.id ?? "",
          actorName: fullNameEn,
          actorRoleUuid: user.rolesUid ?? "",
          actorRoleName: user.rolesName,
          workLocation: extractWorkLocationLog(user.workLocation),
          targetType: "workOutside",
          targetId: docRef.id,
          targetName: fullNameLo || fullNameEn,
          after: createPayload,
          status: "SUCCESS",
        });
        toast.success(`ສົ່ງຄຳຂໍສຳເລັດ — ${requestNo}`);
      }

      onSuccess?.();
      resetForm();
    } catch (err) {
      console.error(err);
      await logAudit({
        action: isEditMode ? "offsite.request.update" : "offsite.request.create",
        actorUid: user.uid ?? user.id ?? "",
        actorName:
          `${user.firstNameEn ?? user.firstName ?? ""} ${user.lastNameEn ?? user.lastName ?? ""}`.trim(),
        actorRoleUuid: user.rolesUid ?? "",
        actorRoleName: user.rolesName,
        workLocation: extractWorkLocationLog(user.workLocation),
        targetType: "workOutside",
        targetId: initialData?.id ?? "",
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      toast.error(
        err instanceof UploadTruncatedError
          ? UPLOAD_TRUNCATED_MESSAGE
          : "ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່",
      );
    } finally {
      setIsSubmitting(false);
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
            <h2 className="text-base font-semibold text-foreground">
              ເລືອກປະເພດກິດຈະກຳ
            </h2>
            <p className="text-sm text-muted-foreground">
              ເລືອກປະເພດທີ່ກົງກັບຄຳຂໍຂອງທ່ານ
            </p>
          </div>

          {initialLegacy && (
            <button
              type="button"
              onClick={selectInitialLegacy}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all",
                "hover:border-primary/60 hover:bg-primary/5",
                isLegacy
                  ? "border-primary ring-2 ring-primary bg-primary/5"
                  : "border-dashed border-border bg-card",
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 shrink-0 rounded-lg flex items-center justify-center",
                  isLegacy
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <History className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm">
                  {initialLegacy.name || initialLegacy.code}
                </p>
                <p className="text-xs text-muted-foreground leading-snug">
                  ປະເພດເດີມຂອງຄຳຂໍນີ້ — ເກັບໄວ້ຄືເກົ່າ ຫຼື ເລືອກປະເພດໃໝ່ຂ້າງລຸ່ມ
                </p>
              </div>
            </button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {visibleActivities.map(({ formType: type, Icon, nameEn, desc }) => {
              const selected = !isLegacy && formType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => selectFormType(type)}
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border p-4 text-left transition-all",
                    "hover:border-primary/60 hover:bg-primary/5",
                    selected
                      ? "border-primary ring-2 ring-primary bg-primary/5"
                      : "border-border bg-card",
                  )}
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      {ACTIVITY_TYPES[type].name}
                    </p>
                    <p className="text-xs text-muted-foreground">{nameEn}</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">
                    {desc}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => setStep(2)} disabled={!formType || !activityCode}>
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
            <h2 className="text-base font-semibold text-foreground">
              ລາຍລະອຽດການປະຕິບັດງານ
            </h2>
            <p className="text-sm text-muted-foreground">
              ປະເພດ:{" "}
              <span className="font-medium text-foreground">
                {activityMeta?.name}
              </span>
            </p>
          </div>

          <div className="rounded-lg border border-dashed p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <FileSpreadsheet className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  ອັບໂຫຼດ Excel ເພື່ອຕື່ມຂໍ້ມູນອັດຕະໂນມັດ
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {excelFieldsText}
                </p>
              </div>
            </div>
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleExcelUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={isParsingExcel}
              onClick={() => excelInputRef.current?.click()}
            >
              {isParsingExcel ? (
                <Spinner className="mr-2" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 mr-1.5" />
              )}
              ເລືອກໄຟລ໌ Excel
            </Button>
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

            {isShown(rules.dates) && (
              <Field>
                <FieldLabel>
                  ວັນທີ <RuleMark rule={rules.dates} />
                </FieldLabel>
                <div className="flex w-fit rounded-md border p-0.5">
                  {(
                    [
                      ["single", "ມື້ດຽວ"],
                      ["range", "ຫຼາຍມື້"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => changeDateMode(mode)}
                      className={cn(
                        "rounded px-3 py-1 text-xs font-medium",
                        dateMode === mode
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {dateMode === "single" ? (
                  <DatePickerField value={startDate} onChange={changeStartDate} />
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">ວັນເລີ່ມ</p>
                      <DatePickerField value={startDate} onChange={changeStartDate} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">ວັນສິ້ນສຸດ</p>
                      <DatePickerField
                        value={endDate}
                        onChange={(iso) => {
                          markDirty();
                          setEndDate(iso);
                        }}
                        // Must be after the start day; the same day is "ມື້ດຽວ"
                        disabled={(d) =>
                          !!startDate && format(d, "yyyy-MM-dd") <= startDate
                        }
                      />
                    </div>
                  </div>
                )}
                {errors.dates && <FieldError>{errors.dates}</FieldError>}
              </Field>
            )}

            {isShown(rules.location) && (
              <Field>
                <FieldLabel>
                  ສະຖານທີ່ <RuleMark rule={rules.location} />
                </FieldLabel>
                <Input
                  value={typeValues.location}
                  onChange={(e) => setTypeField("location", e.target.value)}
                  maxLength={300}
                  placeholder="ສະຖານທີ່ປະຕິບັດງານ..."
                />
                {errors.location && <FieldError>{errors.location}</FieldError>}
              </Field>
            )}

            {isShown(rules.customerName) && (
              <Field>
                <FieldLabel>
                  ຊື່ລູກຄ້າ <RuleMark rule={rules.customerName} />
                </FieldLabel>
                <Input
                  value={typeValues.customerName}
                  onChange={(e) => setTypeField("customerName", e.target.value)}
                  maxLength={200}
                  placeholder="ຊື່ລູກຄ້າ ຫຼື ກຸ່ມລູກຄ້າ..."
                />
              </Field>
            )}

            {isShown(rules.details) && (
              <Field>
                <FieldLabel>
                  ລາຍລະອຽດ <RuleMark rule={rules.details} />
                </FieldLabel>
                <Textarea
                  value={typeValues.details}
                  onChange={(e) => setTypeField("details", e.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="ລາຍລະອຽດຂອງວຽກ..."
                />
              </Field>
            )}

            {isShown(rules.times) && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field>
                  <FieldLabel>
                    ເວລາເລີ່ມ <RuleMark rule={rules.times} />
                  </FieldLabel>
                  <Input
                    type="time"
                    value={typeValues.startTime}
                    onChange={(e) => setTime("startTime", e.target.value)}
                  />
                  {errors.startTime && <FieldError>{errors.startTime}</FieldError>}
                </Field>
                <Field>
                  <FieldLabel>
                    ເວລາສິ້ນສຸດ <RuleMark rule={rules.times} />
                  </FieldLabel>
                  <Input
                    type="time"
                    value={typeValues.endTime}
                    onChange={(e) => setTime("endTime", e.target.value)}
                  />
                  {errors.endTime && <FieldError>{errors.endTime}</FieldError>}
                </Field>
                {isShown(rules.totalHours) && (
                  <Field>
                    <FieldLabel>
                      ຈຳນວນຊົ່ວໂມງ <RuleMark rule={rules.totalHours} />
                    </FieldLabel>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.5}
                      value={typeValues.totalHours}
                      onChange={(e) => {
                        setTotalHoursEdited(true);
                        setTypeField("totalHours", e.target.value);
                      }}
                    />
                    {errors.totalHours && (
                      <FieldError>{errors.totalHours}</FieldError>
                    )}
                  </Field>
                )}
              </div>
            )}

            {isShown(rules.references) && (
            <Field>
              <FieldLabel>
                ອີງຕາມ <RuleMark rule={rules.references} />
              </FieldLabel>
              <div className="space-y-2">
                {references.map((ref, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={ref}
                      onChange={(e) => updateReference(idx, e.target.value)}
                      placeholder={`ອີງຕາມ ${idx + 1}...`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeReference(idx)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addReference}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  ເພີ່ມອີງຕາມ
                </Button>
              </div>
            </Field>
            )}

            {isShown(rules.objective) && (
              <Field>
                <FieldLabel>
                  {objectiveLabel} <RuleMark rule={rules.objective} />
                </FieldLabel>
                <Textarea
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder={
                    formType === "overtime"
                      ? "ວຽກທີ່ຈະເຮັດໃນວັນພັກ..."
                      : "ຈຸດປະສົງຂອງການເດີນທາງ..."
                  }
                />
                {errors.objective && <FieldError>{errors.objective}</FieldError>}
              </Field>
            )}

            {isShown(rules.schedule) && (
            <Field>
              <FieldLabel>
                ຕາຕະລາງກຳນົດການ{" "}
                <RuleMark rule={rules.schedule} />
              </FieldLabel>
              {errors.schedule && <FieldError>{errors.schedule}</FieldError>}
              <div className="space-y-3">
                {scheduleDetails.map((day, dayIdx) => (
                  <div key={dayIdx} className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <ScheduleDatePickerButton
                        onSelect={(d) =>
                          updateScheduleDayDate(
                            dayIdx,
                            formatScheduleDate(d),
                            format(d, "yyyy-MM-dd"),
                          )
                        }
                      />
                      <Input
                        value={day.date}
                        onChange={(e) =>
                          updateScheduleDayDate(dayIdx, e.target.value)
                        }
                        placeholder="ວັນອາທິດ 05/07/2026"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeScheduleDay(dayIdx)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {day.timeline.map((entry, entryIdx) => (
                        <div key={entryIdx} className="flex gap-2 items-start">
                          <Input
                            value={entry.time}
                            onChange={(e) =>
                              updateTimelineEntry(
                                dayIdx,
                                entryIdx,
                                "time",
                                e.target.value,
                              )
                            }
                            placeholder="08:00 - 11:30"
                            className="w-32 shrink-0"
                          />
                          <Textarea
                            value={entry.details}
                            onChange={(e) =>
                              updateTimelineEntry(
                                dayIdx,
                                entryIdx,
                                "details",
                                e.target.value,
                              )
                            }
                            rows={2}
                            placeholder="ລາຍລະອຽດກິດຈະກຳ..."
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              removeTimelineEntry(dayIdx, entryIdx)
                            }
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addTimelineEntry(dayIdx)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        ເພີ່ມຊ່ວງເວລາ
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addScheduleDay}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  ເພີ່ມມື້
                </Button>
              </div>
            </Field>
            )}

            {isShown(rules.equipmentUsed) && (
              <Field>
                <FieldLabel>
                  ອຸປະກອນ / ພາຫະນະ <RuleMark rule={rules.equipmentUsed} />
                </FieldLabel>
                <Textarea
                  value={equipmentUsed}
                  onChange={(e) => setEquipmentUsed(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="ອຸປະກອນ, ພາຫະນະ ແລະ ອື່ນໆ ທີ່ນຳໃຊ້..."
                />
              </Field>
            )}

            {isShown(rules.costItems) && (
              <Field>
                <FieldLabel>
                  ລາຍການຄ່າໃຊ້ຈ່າຍ <RuleMark rule={rules.costItems} />
                </FieldLabel>
                <div className="space-y-2">
                  {typeValues.costRows.map((row, idx) => (
                    <div key={idx} className="rounded-lg border p-3 space-y-2">
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-5 shrink-0 pt-2 text-xs tabular-nums">
                          {idx + 1}.
                        </span>
                        <Input
                          value={row.item}
                          onChange={(e) =>
                            setTypeField(
                              "costRows",
                              typeValues.costRows.map((r, i) =>
                                i === idx ? { ...r, item: e.target.value } : r,
                              ),
                            )
                          }
                          placeholder="ລາຍການ ເຊັ່ນ ຄ່າລົງທະບຽນ"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setTypeField(
                              "costRows",
                              typeValues.costRows.filter((_, i) => i !== idx),
                            )
                          }
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 pl-7">
                        <div className="flex rounded-md border p-0.5">
                          {(["lak", "usd"] as const).map((cur) => (
                            <button
                              key={cur}
                              type="button"
                              onClick={() =>
                                setTypeField(
                                  "costRows",
                                  typeValues.costRows.map((r, i) =>
                                    i === idx ? { ...r, currency: cur } : r,
                                  ),
                                )
                              }
                              className={cn(
                                "rounded px-2.5 py-1 text-xs font-medium",
                                row.currency === cur
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {cur === "lak" ? "ກີບ" : "USD"}
                            </button>
                          ))}
                        </div>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={row.amount}
                          onChange={(e) =>
                            setTypeField(
                              "costRows",
                              typeValues.costRows.map((r, i) =>
                                i === idx ? { ...r, amount: e.target.value } : r,
                              ),
                            )
                          }
                          placeholder="ຈຳນວນເງິນ"
                          className="w-36"
                        />
                        <Input
                          value={row.remark}
                          onChange={(e) =>
                            setTypeField(
                              "costRows",
                              typeValues.costRows.map((r, i) =>
                                i === idx ? { ...r, remark: e.target.value } : r,
                              ),
                            )
                          }
                          placeholder="ໝາຍເຫດ ເຊັ່ນ ຈ່າຍຕາມບິນ"
                          className="min-w-0 flex-1"
                        />
                      </div>
                    </div>
                  ))}
                  {errors.costItems && <FieldError>{errors.costItems}</FieldError>}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setTypeField("costRows", [
                        ...typeValues.costRows,
                        { item: "", currency: "lak", amount: "", remark: "" },
                      ])
                    }
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    ເພີ່ມລາຍການ
                  </Button>
                </div>
                {trainingCost.costTotals && (
                  <div className="mt-2 space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
                    {trainingCost.costTotals.usd > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground text-xs">
                          ອັດຕາແລກປ່ຽນ: 1 USD =
                        </span>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={typeValues.lakPerUsd}
                          onChange={(e) => setTypeField("lakPerUsd", e.target.value)}
                          placeholder="22000"
                          className="h-8 w-28"
                        />
                        <span className="text-muted-foreground text-xs">ກີບ</span>
                        {errors.lakPerUsd && (
                          <FieldError className="w-full">{errors.lakPerUsd}</FieldError>
                        )}
                      </div>
                    )}
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 tabular-nums">
                      <dt className="text-muted-foreground">ລວມເປັນກີບ</dt>
                      <dd className="text-right">{formatLak(trainingCost.costTotals.lak)}</dd>
                      {trainingCost.costTotals.usd > 0 && (
                        <>
                          <dt className="text-muted-foreground">ລວມເປັນໂດລາ</dt>
                          <dd className="text-right">
                            {trainingCost.costTotals.usd.toLocaleString("en-US")} USD ={" "}
                            {formatLak(trainingCost.costTotals.usdConvertedToLak)}
                          </dd>
                        </>
                      )}
                      <dt className="font-semibold">ລວມທັງໝົດ</dt>
                      <dd className="text-right font-semibold">
                        {formatLak(trainingCost.costTotals.grandTotalLak)}
                      </dd>
                    </dl>
                  </div>
                )}
              </Field>
            )}

            {isShown(rules.estimatedCost) && !hasCostRows && (
              <Field>
                <FieldLabel>
                  ຄ່າໃຊ້ຈ່າຍລວມ (ກີບ) <RuleMark rule={rules.estimatedCost} />
                </FieldLabel>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={typeValues.estimatedCost}
                  onChange={(e) => setTypeField("estimatedCost", e.target.value)}
                  placeholder="0"
                />
                {isShown(rules.costItems) && (
                  <p className="text-muted-foreground text-xs">
                    ຫຼື ເພີ່ມລາຍການຄ່າໃຊ້ຈ່າຍຂ້າງເທິງ ເພື່ອຄິດໄລ່ອັດຕະໂນມັດ
                  </p>
                )}
                {errors.estimatedCost && (
                  <FieldError>{errors.estimatedCost}</FieldError>
                )}
              </Field>
            )}

            {isShown(rules.trainingInfo) && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>
                      ຜູ້ຈັດ <RuleMark rule={rules.trainingInfo} />
                    </FieldLabel>
                    <Input
                      value={typeValues.organizer}
                      onChange={(e) => setTypeField("organizer", e.target.value)}
                      maxLength={300}
                      placeholder="ອົງກອນ ຫຼື ໜ່ວຍງານທີ່ຈັດ"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>
                      ກຳນົດລົງທະບຽນ <RuleMark rule={rules.trainingInfo} />
                    </FieldLabel>
                    <Input
                      type="date"
                      value={typeValues.registrationDeadline}
                      onChange={(e) =>
                        setTypeField("registrationDeadline", e.target.value)
                      }
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>
                    ຜູ້ປະສານງານ <RuleMark rule={rules.trainingInfo} />
                  </FieldLabel>
                  <div className="space-y-2">
                    {typeValues.coordinators.map((c, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Input
                          value={c.name}
                          onChange={(e) =>
                            setTypeField(
                              "coordinators",
                              typeValues.coordinators.map((x, i) =>
                                i === idx ? { ...x, name: e.target.value } : x,
                              ),
                            )
                          }
                          placeholder="ຊື່"
                          className="min-w-0 flex-1"
                        />
                        <Input
                          type="tel"
                          value={c.phone}
                          onChange={(e) =>
                            setTypeField(
                              "coordinators",
                              typeValues.coordinators.map((x, i) =>
                                i === idx ? { ...x, phone: e.target.value } : x,
                              ),
                            )
                          }
                          placeholder="020 xxxx xxxx"
                          className="w-40"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setTypeField(
                              "coordinators",
                              typeValues.coordinators.filter((_, i) => i !== idx),
                            )
                          }
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setTypeField("coordinators", [
                          ...typeValues.coordinators,
                          { name: "", phone: "" },
                        ])
                      }
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      ເພີ່ມຜູ້ປະສານງານ
                    </Button>
                  </div>
                </Field>
              </>
            )}

            {isShown(rules.documentChecklist) && (
              <Field>
                <FieldLabel>
                  ລາຍການເອກະສານທີ່ຕ້ອງກະກຽມ{" "}
                  <RuleMark rule={rules.documentChecklist} />
                </FieldLabel>
                <div className="space-y-3">
                  {typeValues.documentChecklist.map((group, gIdx) => {
                    const updateGroup = (next: typeof group) =>
                      setTypeField(
                        "documentChecklist",
                        typeValues.documentChecklist.map((g, i) =>
                          i === gIdx ? next : g,
                        ),
                      );
                    return (
                      <div key={gIdx} className="rounded-lg border p-3 space-y-2">
                        <div className="flex gap-2">
                          <Input
                            value={group.group}
                            onChange={(e) =>
                              updateGroup({ ...group, group: e.target.value })
                            }
                            placeholder="ກຸ່ມ ເຊັ່ນ ຂະແໜງ/ໜ່ວຍງານບັນຊີ"
                            className="flex-1 font-medium"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              setTypeField(
                                "documentChecklist",
                                typeValues.documentChecklist.filter(
                                  (_, i) => i !== gIdx,
                                ),
                              )
                            }
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        {group.items.map((it, iIdx) => (
                          <div key={iIdx} className="flex gap-2 pl-2">
                            <span className="text-muted-foreground w-5 shrink-0 pt-2 text-xs tabular-nums">
                              {iIdx + 1}.
                            </span>
                            <Input
                              value={it.item}
                              onChange={(e) =>
                                updateGroup({
                                  ...group,
                                  items: group.items.map((x, i) =>
                                    i === iIdx ? { ...x, item: e.target.value } : x,
                                  ),
                                })
                              }
                              placeholder="ລາຍການເອກະສານ"
                              className="min-w-0 flex-1"
                            />
                            <Input
                              value={it.remark}
                              onChange={(e) =>
                                updateGroup({
                                  ...group,
                                  items: group.items.map((x, i) =>
                                    i === iIdx ? { ...x, remark: e.target.value } : x,
                                  ),
                                })
                              }
                              placeholder="ໝາຍເຫດ"
                              className="w-32 sm:w-40"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                updateGroup({
                                  ...group,
                                  items: group.items.filter((_, i) => i !== iIdx),
                                })
                              }
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ml-2"
                          onClick={() =>
                            updateGroup({
                              ...group,
                              items: [...group.items, { item: "", remark: "" }],
                            })
                          }
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          ເພີ່ມເອກະສານ
                        </Button>
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setTypeField("documentChecklist", [
                        ...typeValues.documentChecklist,
                        { group: "", items: [{ item: "", remark: "" }] },
                      ])
                    }
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    ເພີ່ມກຸ່ມ
                  </Button>
                </div>
              </Field>
            )}

            {isShown(rules.notes) && (
              <Field>
                <FieldLabel>
                  ໝາຍເຫດ <RuleMark rule={rules.notes} />
                </FieldLabel>
                <div className="space-y-2">
                  {typeValues.notes.map((note, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Textarea
                        value={note}
                        onChange={(e) =>
                          setTypeField(
                            "notes",
                            typeValues.notes.map((n, i) =>
                              i === idx ? e.target.value : n,
                            ),
                          )
                        }
                        rows={2}
                        placeholder={`ໝາຍເຫດ ${idx + 1}...`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setTypeField(
                            "notes",
                            typeValues.notes.filter((_, i) => i !== idx),
                          )
                        }
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTypeField("notes", [...typeValues.notes, ""])}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    ເພີ່ມໝາຍເຫດ
                  </Button>
                </div>
              </Field>
            )}

            {isShown(rules.docLink) && (
            <Field>
              <FieldLabel>
                ເອກະສານແນບ <RuleMark rule={rules.docLink} />
              </FieldLabel>
              <div className="space-y-2">
                {isEditMode && initialData?.docLink && !docFile && (
                  <a
                    href={initialData.docLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary block text-xs hover:underline"
                  >
                    ມີເອກະສານແນບຢູ່ແລ້ວ — ເລືອກໄຟລ໌ໃໝ່ຖ້າຕ້ອງການແທນທີ່
                  </a>
                )}
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
            </Field>
            )}
          </FieldGroup>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              ກັບຄືນ
            </Button>
            <Button
              onClick={() => {
                if (validateStep2()) setStep(3);
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
              <h2 className="text-base font-semibold text-foreground">
                ສະມາຊິກທີມ
              </h2>
              <Popover
                open={teammateSearchOpen}
                onOpenChange={setTeammateSearchOpen}
              >
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <UserPlus className="w-4 h-4 mr-2" />
                    ເພີ່ມສະມາຊິກ
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-80 p-0 overflow-hidden"
                  align="end"
                >
                  <Command>
                    <CommandInput placeholder="ຄົ້ນຫາພະນັກງານ..." />
                    <CommandList className="max-h-56 overflow-y-auto overscroll-contain [touch-action:pan-y]">
                      <CommandEmpty>ບໍ່ພົບຂໍ້ມູນ</CommandEmpty>
                      <CommandGroup>
                        {employeesList
                          .filter(
                            (e) => !teammates.some((t) => t.uid === e.uid),
                          )
                          .map((emp, idx) => (
                            <CommandItem
                              key={emp.uid || emp.email || idx}
                              value={`${emp.firstNameLo} ${emp.lastNameLo} ${emp.firstNameEn} ${emp.lastNameEn}`}
                              onSelect={() => addTeammate(emp)}
                            >
                              <div className="flex items-center gap-2 w-full min-w-0">
                                <Avatar className="w-8 h-8 shrink-0">
                                  <AvatarImage
                                    src={
                                      resolvePhotoUrl(emp.profileImage) ??
                                      resolvePhotoUrl(emp.photo3x4Url)
                                    }
                                    alt={`${emp.firstNameLo} ${emp.lastNameLo}`}
                                  />
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                    {`${emp.firstNameLo} ${emp.lastNameLo}`
                                      .split(" ")
                                      .map((w) => w[0])
                                      .join("")
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
                                    {emp.department?.title
                                      ? ` · ${emp.department.title}`
                                      : ""}
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
                  <div
                    key={tm.uid || tm.email}
                    className="p-3 rounded-lg border bg-card space-y-2"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-9 h-9">
                        <AvatarImage
                          src={resolvePhotoUrl(tm.photoUrl)}
                          alt={tm.fullNameLo || tm.fullNameEn}
                        />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {(tm.fullNameLo || tm.fullNameEn)
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {tm.fullNameLo}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {tm.jobTitle}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeTeammate(tm.uid)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pl-12">
                      <Input
                        value={tm.position}
                        onChange={(e) => updatePosition(tm.uid, e.target.value)}
                        placeholder="ຕຳແໜ່ງ"
                        className="h-8 text-xs"
                      />
                      <Input
                        value={tm.remark}
                        onChange={(e) => updateRemark(tm.uid, e.target.value)}
                        placeholder="ໝາຍເຫດ (ຖ້າມີ)"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Review */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              ກວດສອບຂໍ້ມູນ
            </h2>

            <Card>
              <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  ປະເພດກິດຈະກຳ
                </CardTitle>
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
                      {activityMeta.name}{" "}
                      <span className="text-muted-foreground">
                        ({activityMeta.nameEn})
                      </span>
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  ລາຍລະອຽດ
                </CardTitle>
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
                  <dd className="font-medium break-words">{subject || "—"}</dd>

                  {startDate && (
                    <>
                      <dt className="text-muted-foreground">ວັນທີ</dt>
                      <dd className="font-medium tabular-nums">
                        {dateMode === "range" && endDate
                          ? `ວັນທີ ${format(parseISO(startDate), "dd/MM/yyyy")} ຫາ ${format(parseISO(endDate), "dd/MM/yyyy")} (${calcDurationDays(startDate, endDate)} ມື້)`
                          : `ວັນທີ ${format(parseISO(startDate), "dd/MM/yyyy")}`}
                      </dd>
                    </>
                  )}

                  {contentFields.objective && (
                    <>
                      <dt className="text-muted-foreground">{objectiveLabel}</dt>
                      <dd className="font-medium break-words line-clamp-2">
                        {contentFields.objective}
                      </dd>
                    </>
                  )}

                  {!!contentFields.references?.length && (
                    <>
                      <dt className="text-muted-foreground">ອີງຕາມ</dt>
                      <dd className="font-medium break-words">
                        {contentFields.references.length} ລາຍການ
                      </dd>
                    </>
                  )}

                  {!!contentFields.scheduleDetails?.length && (
                    <>
                      <dt className="text-muted-foreground">ຕາຕະລາງກຳນົດການ</dt>
                      <dd className="font-medium">
                        {contentFields.scheduleDetails.length} ມື້,{" "}
                        {contentFields.scheduleDetails.reduce(
                          (n, d) => n + d.timeline.length,
                          0,
                        )}{" "}
                        ຊ່ວງເວລາ
                      </dd>
                    </>
                  )}

                  {contentFields.equipmentUsed && (
                    <>
                      <dt className="text-muted-foreground">ອຸປະກອນ</dt>
                      <dd className="font-medium break-words line-clamp-2">
                        {contentFields.equipmentUsed}
                      </dd>
                    </>
                  )}

                  {contentFields.location && (
                    <>
                      <dt className="text-muted-foreground">ສະຖານທີ່</dt>
                      <dd className="font-medium break-words line-clamp-2">
                        {contentFields.location}
                      </dd>
                    </>
                  )}

                  {contentFields.customerName && (
                    <>
                      <dt className="text-muted-foreground">ລູກຄ້າ</dt>
                      <dd className="font-medium break-words">
                        {contentFields.customerName}
                      </dd>
                    </>
                  )}

                  {(contentFields.startTime || contentFields.endTime) && (
                    <>
                      <dt className="text-muted-foreground">ເວລາ</dt>
                      <dd className="font-medium tabular-nums">
                        {contentFields.startTime || "—"} – {contentFields.endTime || "—"}
                        {contentFields.totalHours != null &&
                          ` (${contentFields.totalHours} ຊົ່ວໂມງ)`}
                      </dd>
                    </>
                  )}

                  {contentFields.estimatedCost != null && (
                    <>
                      <dt className="text-muted-foreground">ຄ່າໃຊ້ຈ່າຍລວມ</dt>
                      <dd className="font-medium tabular-nums">
                        {formatLak(contentFields.estimatedCost)}
                        {contentFields.costItems &&
                          ` (${contentFields.costItems.length} ລາຍການ)`}
                      </dd>
                    </>
                  )}

                  {contentFields.organizer && (
                    <>
                      <dt className="text-muted-foreground">ຜູ້ຈັດ</dt>
                      <dd className="font-medium break-words">
                        {contentFields.organizer}
                      </dd>
                    </>
                  )}

                  {contentFields.coordinators && (
                    <>
                      <dt className="text-muted-foreground">ຜູ້ປະສານງານ</dt>
                      <dd className="font-medium">
                        {contentFields.coordinators.length} ທ່ານ
                      </dd>
                    </>
                  )}

                  {contentFields.documentChecklist && (
                    <>
                      <dt className="text-muted-foreground">ເອກະສານທີ່ຕ້ອງກະກຽມ</dt>
                      <dd className="font-medium">
                        {contentFields.documentChecklist.reduce(
                          (n, g) => n + g.items.length,
                          0,
                        )}{" "}
                        ລາຍການ, {contentFields.documentChecklist.length} ກຸ່ມ
                      </dd>
                    </>
                  )}

                  {contentFields.notes && (
                    <>
                      <dt className="text-muted-foreground">ໝາຍເຫດ</dt>
                      <dd className="font-medium">
                        {contentFields.notes.length} ຂໍ້
                      </dd>
                    </>
                  )}
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
                      <div
                        key={tm.uid}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{tm.fullNameLo}</span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {tm.position}
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
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || teammates.length === 0}
            >
              {isSubmitting ? (
                <Spinner className="mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {isEditMode ? "ບັນທຶກການແກ້ໄຂ" : "ສົ່ງຄຳຂໍ"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
