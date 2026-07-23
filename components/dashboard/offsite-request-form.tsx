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

// ** third party
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// ** config / utils / types / hooks
import { useAuth } from "@/lib/auth-context";
import { db, storage } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { logAudit } from "@/services/audit-log";
import type {
  ActivityCode,
  TeammateEntry,
  EmployeeDoc,
  Department,
  WorkLocation,
  OffsiteRequestDoc,
  ScheduleDay,
} from "@/types/workOutside";

// ** services
import FileUpload from "@/components/fileUpload";

// ─── Constants ───────────────────────────────────────────────────────────────

const ACTIVITIES = [
  {
    code: "MEET_CLIENT" as ActivityCode,
    Icon: Handshake,
    nameLo: "ໂຄສະນາພາຍນອກ",
    nameEn: "Meet Client",
    desc: "ນຳສະເໜີ ຫຼື ປະສານງານກັບລູກຄ້າ",
  },
  {
    code: "MEETING" as ActivityCode,
    Icon: Users,
    nameLo: "ປະຊຸມພາຍນອກ",
    nameEn: "External Meeting",
    desc: "ປະຊຸມນອກສຳນັກງານ",
  },
  {
    code: "BOOTH" as ActivityCode,
    Icon: Store,
    nameLo: "ອອກບູດງານ",
    nameEn: "Booth Exhibition",
    desc: "ນຳສະເໜີຜະລິດຕະພັນໃນງານ",
  },
  {
    code: "PROMO" as ActivityCode,
    Icon: Megaphone,
    nameLo: "ໂປຣໂມຊັນ",
    nameEn: "Promotion",
    desc: "ໂຄສະນາ ແລະ ການຕະຫຼາດ",
  },
  {
    code: "TRAINING" as ActivityCode,
    Icon: BookOpen,
    nameLo: "ຝຶກອົບຮົມ",
    nameEn: "Training",
    desc: "ສຳມະນາ ແລະ ການອົບຮົມ",
  },
  {
    code: "OTHERS" as ActivityCode,
    Icon: Plus,
    nameLo: "ອື່ນໆ",
    nameEn: "Others",
    desc: "ກິດຈະກຳອື່ນໆ ທີ່ບໍ່ໄດ້ກໍານົດຂ້າງເທິງ",
  },
] as const;

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
  const [activityCode, setActivityCode] = useState<ActivityCode | null>(
    () => initialData?.activityType.code ?? null,
  );

  // ── step 2 ──
  const [subject, setSubject] = useState(() => initialData?.subject ?? "");
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

  const activityMeta = useMemo(
    () => ACTIVITIES.find((a) => a.code === activityCode),
    [activityCode],
  );

  // ─── Validation ─────────────────────────────────────────────────────────────

  function validateStep2() {
    const e: Partial<Record<string, string>> = {};
    if (!subject.trim()) e.subject = "ກະລຸນາໃສ່ຫົວຂໍ້";
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

      if (
        !newSubject &&
        !newObjective &&
        !newEquipmentUsed &&
        newReferences.length === 0 &&
        newSchedule.length === 0
      ) {
        toast.error("ບໍ່ພົບຂໍ້ມູນທີ່ກົງກັບຮູບແບບໄຟລ໌");
        return;
      }

      if (newSubject) setSubject(newSubject);
      if (newObjective) setObjective(newObjective);
      if (newEquipmentUsed) setEquipmentUsed(newEquipmentUsed);
      if (newReferences.length > 0) setReferences(newReferences);
      if (newSchedule.length > 0) setScheduleDetails(newSchedule);
      markDirty();
      toast.success("ດຶງຂໍ້ມູນຈາກ Excel ສຳເລັດ");
    } catch (err) {
      console.error(err);
      toast.error("ອ່ານໄຟລ໌ Excel ລົ້ມເຫລວ ກະລຸນາກວດສອບຮູບແບບໄຟລ໌");
    } finally {
      setIsParsingExcel(false);
    }
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────

  function resetForm() {
    setStep(1);
    setActivityCode(null);
    setSubject("");
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
      const activity = activityMeta!;
      const now = new Date().toISOString();

      // Trip dates aren't picked manually anymore — derive them from whichever
      // schedule days have a real calendar date (calendar picker or Excel date cell).
      const scheduleIsoDates = scheduleDetails
        .map((d) => d.dateIso)
        .filter((d): d is string => !!d)
        .sort();
      const derivedStartDate = scheduleIsoDates[0] ?? "";
      const derivedEndDate =
        scheduleIsoDates[scheduleIsoDates.length - 1] ?? "";
      const derivedDurationDays = scheduleDetails.length;
      const monthKey = derivedStartDate
        ? format(parseISO(derivedStartDate), "MM-yyyy")
        : format(new Date(now), "MM-yyyy");

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

      let docLink: string | null = null;
      if (docFile) {
        const ext = docFile.name.split(".").pop() ?? "file";
        const storageRef = ref(
          storage,
          `workOutside/${user.uid}/${Date.now()}.${ext}`,
        );
        const snapshot = await uploadBytes(storageRef, docFile);
        docLink = await getDownloadURL(snapshot.ref);
      }

      const participantIds = [
        ...new Set([user.uid, ...teammates.map((t) => t.uid)]),
      ];

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
        activityType: { code: activityCode!, name: activity.nameLo },
        subject,
        references: references.filter((r) => r.trim()),
        objective,
        scheduleDetails,
        equipmentUsed,
        departmentUid: requesterDept.uuid || "",
        requesterWorkLocationUid: requesterLoc.uuid || "",
        startDate: derivedStartDate,
        endDate: derivedEndDate,
        durationDays: derivedDurationDays,
        monthKey,
        teammateTitle: teammates.length,
        teammate: teammates,
        participantIds,
        participantUids: participantIds,
        participantCount: participantIds.length,
        updatedAt: now,
        updatedBy: fullNameEn,
        docLink,
      };

      if (isEditMode && initialData) {
        const cleanPayload = stripUndefined(payload);
        const initialDataRecord = initialData as unknown as Record<string, unknown>;
        const before = Object.fromEntries(
          Object.keys(cleanPayload).map((key) => [key, initialDataRecord[key]]),
        );
        await updateDoc(doc(db, "workOutside", initialData.id), cleanPayload);
        await logAudit({
          action: "offsite.request.update",
          actorUid: user.uid ?? user.id ?? "",
          actorName: fullNameEn,
          actorRoleUuid: user.rolesUid ?? "",
          actorRoleName: user.rolesName,
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
        const isLPB = !!user.rolePermissions?.LPB;
        const requiredApprovers = isLPB
          ? ["departmentHead", "hr", "manager"]
          : ["departmentHead", "hr"];
        const approvals = isLPB
          ? [
              { role: "departmentHead", decision: "pending" },
              { role: "hr", decision: "pending" },
              { role: "manager", decision: "pending" },
            ]
          : [
              { role: "departmentHead", decision: "pending" },
              { role: "hr", decision: "pending" },
            ];
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
        targetType: "workOutside",
        targetId: initialData?.id ?? "",
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      toast.error("ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່");
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ACTIVITIES.map(({ code, Icon, nameLo, nameEn, desc }) => {
              const selected = activityCode === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setActivityCode(code)}
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
                      {nameLo}
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
            <h2 className="text-base font-semibold text-foreground">
              ລາຍລະອຽດການປະຕິບັດງານ
            </h2>
            <p className="text-sm text-muted-foreground">
              ປະເພດ:{" "}
              <span className="font-medium text-foreground">
                {activityMeta?.nameLo}
              </span>
            </p>
          </div>

          <div className="rounded-lg border border-dashed p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <FileSpreadsheet className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  ອັບໂຫລດ Excel ເພື່ອຕື່ມຂໍ້ມູນອັດຕະໂນມັດ
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  ຫົວຂໍ້, ອີງຕາມ, ຈຸດປະສົງ, ອຸປະກອນ ແລະ ຕາຕະລາງກຳນົດການ
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

            <Field>
              <FieldLabel>
                ອີງຕາມ{" "}
                <span className="text-muted-foreground text-xs">
                  (ທາງເລືອກ)
                </span>
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

            <Field>
              <FieldLabel>
                ຈຸດປະສົງ{" "}
                <span className="text-muted-foreground text-xs">
                  (ທາງເລືອກ)
                </span>
              </FieldLabel>
              <Textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="ຈຸດປະສົງຂອງການເດີນທາງ..."
              />
            </Field>

            <Field>
              <FieldLabel>
                ຕາຕະລາງກຳນົດການ{" "}
                <span className="text-muted-foreground text-xs">
                  (ທາງເລືອກ)
                </span>
              </FieldLabel>
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

            <Field>
              <FieldLabel>
                ອຸປະກອນທີ່ນຳໃຊ້{" "}
                <span className="text-muted-foreground text-xs">
                  (ທາງເລືອກ)
                </span>
              </FieldLabel>
              <Textarea
                value={equipmentUsed}
                onChange={(e) => setEquipmentUsed(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="ອຸປະກອນ, ພາຫະນະ ແລະ ອື່ນໆ ທີ່ນຳໃຊ້..."
              />
            </Field>

            <Field>
              <FieldLabel>ເອກະສານອ້າງອີງ (ຖ້າມີ)</FieldLabel>
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
            </Field>
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
                      {activityMeta.nameLo}{" "}
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

                  {objective && (
                    <>
                      <dt className="text-muted-foreground">ຈຸດປະສົງ</dt>
                      <dd className="font-medium break-words line-clamp-2">
                        {objective}
                      </dd>
                    </>
                  )}

                  {references.some((r) => r.trim()) && (
                    <>
                      <dt className="text-muted-foreground">ອີງຕາມ</dt>
                      <dd className="font-medium break-words">
                        {references.filter((r) => r.trim()).length} ລາຍການ
                      </dd>
                    </>
                  )}

                  {scheduleDetails.length > 0 && (
                    <>
                      <dt className="text-muted-foreground">ຕາຕະລາງກຳນົດການ</dt>
                      <dd className="font-medium">
                        {scheduleDetails.length} ມື້,{" "}
                        {scheduleDetails.reduce(
                          (n, d) => n + d.timeline.length,
                          0,
                        )}{" "}
                        ຊ່ວງເວລາ
                      </dd>
                    </>
                  )}

                  {equipmentUsed && (
                    <>
                      <dt className="text-muted-foreground">ອຸປະກອນ</dt>
                      <dd className="font-medium break-words line-clamp-2">
                        {equipmentUsed}
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
