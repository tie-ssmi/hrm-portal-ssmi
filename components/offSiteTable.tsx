"use client";

// ** core
import { useState, useMemo, useCallback, useEffect } from "react";

// ** assets / icons
import {
  CalendarRange,
  Eye,
  Check,
  X,
  MoreHorizontal,
  UserRound,
  HelpCircle,
} from "lucide-react";

// ** shared components
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/offsite/StatusBadge";

// ** third party
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// ─── Types ────────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  departmentHead: "ຫົວໜ້າພະແນກ",
  hr: "HR",
  manager: "ຜູ້ຈັດການ",
};

export type ApprovalEntry = {
  role: string;
  decision: string;
  reviewedAt?: string;
  reviewedBy?: string;
};

export type ParticipantEntry = {
  uid: string;
  fullNameEn: string;
  fullNameLo: string;
  department?: { uuid: string; title: string; department: string };
  image?: string | null;
};

export type TeammateEntry = {
  uid: string;
  fullNameEn: string;
  fullNameLo: string;
  jobTitle?: string;
  photoUrl?: string;
  roleInTrip?: string;
  department?: { uuid: string; title: string; department: string };
};

export type OffsiteTableItem = {
  id: string;
  requestNo?: string;
  requester?: {
    uid?: string;
    fullNameEn?: string;
    fullNameLo?: string;
    jobTitle?: string;
    department?: { uuid: string; title: string; department: string };
    workLocation?: { uuid: string; code: string; nameLo: string };
  };
  activityType?: { code: string; name: string };
  subject?: string;
  details?: string;
  customerName?: string;
  location?: string;
  startDate: string;
  endDate: string;
  durationDays?: number;
  estimatedCost?: number;
  status?: "pending" | "approved" | "rejected" | "cancelled";
  approvals?: ApprovalEntry[];
  teammate?: TeammateEntry[];
  participantIds?: ParticipantEntry[];
  createdAt?: string;
  createdBy?: string;
};

/** @deprecated use OffsiteTableItem */
export type LeaveTableItem = OffsiteTableItem;

type OffsiteTableProps = {
  data: OffsiteTableItem[];
  onViewDetail?: (item: OffsiteTableItem) => void;
  onApprove?: (item: OffsiteTableItem) => void;
  onReject?: (item: OffsiteTableItem) => void;
  canApproveBranch?: boolean;
  className?: string;
};

type TabValue = "all" | "pending" | "inprogress" | "rejected";

const TABS: { value: TabValue; label: string }[] = [
  { value: "all", label: "ທັງໝົດ" },
  { value: "pending", label: "ລໍຖ້າ" },
  { value: "inprogress", label: "ດຳເນີນການ" },
  { value: "rejected", label: "ປະຕິເສດ" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWhoPending(approvals?: ApprovalEntry[]): string | null {
  if (!Array.isArray(approvals)) return null;
  const pending = approvals
    .filter((a) => a?.decision === "pending")
    .map((a) => ROLE_LABEL[a.role] ?? a.role);
  return pending.length > 0 ? pending.join(", ") : null;
}

function getWhoRejected(approvals?: ApprovalEntry[]): string | null {
  if (!Array.isArray(approvals)) return null;
  const rejected = approvals
    .filter((a) => a?.decision === "rejected")
    .map((a) => ROLE_LABEL[a.role] ?? a.role);
  return rejected.length > 0 ? rejected.join(", ") : null;
}

function computeRowMeta(item: OffsiteTableItem) {
  const approvals = Array.isArray(item.approvals) ? item.approvals : [];

  const isFinal =
    item.status === "approved" ||
    item.status === "rejected" ||
    item.status === "cancelled";

  const deptHeadSlot = approvals.find((a) => a.role === "departmentHead");
  const canApprove = !isFinal && deptHeadSlot?.decision === "pending";

  const whoPending = getWhoPending(approvals);
  const whoRejected = getWhoRejected(approvals);
  return { canApprove, whoPending, whoRejected };
}

function tabMatch(item: OffsiteTableItem, tab: TabValue): boolean {
  const approvals = item.approvals ?? [];
  if (tab === "pending") {
    return (
      approvals.length > 0 && approvals.every((a) => a.decision === "pending")
    );
  }
  if (tab === "inprogress") {
    return (
      item.status !== "rejected" &&
      item.status !== "approved" &&
      item.status !== "cancelled" &&
      approvals.some((a) => a.decision === "approved") &&
      approvals.some((a) => a.decision === "pending")
    );
  }
  if (tab === "rejected") return item.status === "rejected";
  return true;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TeamAvatars({ teammates }: { teammates?: TeammateEntry[] }) {
  if (!teammates || teammates.length === 0)
    return <span className="text-sm text-muted-foreground">-</span>;

  const shown = teammates.slice(0, 3);
  const extra = teammates.length - shown.length;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((t) => {
          const initials = `${t.fullNameLo || t.fullNameEn}`
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          return (
            <Avatar key={t.uid} className="w-7 h-7 border-2 border-background">
              <AvatarImage src={t.photoUrl ?? undefined} alt={t.fullNameLo} />
              <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          );
        })}
      </div>
      {extra > 0 && (
        <span className="ml-1.5 text-xs text-muted-foreground">+{extra}</span>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OffsiteTable({
  data,
  onViewDetail,
  onApprove,
  onReject,
  canApproveBranch = false,
  className,
}: OffsiteTableProps) {
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [deptFilter, setDeptFilter] = useState("all");

  // ── Driver.js tour ──
  const TOUR_KEY = "offsite-table-tour-seen";

  const startTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      animate: true,
      overlayColor: "rgba(0,0,0,0.55)",
      nextBtnText: "ຕໍ່ໄປ",
      prevBtnText: "ກັບຄືນ",
      doneBtnText: "ເຂົ້າໃຈແລ້ວ",
      progressText: "{{current}} / {{total}}",
      steps: [
        {
          element: "#offsite-table-tabs",
          popover: {
            title: "ຕົວກັ່ນຕອງ",
            description: "ກັ່ນຕອງຕາມສະຖານະ: ທັງໝົດ, ລໍຖ້າ, ດຳເນີນການ, ປະຕິເສດ",
            side: "bottom" as const,
            align: "start" as const,
          },
        },
        {
          element: "#offsite-table-list",
          popover: {
            title: "ລາຍການຄໍາຮ້ອງຂໍ",
            description: "ເບິ່ງລາຍລະອຽດ, ອະນຸມັດ ຫຼື ປະຕິເສດ ແຕ່ລະຄໍາຮ້ອງ",
            side: "top" as const,
            align: "center" as const,
          },
        },
      ],
      onDestroyed: () => {
        localStorage.setItem(TOUR_KEY, "1");
      },
    });
    driverObj.drive();
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) {
      const timer = setTimeout(startTour, 600);
      return () => clearTimeout(timer);
    }
  }, [startTour]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    data.forEach((item) => {
      const dept = item.requester?.department?.title;
      if (dept) set.add(dept);
    });
    return Array.from(set).sort();
  }, [data]);

  const counts = useMemo(() => {
    const base =
      canApproveBranch && deptFilter !== "all"
        ? data.filter((i) => i.requester?.department?.title === deptFilter)
        : data;
    return {
      all: base.length,
      pending: base.filter((i) => tabMatch(i, "pending")).length,
      inprogress: base.filter((i) => tabMatch(i, "inprogress")).length,
      rejected: base.filter((i) => tabMatch(i, "rejected")).length,
    };
  }, [data, deptFilter, canApproveBranch]);

  const filtered = useMemo(() => {
    let result = data;
    if (canApproveBranch && deptFilter !== "all")
      result = result.filter(
        (i) => i.requester?.department?.title === deptFilter,
      );
    if (activeTab !== "all")
      result = result.filter((i) => tabMatch(i, activeTab));
    return result;
  }, [data, activeTab, deptFilter, canApproveBranch]);

  return (
    <Card className={className}>
      {/* Filter bar */}
      <div id="offsite-table-tabs" className="border-b px-4 pt-3 pb-0 space-y-3">
        {canApproveBranch && departments.length > 0 && (
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue placeholder="ທຸກພະແນກ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ທຸກພະແນກ</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex items-center gap-0 overflow-x-auto">
          <Button type="button" variant="ghost" size="icon" className="shrink-0 h-7 w-7 mr-1" onClick={startTour}>
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
          </Button>
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={[
                "relative flex items-center gap-1.5 px-3 pb-2.5 pt-1 text-sm whitespace-nowrap transition-colors",
                activeTab === tab.value
                  ? "text-foreground font-medium after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-t"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {tab.label}
              <span
                className={[
                  "inline-flex items-center justify-center rounded-full px-1.5 py-0 text-[10px] font-medium min-w-[18px]",
                  activeTab === tab.value
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {counts[tab.value]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <CardContent id="offsite-table-list" className="p-0">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            ບໍ່ມີລາຍການ
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 p-3 md:hidden">
              {filtered.map((item, index) => {
                const { canApprove, whoPending, whoRejected } = computeRowMeta(item);
                return (
                  <Card key={item.id} className="border bg-background">
                    <CardContent className="space-y-3 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <Avatar className="mt-0.5 h-8 w-8 shrink-0">
                            <AvatarImage
                              src={item.participantIds?.[0]?.image ?? undefined}
                              alt={item.requester?.fullNameLo}
                            />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              <UserRound className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">
                              #{index + 1} · {item.requestNo}
                            </p>
                            <p className="text-sm font-semibold text-foreground leading-tight truncate">
                              {item.requester?.fullNameLo}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {item.requester?.jobTitle || "-"} ·{" "}
                              {item.requester?.department?.title || "-"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                          <StatusBadge status={item.status ?? "pending"} />
                          {item.status === "pending" && whoPending && (
                            <span className="text-[10px] text-muted-foreground">
                              {whoPending}
                            </span>
                          )}
                          {item.status === "rejected" && whoRejected && (
                            <span className="text-[10px] text-destructive">
                              {whoRejected}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Activity + Subject */}
                      <div>
                        {item.activityType && (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground mb-1">
                            {item.activityType.name}
                          </span>
                        )}
                        {item.subject && (
                          <p className="text-sm text-foreground leading-5 line-clamp-2">
                            {item.subject}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {item.startDate} – {item.endDate}
                        </span>
                        {item.durationDays && (
                          <span className="text-muted-foreground">
                            ({item.durationDays} ມື້)
                          </span>
                        )}
                      </div>

                      {(item.teammate?.length ?? 0) > 0 && (
                        <div className="flex items-center gap-2">
                          <TeamAvatars teammates={item.teammate} />
                          <span className="text-xs text-muted-foreground">
                            {item.teammate!.length} ຄົນ
                          </span>
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => onViewDetail?.(item)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          ລາຍລະອຽດ
                        </Button>
                        {canApprove && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              className="flex-1"
                              onClick={() => onApprove?.(item)}
                            >
                              <Check className="h-3.5 w-3.5 mr-1" />
                              ອະນຸມັດ
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="flex-1"
                              onClick={() => onReject?.(item)}
                            >
                              <X className="h-3.5 w-3.5 mr-1" />
                              ປະຕິເສດ
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-muted/40">
                    <TableHead className="w-12 px-4">#</TableHead>
                    <TableHead className="px-4 min-w-[200px]">
                      ຊື່ / ຕໍາແໜ່ງ
                    </TableHead>
                    <TableHead className="px-4 min-w-[180px]">
                      ກິດຈະກຳ / ຫົວຂໍ້
                    </TableHead>
                    <TableHead className="px-4 min-w-[140px]">ວັນທີ</TableHead>
                    <TableHead className="px-4 min-w-[120px]">
                      ສະມາຊິກ
                    </TableHead>
                    <TableHead className="px-4 w-32">ສະຖານະ</TableHead>
                    <TableHead className="px-4 w-12 text-right">...</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filtered.map((item, index) => {
                    const { canApprove, whoPending, whoRejected } =
                      computeRowMeta(item);
                    return (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell className="px-4 py-3 font-semibold text-muted-foreground text-sm">
                          {index + 1}
                        </TableCell>

                        {/* Requester */}
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage
                                src={
                                  item.participantIds?.[0]?.image ?? undefined
                                }
                                alt={item.requester?.fullNameLo}
                              />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                <UserRound className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground">
                                {item.requestNo}
                              </p>
                              <p className="text-sm font-medium text-foreground truncate">
                                {item.requester?.fullNameLo}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {item.requester?.jobTitle || "-"} ·{" "}
                                {item.requester?.department?.title || "-"}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        {/* Activity + Subject */}
                        <TableCell className="px-4 py-3">
                          {item.activityType && (
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground mb-1">
                              {item.activityType.name}
                            </span>
                          )}
                          <p className="text-sm text-foreground line-clamp-2 max-w-[180px]">
                            {item.subject || "-"}
                          </p>
                        </TableCell>

                        {/* Dates */}
                        <TableCell className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarRange className="h-3 w-3 shrink-0" />
                            <span>
                              {item.startDate} – {item.endDate}
                            </span>
                          </div>
                          {item.durationDays && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {item.durationDays} ມື້
                            </p>
                          )}
                        </TableCell>

                        {/* Teammates */}
                        <TableCell className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <TeamAvatars teammates={item.teammate} />
                            {(item.teammate?.length ?? 0) > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {item.teammate!.length} ຄົນ
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <StatusBadge status={item.status ?? "pending"} />
                            {item.status === "pending" && whoPending && (
                              <span className="text-[10px] text-muted-foreground">
                                {whoPending}
                              </span>
                            )}
                            {item.status === "rejected" && whoRejected && (
                              <span className="text-[10px] text-destructive">
                                {whoRejected}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label="ຕົວເລືອກ"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => onViewDetail?.(item)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                ເບິ່ງລາຍລະອຽດ
                              </DropdownMenuItem>
                              {canApprove && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => onApprove?.(item)}
                                  >
                                    <Check className="h-4 w-4 mr-2" />
                                    ອະນຸມັດ
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => onReject?.(item)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    ປະຕິເສດ
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
