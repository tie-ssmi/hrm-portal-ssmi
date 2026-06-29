"use client";

// ** core
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ** assets / icons
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarRange,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  ShieldUser,
  Timer,
  UserRound,
  XCircle,
} from "lucide-react";

// ** shared components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

// ** third party
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ** config / utils / types / hooks
import { useAuth } from "@/lib/auth-context";
import type { LeaveApprovalStep, LeaveApproverRole } from "@/lib/types";

// ** services
import { fetchLeaveById, updateLeaveApproval } from "@/services/leaves";

// ─── Constants ────────────────────────────────────────────────────────────────

const roleLabel: Record<LeaveApproverRole, string> = {
  departmentHead: "ຫົວໜ້າພະແນກ",
  hr: "ຝ່າຍ HR",
  manager: "ຜູ້ຈັດການ",
};

const periodLabel: Record<string, string> = {
  morning: "ເຊົ້າ",
  afternoon: "ບ່າຍ",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ApprovalStepRow({
  step,
  index,
  total,
}: {
  step: LeaveApprovalStep;
  index: number;
  total: number;
}) {
  const isApproved = step.decision === "approved";
  const isRejected = step.decision === "rejected";
  const isPending = step.decision === "pending";

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
            {roleLabel[step.role]}
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
        {step.reviewedBy && (
          <p className="text-muted-foreground mt-0.5 text-xs">
            ໂດຍ: {step.reviewedBy}
          </p>
        )}
        {step.reviewedAt && (
          <p className="text-muted-foreground text-xs">
            {new Date(step.reviewedAt).toLocaleDateString("lo-LA", {
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

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-card flex items-start gap-3 rounded-lg border p-3">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-foreground text-sm font-medium wrap-break-word">
          {value || "-"}
        </p>
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

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LeaveDetailClient({ leaveId }: { leaveId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const id = leaveId || searchParams.get("id") || "";

  const { data: leave, isLoading } = useQuery({
    queryKey: ["leave", id],
    queryFn: () => fetchLeaveById(id),
    enabled: !!id,
  });

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canApproveDept = user?.rolePermissions?.approveDepartment ?? false;
  const canApproveBranch = user?.rolePermissions?.approveBranch ?? false;
  const myRoles: LeaveApproverRole[] = [];
  if (canApproveDept) myRoles.push("departmentHead");
  if (canApproveBranch) myRoles.push("manager");
  if (canApproveDept || canApproveBranch) myRoles.push("hr");

  const pendingSlot = (leave?.approvals ?? []).find(
    (a) => a?.decision === "pending" && myRoles.includes(a.role),
  );
  const pendingIndex =
    leave?.approvals?.findIndex(
      (a) => a?.decision === "pending" && myRoles.includes(a.role),
    ) ?? -1;
  const canAct = leave?.status === "pending" && !!pendingSlot;

  const reviewedBy =
    [user?.firstNameLo || user?.firstName, user?.lastNameLo || user?.lastName]
      .filter(Boolean)
      .join(" ") ||
    user?.uid ||
    user?.id ||
    "";
  const reviewedByUid = user?.uid || user?.id || "";

  const handleConfirmApprove = async () => {
    if (!leave || !confirmChecked) return;
    setIsSubmitting(true);
    try {
      await updateLeaveApproval({
        leaveId: leave.id,
        approvalIndex: pendingIndex,
        decision: "approved",
        reviewedBy,
        reviewedByUid,
      });
      await queryClient.invalidateQueries({ queryKey: ["leave", id] });
      await queryClient.invalidateQueries({ queryKey: ["leaves"] });
      toast.success("ອະນຸມັດສຳເລັດ");
      setApproveOpen(false);
      setConfirmChecked(false);
    } catch {
      toast.error("ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!leave) return;
    setIsSubmitting(true);
    try {
      await updateLeaveApproval({
        leaveId: leave.id,
        approvalIndex: pendingIndex,
        decision: "rejected",
        reviewedBy,
        reviewedByUid,
        rejectReason: rejectReason.trim() || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ["leave", id] });
      await queryClient.invalidateQueries({ queryKey: ["leaves"] });
      toast.success("ປະຕິເສດສຳເລັດ");
      setRejectOpen(false);
      setRejectReason("");
    } catch {
      toast.error("ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <DetailSkeleton />;

  if (!leave) {
    return (
      <div className="space-y-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> ກັບຄືນ
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-semibold">ບໍ່ພົບຂໍ້ມູນ</p>
            <p className="text-muted-foreground mt-1 text-sm">ID: {id}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const validApprovals = (leave.approvals ?? []).filter(
    (a): a is LeaveApprovalStep => !!a,
  );

  const startLabel = periodLabel[leave.startPeriod ?? ""] ?? "";
  const endLabel = periodLabel[leave.endPeriod ?? ""] ?? "";

  return (
    <>
      <div className="space-y-5 pb-24">
        {/* Back + Banner */}
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
            <p className="text-muted-foreground text-xs">ປະເພດລາພັກ</p>
            <p className="text-foreground mt-0.5 text-base font-semibold">
              {leave.policyName || leave.type}
            </p>
            <h1 className="text-foreground mt-1 text-lg leading-tight font-bold">
              {leave.leaveUserName || leave.createdBy}
            </h1>
            {leave.createdAt && (
              <p className="text-muted-foreground mt-1 text-xs">
                ຍື່ນວັນທີ:{" "}
                {leave.createdAt.includes("T")
                  ? new Date(leave.createdAt).toLocaleDateString("lo-LA", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : leave.createdAt}
              </p>
            )}
          </div>
        </div>

        {/* Status Banner */}
        <StatusBanner status={leave.status} />

        {/* Employee Info */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <InfoRow
            icon={<UserRound className="h-4 w-4" />}
            label="ພະນັກງານ"
            value={leave.leaveUserName || leave.createdBy || ""}
          />
          <InfoRow
            icon={<Briefcase className="h-4 w-4" />}
            label="ຕໍາແໜ່ງ"
            value={leave.jobTitle || ""}
          />
          <InfoRow
            icon={<Building2 className="h-4 w-4" />}
            label="ພະແນກ"
            value={leave.departmentNameLo || leave.departmentNameEn || ""}
          />
          <InfoRow
            icon={<ShieldUser className="h-4 w-4" />}
            label="ຜູ້ຮັບວຽກຕໍ່"
            value={leave.successorNameLo || leave.successorNameEn || ""}
          />
        </div>

        {/* Schedule */}
        <Card>
          <CardHeader className="px-4 pt-4 pb-3">
            <CardTitle className="text-sm font-semibold">ໄລຍະເວລາລາ</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <InfoRow
                icon={<CalendarRange className="h-4 w-4" />}
                label="ວັນເລີ່ມ"
                value={`${leave.startDate}${startLabel ? ` (${startLabel})` : ""}`}
              />
              <InfoRow
                icon={<CalendarRange className="h-4 w-4" />}
                label="ວັນສິ້ນສຸດ"
                value={`${leave.endDate}${endLabel ? ` (${endLabel})` : ""}`}
              />
              <InfoRow
                icon={<Timer className="h-4 w-4" />}
                label="ຈຳນວນວັນ"
                value={
                  leave.duration != null
                    ? leave.duration === 0.5
                      ? "0.5 ວັນ"
                      : `${leave.duration} ວັນ`
                    : "-"
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Reason */}
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground mb-1.5 inline-flex items-center gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" /> ເຫດຜົນ
          </p>
          <p className="text-foreground text-sm leading-6">
            {leave.reason || "-"}
          </p>
        </div>

        {/* Document */}
        {(leave.docStatus === "now" || leave.docLink) &&
          (leave.docLink ? (
            <a href={leave.docLink} target="_blank" rel="noopener noreferrer">
              <div className="border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 mb-2 flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">ເບິ່ງເອກະສານທີ່ແນບ</span>
                <ExternalLink className="h-4 w-4 shrink-0" />
              </div>
            </a>
          ) : (
            <div className="border-muted bg-muted/30 text-muted-foreground flex items-center gap-2 rounded-lg border p-3 text-sm">
              <FileText className="h-4 w-4 shrink-0" />
              <span>ເອກະສານຖືກແນບມາ (ລໍຖ້າໂຫລດ...)</span>
            </div>
          ))}

        {/* Approval Timeline */}
        {validApprovals.length > 0 && (
          <Card>
            <CardHeader className="px-4 pt-4 pb-3">
              <CardTitle className="text-sm font-semibold">
                ຂັ້ນຕອນການອະນຸມັດ
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="px-4 pt-4 pb-2">
              {validApprovals.map((step, i) => (
                <ApprovalStepRow
                  key={step.role}
                  step={step}
                  index={i}
                  total={validApprovals.length}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Meta */}
        <p className="text-muted-foreground/40 text-center text-xs">
          ID: {leave.id}
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
              onClick={() => setRejectOpen(true)}
              disabled={isSubmitting}
            >
              <XCircle className="h-4 w-4" /> ປະຕິເສດ
            </Button>
            <Button
              type="button"
              className="flex-1 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => setApproveOpen(true)}
              disabled={isSubmitting}
            >
              <CheckCircle2 className="h-4 w-4" /> ອະນຸມັດ
            </Button>
          </div>
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog
        open={approveOpen}
        onOpenChange={(o) => {
          setApproveOpen(o);
          if (!o) setConfirmChecked(false);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ຢືນຢັນການອະນຸມັດ</DialogTitle>
            <DialogDescription>
              ອະນຸມັດຄໍາຮ້ອງຂໍຂອງ{" "}
              <strong>{leave.leaveUserName || leave.createdBy}</strong>
            </DialogDescription>
          </DialogHeader>
          <label
            htmlFor="detail-confirm-approve"
            className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors select-none"
          >
            <Checkbox
              id="detail-confirm-approve"
              checked={confirmChecked}
              onCheckedChange={(v) => setConfirmChecked(v === true)}
              disabled={isSubmitting}
              className="mt-0.5 shrink-0"
            />
            <span className="text-sm leading-relaxed">
              ຂ້ອຍໄດ້ກວດສອບຂໍ້ມູນແລ້ວ ແລະ ຢືນຢັນການອະນຸມັດ
            </span>
          </label>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isSubmitting}>
                ຍົກເລີກ
              </Button>
            </DialogClose>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleConfirmApprove}
              disabled={!confirmChecked || isSubmitting}
            >
              {isSubmitting ? "ກຳລັງອະນຸມັດ..." : "ອະນຸມັດ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={rejectOpen}
        onOpenChange={(o) => {
          setRejectOpen(o);
          if (!o) setRejectReason("");
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ຢືນຢັນການປະຕິເສດ</DialogTitle>
            <DialogDescription>
              ປະຕິເສດຄໍາຮ້ອງຂໍຂອງ{" "}
              <strong>{leave.leaveUserName || leave.createdBy}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              ເຫດຜົນການປະຕິເສດ (ທາງເລືອກ)
            </p>
            <Textarea
              placeholder="ລະບຸເຫດຜົນ..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              disabled={isSubmitting}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isSubmitting}>
                ຍົກເລີກ
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={isSubmitting}
            >
              {isSubmitting ? "ກຳລັງດຳເນີນການ..." : "ປະຕິເສດ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
