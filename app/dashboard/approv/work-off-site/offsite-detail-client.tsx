"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { doc, getDoc, updateDoc, type DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ActivityTypeBadge } from "@/components/offsite/ActivityTypeBadge";
import { formatDateRange, formatLaoDate } from "@/lib/format";
import { toast } from "sonner";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  BookMarked,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  FileText,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";
import type { OffsiteRequestDoc } from "@/types/workOutside";

// ─── Sub-components ───────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  departmentHead: "ຫົວໜ້າພະແນກ",
  hr: "ຝ່າຍ HR",
  manager: "ຜູ້ຈັດການ",
};

function InfoField({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-lg border p-3">
      <div className="text-muted-foreground mb-1.5 inline-flex items-center gap-2 text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-foreground text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function ApprovalStep({
  approval,
  index,
  total,
}: {
  approval: {
    role: string;
    decision: string;
    reviewedBy?: string;
    reviewedAt?: string;
  };
  index: number;
  total: number;
}) {
  const isApproved = approval.decision === "approved";
  const isRejected = approval.decision === "rejected";
  const isPending = approval.decision === "pending";

  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
            isApproved
              ? "border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-950"
              : ""
          } ${isRejected ? "border-destructive bg-destructive/10 text-destructive" : ""} ${
            isPending
              ? "border-muted-foreground/30 bg-muted text-muted-foreground"
              : ""
          }`}
        >
          {isApproved ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : isRejected ? (
            <XCircle className="h-4 w-4" />
          ) : (
            <span>{index + 1}</span>
          )}
        </div>
        {index < total - 1 && (
          <div
            className={`mt-1 h-6 w-0.5 ${isApproved ? "bg-emerald-300 dark:bg-emerald-700" : "bg-muted"}`}
          />
        )}
      </div>

      <div className="flex-1 pb-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-foreground text-sm font-semibold">
            {ROLE_LABEL[approval.role] ?? approval.role}
          </p>
          <Badge
            variant={
              isApproved ? "default" : isRejected ? "destructive" : "secondary"
            }
            className={`text-xs ${isApproved ? "bg-emerald-600 hover:bg-emerald-600" : ""}`}
          >
            {isApproved ? "ອະນຸມັດແລ້ວ" : isRejected ? "ປະຕິເສດ" : "ລໍຖ້າ"}
          </Badge>
        </div>
        {approval.reviewedBy && (
          <p className="text-muted-foreground mt-0.5 text-xs">
            ໂດຍ: {approval.reviewedBy}
          </p>
        )}
        {approval.reviewedAt && (
          <p className="text-muted-foreground text-xs">
            {new Date(approval.reviewedAt).toLocaleDateString("lo-LA", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        )}
        {isPending && (
          <p className="text-muted-foreground/60 mt-0.5 text-xs">
            ຍັງບໍ່ໄດ້ດຳເນີນການ
          </p>
        )}
      </div>
    </div>
  );
}

function StatusBanner({ status }: { status: string }) {
  if (status === "approved")
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        ອະນຸມັດແລ້ວ
      </div>
    );
  if (status === "rejected")
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium">
        <XCircle className="h-4 w-4 shrink-0" />
        ປະຕິເສດແລ້ວ
      </div>
    );
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
      <Clock className="h-4 w-4 shrink-0" />
      ລໍຖ້າອະນຸມັດ
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6 pb-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-32 rounded-lg" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OffsiteDetailClient() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";

  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const {
    data: record,
    isLoading,
    error,
  } = useQuery<OffsiteRequestDoc | null>({
    queryKey: ["workOutside", id],
    queryFn: async () => {
      if (!id) return null;
      const snap = await getDoc(doc(db, "workOutside", id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as OffsiteRequestDoc;
    },
    enabled: !!id,
  });

  const canApproveDept = user?.rolePermissions?.approveDepartment ?? false;
  const canApproveBranch = user?.rolePermissions?.approveBranch ?? false;
  const myRoles: string[] = [];
  if (canApproveDept) myRoles.push("departmentHead");
  if (canApproveBranch) myRoles.push("manager");
  if (canApproveDept || canApproveBranch) myRoles.push("hr");

  const pendingSlot = (record?.approvals ?? []).find(
    (ap) => ap.decision === "pending" && myRoles.includes(ap.role),
  );
  const canAct = record?.status === "pending" && !!pendingSlot;

  async function handleConfirm() {
    if (!action || !confirmed || !record) return;
    const reviewedBy =
      [user?.firstNameLo || user?.firstName, user?.lastNameLo || user?.lastName]
        .filter(Boolean)
        .join(" ") ||
      user?.uid ||
      "";
    const now = new Date().toISOString();

    setIsProcessing(true);
    try {
      const approvalRole =
        pendingSlot?.role ?? (canApproveDept ? "departmentHead" : "manager");
      const approvalIndex = record.approvals.findIndex(
        (ap) => ap.role === approvalRole,
      );
      const decision = action === "approve" ? "approved" : "rejected";

      const payload: Record<string, unknown> = {
        updatedAt: now,
        updatedBy: reviewedBy,
      };

      if (approvalIndex >= 0) {
        const updatedApprovals = record.approvals.map((ap, i) =>
          i === approvalIndex
            ? { ...ap, decision, reviewedBy, reviewedAt: now }
            : ap,
        );
        payload.approvals = updatedApprovals;

        const anyRejected = updatedApprovals.some(
          (ap) => ap.decision === "rejected",
        );
        const allApproved = updatedApprovals.every(
          (ap) => ap.decision === "approved",
        );
        if (anyRejected) payload.status = "rejected";
        else if (allApproved) payload.status = "approved";
      } else {
        payload.status = decision;
      }

      if (decision === "rejected" && rejectReason.trim()) {
        payload.rejectReason = rejectReason.trim();
      }

      await updateDoc(
        doc(db, "workOutside", record.id),
        payload as DocumentData,
      );
      await queryClient.invalidateQueries({ queryKey: ["workOutside", id] });
      toast.success(action === "approve" ? "ອະນຸມັດສຳເລັດ" : "ປະຕິເສດສຳເລັດ");
      setAction(null);
      setConfirmed(false);
      setRejectReason("");
    } catch {
      toast.error("ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່");
    } finally {
      setIsProcessing(false);
    }
  }

  if (isLoading) return <PageSkeleton />;

  if (error || !record) {
    return (
      <div className="space-y-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          ກັບຄືນ
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-semibold">ບໍ່ພົບຂໍ້ມູນ</p>
            <p className="text-muted-foreground mt-1 text-sm">ຄຳຂໍ ID: {id}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5 pb-24">
        {/* Back + Header */}
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-2 -ml-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            ກັບຄືນ
          </Button>

          <div className="border-primary/20 from-primary/8 to-background rounded-xl border bg-linear-to-r p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground font-mono text-xs">
                {record.requestNo}
              </span>
              <ActivityTypeBadge code={record.activityType.code} />
            </div>
            <h1 className="text-foreground text-lg font-bold">
              {record.subject}
            </h1>
            {record.createdAt && (
              <p className="text-muted-foreground mt-1 text-xs">
                ຍື່ນວັນທີ: {formatLaoDate(record.createdAt.slice(0, 10))}
              </p>
            )}
          </div>
        </div>

        {/* Status Banner */}
        <StatusBanner status={record.status} />

        {/* Requester */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <InfoField
            label="ຜູ້ຍື່ນຄຳຂໍ"
            value={record.requester.fullNameLo || record.requester.fullNameEn}
            icon={<Users className="h-3.5 w-3.5" />}
          />
          <InfoField
            label="ຕໍາແໜ່ງ"
            value={record.requester.jobTitle}
            icon={<Briefcase className="h-3.5 w-3.5" />}
          />
          <InfoField
            label="ພະແນກ"
            value={
              record.requester.department.title ||
              record.requester.department.department
            }
            icon={<Building2 className="h-3.5 w-3.5" />}
          />
        </div>

        {/* Trip Details */}
        <Card>
          <CardHeader className="px-4 pt-4 pb-3">
            <CardTitle className="text-sm font-semibold">
              ລາຍລະອຽດການເດີນທາງ
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <InfoField
                label="ວັນທີ"
                value={`${formatDateRange(record.startDate, record.endDate)} (${record.durationDays} ມື້)`}
                icon={<CalendarRange className="h-3.5 w-3.5" />}
              />
            </div>

            {record.objective && (
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground mb-1.5 inline-flex items-center gap-1.5 text-xs">
                  <ClipboardList className="h-3.5 w-3.5" /> ຈຸດປະສົງ
                </p>
                <p className="text-foreground text-sm leading-6 whitespace-pre-wrap">
                  {record.objective}
                </p>
              </div>
            )}

            {record.references?.length > 0 && (
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground mb-1.5 inline-flex items-center gap-1.5 text-xs">
                  <BookMarked className="h-3.5 w-3.5" /> ອີງຕາມ
                </p>
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  {record.references.map((ref, i) => (
                    <li key={i}>{ref}</li>
                  ))}
                </ul>
              </div>
            )}

            {record.scheduleDetails?.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-2 inline-flex items-center gap-1.5 text-xs">
                  <CalendarRange className="h-3.5 w-3.5" /> ຕາຕະລາງກຳນົດການ
                </p>
                <div className="space-y-2">
                  {record.scheduleDetails.map((day, i) => (
                    <div key={i} className="rounded-lg border p-3">
                      <p className="text-sm font-semibold">{day.date}</p>
                      <div className="mt-2 space-y-1.5">
                        {day.timeline.map((entry, j) => (
                          <div key={j} className="flex gap-3 text-sm">
                            <span className="text-muted-foreground w-28 shrink-0">
                              {entry.time}
                            </span>
                            <span className="flex-1">{entry.details}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {record.equipmentUsed && (
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground mb-1.5 inline-flex items-center gap-1.5 text-xs">
                  <Wrench className="h-3.5 w-3.5" /> ອຸປະກອນທີ່ນຳໃຊ້
                </p>
                <p className="text-foreground text-sm leading-6 whitespace-pre-wrap">
                  {record.equipmentUsed}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Document */}
        {record.docLink && (
          <a href={record.docLink} target="_blank" rel="noopener noreferrer">
            <div className="border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 mb-2 flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">ເບິ່ງເອກະສານທີ່ແນບ</span>
              <ExternalLink className="h-4 w-4 shrink-0" />
            </div>
          </a>
        )}

        {/* Teammates */}
        {record.teammate.length > 0 && (
          <Card>
            <CardHeader className="px-4 pt-4 pb-3">
              <CardTitle className="text-sm font-semibold">
                ສະມາຊິກທີມ ({record.teammate.length} ຄົນ)
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              <div className="space-y-2">
                {record.teammate.map((tm) => (
                  <div
                    key={tm.uid}
                    className="bg-muted/30 flex items-center justify-between rounded-lg border px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {tm.fullNameLo || tm.fullNameEn}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {tm.jobTitle}
                      </p>
                    </div>
                    <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-xs">
                      {tm.position}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Approval Timeline */}
        <Card>
          <CardHeader className="px-4 pt-4 pb-3">
            <CardTitle className="text-sm font-semibold">
              ຂັ້ນຕອນການອະນຸມັດ
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="px-4 pt-4 pb-2">
            {record.approvals.map((ap, i) => (
              <ApprovalStep
                key={ap.role}
                approval={ap}
                index={i}
                total={record.approvals.length}
              />
            ))}
          </CardContent>
          {record.rejectReason && (
            <div className="border-destructive/30 bg-destructive/5 text-destructive mx-4 mb-4 rounded-lg border p-3 text-sm">
              ເຫດຜົນປະຕິເສດ: {record.rejectReason}
            </div>
          )}
        </Card>

        {/* Meta */}
        <p className="text-muted-foreground/40 text-center text-xs">
          {record.requestNo} · ສ້າງໂດຍ {record.createdBy} ·{" "}
          {formatLaoDate(record.createdAt.slice(0, 10))}
        </p>
      </div>

      {/* Sticky Action Bar */}
      {canAct && (
        <div className="bg-background/95 supports-backdrop-filter:bg-background/80 safe-bottom border-t px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-lg gap-3">
            <Button
              type="button"
              variant="outline"
              className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive flex-1 gap-2"
              onClick={() => {
                setAction("reject");
                setConfirmed(false);
              }}
              disabled={isProcessing}
            >
              <XCircle className="h-4 w-4" /> ປະຕິເສດ
            </Button>
            <Button
              type="button"
              className="flex-1 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => {
                setAction("approve");
                setConfirmed(false);
              }}
              disabled={isProcessing}
            >
              <CheckCircle2 className="h-4 w-4" /> ອະນຸມັດ
            </Button>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <Dialog
        open={!!action}
        onOpenChange={(open) => {
          if (!open) {
            setAction(null);
            setConfirmed(false);
            setRejectReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {action === "approve" ? "ຢືນຢັນການອະນຸມັດ" : "ຢືນຢັນການປະຕິເສດ"}
            </DialogTitle>
            <DialogDescription>
              {action === "approve" ? "ອະນຸມັດ" : "ປະຕິເສດ"}ຄຳຂໍ{" "}
              <span className="font-mono font-semibold">
                {record.requestNo}
              </span>
            </DialogDescription>
          </DialogHeader>

          {action === "reject" && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">
                ເຫດຜົນການປະຕິເສດ (ທາງເລືອກ)
              </p>
              <Textarea
                placeholder="ລະບຸເຫດຜົນ..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                disabled={isProcessing}
              />
            </div>
          )}

          <label
            htmlFor="confirm-action"
            className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors select-none"
          >
            <Checkbox
              id="confirm-action"
              checked={confirmed}
              onCheckedChange={(v) => setConfirmed(v === true)}
              disabled={isProcessing}
              className="mt-0.5 shrink-0"
            />
            <span className="text-sm leading-relaxed">
              ຂ້ອຍໄດ້ກວດສອບຂໍ້ມູນແລ້ວ ແລະ ຢືນຢັນການ
              {action === "approve" ? "ອະນຸມັດ" : "ປະຕິເສດ"}
            </span>
          </label>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isProcessing}>
                ຍົກເລີກ
              </Button>
            </DialogClose>
            <Button
              variant={action === "reject" ? "destructive" : "default"}
              className={
                action === "approve"
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : ""
              }
              onClick={handleConfirm}
              disabled={!confirmed || isProcessing}
            >
              {isProcessing
                ? "ກຳລັງດຳເນີນການ..."
                : action === "approve"
                  ? "ອະນຸມັດ"
                  : "ປະຕິເສດ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
