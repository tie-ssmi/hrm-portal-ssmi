"use client";
// ** core
import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// ** assets / icons
import { Palmtree, MapPin } from "lucide-react";

// ** shared components
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import FormsSkeleton from "@/components/skeletons/formsSkeleton";
import LeaveTable from "@/components/leaveTable";
import OffsiteTable from "@/components/offSiteTable";

// ** third party
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { toast } from "sonner";

// ** config / utils / types / hooks
import { useAuth } from "@/lib/auth-context";
import { getVientianeIsoDate } from "@/lib/server-time";
import { db } from "@/lib/firebase";
import type { LeaveTableItem } from "@/components/leaveTable";
import type { OffsiteTableItem } from "@/components/offSiteTable";
import type { OffsiteRequestDoc } from "@/types/workOutside";

// ** services
import { fetchLeavesForApproval, updateLeaveApproval } from "@/services/leaves";
import { extractWorkLocationLog } from "@/services/audit-log";
import {
  getOffsiteApprovalBlock,
  offsiteApprovalErrorMessage,
  type OffsiteApprover,
} from "@/services/offsite-approval";
import { updateOffsiteApproval } from "@/services/workOutside";

export default function ApprovePage() {
  return <ApprovePageContent />;
}

function ApprovePageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading } = useAuth();

  // ── ຂໍ້ມູນ user ແລະ ສິດອະນຸມັດ ──────────────────────────────────────────────
  const loggedInUserUuid = user?.uid || user?.id || "";
  const departmentUuid =
    typeof user?.department === "object"
      ? (user.department as { uuid?: string })?.uuid
      : undefined;
  const workLocationUuid =
    typeof user?.workLocation === "object"
      ? (user.workLocation as { uuid?: string })?.uuid
      : undefined;
  const canApproveDept = user?.rolePermissions?.approveDepartment ?? false;
  const canApproveBranch = user?.rolePermissions?.approveBranch ?? false;
  // FIX #1: canApproveAny ບໍ່ໄດ້ declare ໃນ version ເກົ່າ → queries ບໍ່ເຄີຍ run ເລີຍ
  const canApproveAny = canApproveDept || canApproveBranch;
  const isUnauthorized = !isLoading && !canApproveAny;
  const offsiteApprover: OffsiteApprover = {
    uid: loggedInUserUuid,
    workLocationUuid: workLocationUuid,
    departmentUuid: departmentUuid,
    canApproveDepartment: canApproveDept,
    canApproveBranch,
  };

  // ເຖິງວ່າຈະ unauthorized ກໍ່ຕ້ອງ declare hooks ທັງໝົດກ່ອນ return
  // ຖ້າ return null ກ່ອນ hooks ຈະເກີດ "Rendered fewer hooks than expected"
  useEffect(() => {
    if (isUnauthorized) router.push("/dashboard");
  }, [isUnauthorized, router]);

  // ── Leave approval query ────────────────────────────────────────────────────
  const leaveQueryKey = useMemo(
    () => [
      "leaves",
      "approval",
      canApproveBranch ? "branch" : (departmentUuid ?? null),
      workLocationUuid ?? null,
      loggedInUserUuid,
    ],
    [canApproveBranch, departmentUuid, workLocationUuid, loggedInUserUuid],
  );

  const { data: leaveRequests = [] } = useQuery({
    queryKey: leaveQueryKey,
    queryFn: async () => {
      return fetchLeavesForApproval({
        departmentUid: departmentUuid!,
        workLocationUid: workLocationUuid!,
        excludeUserUuid: loggedInUserUuid,
        canApproveBranch,
      });
    },
    // FIX #1: ໃຊ້ canApproveAny ທີ່ declare ຢ່າງຖືກຕ້ອງແລ້ວ
    enabled:
      !!workLocationUuid &&
      (canApproveBranch || !!departmentUuid) &&
      !!loggedInUserUuid &&
      canApproveAny,
  });

  const leaveTableData = useMemo(
    () =>
      leaveRequests.map((r) => ({
        id: r.id,
        name: r.leaveUserName || r.createdBy || "",
        position: r.jobTitle,
        department: r.departmentNameEn || r.departmentNameLo,
        reason: r.reason,
        successor: r.successorNameEn || r.successorNameLo,
        startDate: r.startDate,
        endDate: r.endDate,
        duration: r.duration,
        note: undefined as string | undefined,
        type: r.policyName ? { name: r.policyName } : { name: r.type },
        // A withdrawn leave must not stay approvable in the pending tab; show it
        // with the rejected ones, same as the offsite table below.
        status: r.status === "cancelled" ? "rejected" : r.status,
        approvals: r.approvals,
      })),
    [leaveRequests],
  );

  // ── Offsite approval query ──────────────────────────────────────────────────
  // canApproveBranch → ສາຂາດຽວກັນ, ທຸກພະແນກ
  // canApproveDept   → ສາຂາດຽວກັນ + ພະແນກດຽວກັນ
  // ທັງສອງກໍລະນີ: ຕັດ record ຂອງ user ເອງອອກ (client-side filter)
  // FIX #5: ໃຊ້ useMemo ເພື່ອໃຫ້ array reference stable — ບໍ່ສ້າງ array ໃໝ່ທຸກ render
  const offsiteQueryKey = useMemo(
    () => [
      "workOutside",
      "approval",
      workLocationUuid ?? null,
      canApproveBranch ? "branch" : (departmentUuid ?? null),
      loggedInUserUuid,
    ],
    [workLocationUuid, canApproveBranch, departmentUuid, loggedInUserUuid],
  );

  const { data: offsiteRequests = [] } = useQuery<OffsiteRequestDoc[]>({
    queryKey: offsiteQueryKey,
    queryFn: async () => {
      if (!workLocationUuid) return [];
      const coll = collection(db, "workOutside");
      const scopeConstraints = canApproveBranch
        ? [where("requester.workLocation.uuid", "==", workLocationUuid)]
        : [
            where("requester.workLocation.uuid", "==", workLocationUuid),
            where("requester.department.uuid", "==", departmentUuid),
          ];
      const monthStart = getVientianeIsoDate().slice(0, 7) + "-01";

      // ດຶງສະເພາະ pending ຫຼື ທີ່ endDate ຢູ່ໃນເດືອນປັດຈຸບັນ — scope ວັນທີ່ຢູ່ query
      // ໂດຍກົງ (ບໍ່ດຶງທັງໝົດມາ filter ພາຍຫຼັງ), ແຍກ 2 query ແລ້ວ merge ເພາະ Firestore
      // ບໍ່ຮອງຮັບ OR ຂ້າມ field ໃນ query ດຽວ
      let rows: OffsiteRequestDoc[];
      try {
        const [pendingSnap, thisMonthSnap] = await Promise.all([
          getDocs(query(coll, ...scopeConstraints, where("status", "==", "pending"))),
          getDocs(query(coll, ...scopeConstraints, where("endDate", ">=", monthStart))),
        ]);
        const seen = new Set<string>();
        rows = [];
        for (const d of [...pendingSnap.docs, ...thisMonthSnap.docs]) {
          if (seen.has(d.id)) continue;
          seen.add(d.id);
          rows.push({ id: d.id, ...d.data() } as OffsiteRequestDoc);
        }
      } catch {
        // Composite index missing/still building — fall back to the un-scoped scan.
        const snap = await getDocs(query(coll, ...scopeConstraints));
        rows = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as OffsiteRequestDoc))
          .filter((d) => d.status === "pending" || d.endDate >= monthStart);
      }

      // Same rule as the detail page and updateOffsiteApproval: not the
      // requester, not anyone on the trip (the old filter only dropped the
      // creator, so a teammate could approve a trip they were going on).
      return rows
        .filter((d) => !getOffsiteApprovalBlock(d, offsiteApprover))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    // FIX #1: ໃຊ້ canApproveAny ທີ່ declare ຢ່າງຖືກຕ້ອງແລ້ວ
    enabled: !!workLocationUuid && !!loggedInUserUuid && canApproveAny,
  });

  const offsiteTableData = useMemo(
    () =>
      offsiteRequests.map((r) => ({
        id: r.id,
        requestNo: r.requestNo,
        requester: r.requester,
        activityType: r.activityType,
        subject: r.subject,
        startDate: r.startDate,
        endDate: r.endDate,
        durationDays: r.durationDays,
        status: (r.status === "cancelled" ? "rejected" : r.status) as
          | "pending"
          | "approved"
          | "rejected",
        // FIX #2: ລຶບ `as` cast ທີ່ຕັດ reviewedAt/reviewedBy ອອກ — type ກົງກັນຢູ່ແລ້ວ
        // Admin pads 2-step approvals to length 3 with null — drop those so the
        // table never reads `.role` / `.decision` off a null entry.
        approvals: (r.approvals ?? []).filter(Boolean),
        teammate: r.teammate,
        // FIX #1: Firestore ເກັບ participantIds ເປັນ (string | object)[]
        // string = uid ຮຸ່ນເກົ່າ, object = ParticipantEntry ຮຸ່ນໃໝ່
        // ຕ້ອງ filter string ອອກກ່ອນ ຖ້າບໍ່ TypeScript ຟ້ອງ type mismatch
        participantIds: r.participantIds.filter(
          (p): p is Exclude<typeof p, string> => typeof p !== "string"
        ),
        createdAt: r.createdAt,
        createdBy: r.createdBy,
      })),
    [offsiteRequests],
  );

  // ── Tab state from URL ───────────────────────────────────────────────────
  // FIX: ໃຊ້ window.location ແທນ useSearchParams() — ໃນ static export, useSearchParams()
  // ບັງຄັບໃຫ້ build-time suspend (server ໄດ້ markup ບໍ່ຄືກັນກັບ client) ເຮັດໃຫ້ hydration mismatch
  const VALID_TABS = ["leave", "offsite"] as const;
  const [activeTab, setActiveTab] = useState<typeof VALID_TABS[number]>("leave");

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (VALID_TABS.includes(tab as typeof VALID_TABS[number])) {
      setActiveTab(tab as typeof VALID_TABS[number]);
    }
  }, []);

  const handleTabChange = useCallback((value: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", value);
    router.replace(`?${params.toString()}`);
    setActiveTab(value as typeof VALID_TABS[number]);
  }, [router]);

  // ── Leave approval state ─────────────────────────────────────────────────
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [pendingApproveItem, setPendingApproveItem] =
    useState<LeaveTableItem | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  // ── Offsite approval state ───────────────────────────────────────────────
  const [openOffsiteDialog, setOpenOffsiteDialog] = useState(false);
  const [offsiteAction, setOffsiteAction] = useState<
    "approve" | "reject" | null
  >(null);
  const [pendingOffsiteItem, setPendingOffsiteItem] =
    useState<OffsiteTableItem | null>(null);
  const [confirmOffsite, setConfirmOffsite] = useState(false);
  const [offsiteRejectReason, setOffsiteRejectReason] = useState("");
  const [isProcessingOffsite, setIsProcessingOffsite] = useState(false);

  // ── Leave dialog handlers ────────────────────────────────────────────────
  const handleConfirmLeaveChange = (checked: boolean | "indeterminate") => {
    setConfirmLeave(checked === true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setOpenConfirmDialog(open);
    if (!open) {
      setConfirmLeave(false);
      setPendingApproveItem(null);
    }
  };

  const handleApprove = (item: LeaveTableItem) => {
    setPendingApproveItem(item);
    setOpenConfirmDialog(true);
  };

  // ── Offsite handlers ─────────────────────────────────────────────────────
  const handleOffsiteApprove = (item: OffsiteTableItem) => {
    setPendingOffsiteItem(item);
    setOffsiteAction("approve");
    setOpenOffsiteDialog(true);
  };

  const handleOffsiteReject = (item: OffsiteTableItem) => {
    setPendingOffsiteItem(item);
    setOffsiteAction("reject");
    setOpenOffsiteDialog(true);
  };

  const handleOffsiteDialogOpenChange = (open: boolean) => {
    setOpenOffsiteDialog(open);
    if (!open) {
      setPendingOffsiteItem(null);
      setOffsiteAction(null);
      setConfirmOffsite(false);
      setOffsiteRejectReason("");
    }
  };

  const handleConfirmOffsiteAction = async () => {
    if (!pendingOffsiteItem || !offsiteAction || !confirmOffsite) return;
    const reviewedBy =
      [user?.firstNameLo || user?.firstName, user?.lastNameLo || user?.lastName]
        .filter(Boolean)
        .join(" ") || loggedInUserUuid;

    setIsProcessingOffsite(true);
    try {
      await updateOffsiteApproval({
        requestId: pendingOffsiteItem.id,
        decision: offsiteAction === "approve" ? "approved" : "rejected",
        approver: offsiteApprover,
        reviewedBy,
        // The requester's rejection email shows this; the list used to send none.
        rejectReason:
          offsiteAction === "reject"
            ? offsiteRejectReason.trim() || undefined
            : undefined,
        actorRoleUuid: user?.rolesUid,
        actorRoleName: user?.rolesName,
        workLocation: extractWorkLocationLog(user?.workLocation),
      });
      toast.success(
        offsiteAction === "approve" ? "ອະນຸມັດສຳເລັດ" : "ປະຕິເສດສຳເລັດ",
      );
    } catch (error) {
      toast.error(offsiteApprovalErrorMessage(error));
    } finally {
      // Refetch either way — a refusal means this row was stale (cancelled, or
      // already decided by another approver). The prefix also covers the
      // detail page's cache.
      await queryClient.invalidateQueries({ queryKey: ["workOutside"] });
      setIsProcessingOffsite(false);
      setOpenOffsiteDialog(false);
      setPendingOffsiteItem(null);
      setOffsiteAction(null);
      setConfirmOffsite(false);
      setOffsiteRejectReason("");
    }
  };

  const handleConfirmApprove = async () => {
    if (!pendingApproveItem || !confirmLeave) return;
    const reviewedBy =
      [user?.firstNameLo || user?.firstName, user?.lastNameLo || user?.lastName]
        .filter(Boolean)
        .join(" ") || loggedInUserUuid;

    // FIX #3: approvalIndex ເກົ່າ hardcode ເປັນ 0 ສະເໝີ
    // ຖ້າ user ເປັນ approver ທີ່ 2 (index 1) ຈະເຂียນໄປ slot ຜິດ
    // ແກ້: ຊອກຫາ index ຂອງ slot ທີ່ກົງກັບ role ຂອງ user ປັດຈຸບັນ
    // ໝາຍເຫດ: findIndex ຄືນ -1 (ບໍ່ແມ່ນ undefined) ຕອນຫາບໍ່ພົບ — `?? 0` ຈຶ່ງບໍ່ເຄີຍ
    // ເຮັດວຽກ ແລະ index -1 ຖືກສົ່ງຕໍ່ໄປ ເຮັດໃຫ້ຂຽນທັບແບບບໍ່ປ່ຽນຫຍັງ ແຕ່ຍັງຂຶ້ນວ່າສຳເລັດ
    const approvalRole = "departmentHead";
    const fullLeave = leaveRequests.find((r) => r.id === pendingApproveItem.id);
    const approvalIndex =
      fullLeave?.approvals?.findIndex(
        (ap) => ap.role === approvalRole && ap.decision === "pending",
      ) ?? -1;

    if (!fullLeave || approvalIndex < 0) {
      toast.error("ຂັ້ນຕອນນີ້ຖືກດຳເນີນການໄປແລ້ວ ຫຼື ຂໍ້ມູນບໍ່ທັນສະໄໝ");
      await queryClient.invalidateQueries({ queryKey: leaveQueryKey });
      setOpenConfirmDialog(false);
      setConfirmLeave(false);
      setPendingApproveItem(null);
      return;
    }

    setIsApproving(true);
    try {
      await updateLeaveApproval({
        leaveId: pendingApproveItem.id,
        approvalIndex,
        decision: "approved",
        reviewedBy,
        reviewedByUid: loggedInUserUuid,
        actorRoleUuid: user?.rolesUid,
        actorRoleName: user?.rolesName,
        workLocation: extractWorkLocationLog(user?.workLocation),
      });
      await queryClient.invalidateQueries({ queryKey: leaveQueryKey });
      toast.success("ອະນຸມັດສຳເລັດ");
    } catch (error) {
      // updateLeaveApproval ປະຕິເສດ slot ທີ່ຖືກຕັດສິນໄປແລ້ວ (ຜູ້ອະນຸມັດອີກຄົນກົດກ່ອນ,
      // ຫຼື ກົດຊ້ຳ) — ບອກໃຫ້ຊັດແທນຂໍ້ຄວາມກາງໆ ແລ້ວດຶງຂໍ້ມູນໃໝ່ໃຫ້ເລີຍ
      const message = error instanceof Error ? error.message : "";
      toast.error(
        message.includes("already")
          ? "ຂັ້ນຕອນນີ້ຖືກດຳເນີນການໄປແລ້ວໂດຍຜູ້ອະນຸມັດອື່ນ"
          : "ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່",
      );
      await queryClient.invalidateQueries({ queryKey: leaveQueryKey });
    } finally {
      setIsApproving(false);
      setOpenConfirmDialog(false);
      setConfirmLeave(false);
      setPendingApproveItem(null);
    }
  };

  if (isLoading || isUnauthorized) {
    return <FormsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-foreground text-2xl font-bold">ອະນຸມັດຄຳຮ້ອງ</h1>
        <p className="text-muted-foreground">
          ອະນຸມັດຄຳຮ້ອງລາພັກ ແລະ ອອກວຽກນອກ
        </p>
      </div>

      {/* ສະຫຼຸບຈຳນວນຄຳຮ້ອງ */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-chart-2/20 bg-chart-2/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-muted-foreground flex items-center gap-2 text-xs">
              <Palmtree className="text-chart-2 h-3.5 w-3.5" />
              ຂໍລາພັກ
            </p>
            {/* FIX #6: "list" ພາສາອັງກິດ → "ລາຍການ" ພາສາລາວ */}
            <p className="text-foreground text-lg font-bold">
              {leaveTableData.length} ລາຍການ
            </p>
          </CardContent>
        </Card>
        <Card className="border-chart-1/20 bg-chart-1/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-muted-foreground flex items-center gap-2 text-xs">
              <MapPin className="text-chart-1 h-3.5 w-3.5" />
              ຂໍອອກວຽກນອກ
            </p>
            {/* FIX #6: "list" ພາສາອັງກິດ → "ລາຍການ" ພາສາລາວ */}
            <p className="text-foreground text-lg font-bold">
              {offsiteTableData.length} ລາຍການ
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dialog ຢືນຢັນການອະນຸມັດລາພັກ */}
      <Dialog open={openConfirmDialog} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ຢືນຢັນການອະນຸມັດ</DialogTitle>
            <DialogDescription>
              ອະນຸມັດຄໍາຮ້ອງຂໍຂອງ <strong>{pendingApproveItem?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <label
            htmlFor="confirm-approve"
            className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3 py-2 transition-colors select-none"
          >
            <Checkbox
              id="confirm-approve"
              checked={confirmLeave}
              onCheckedChange={handleConfirmLeaveChange}
              className="mt-0.5 shrink-0"
            />
            <span className="text-sm leading-relaxed">
              ຂ້ອຍໄດ້ກວດສອບຂໍ້ມູນແລ້ວ ແລະ ຢືນຢັນການອະນຸມັດ
            </span>
          </label>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isApproving}>
                ຍົກເລີກ
              </Button>
            </DialogClose>
            <Button
              onClick={handleConfirmApprove}
              disabled={!confirmLeave || isApproving}
            >
              {isApproving ? "ກຳລັງອະນຸມັດ..." : "ອະນຸມັດ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog ຢືນຢັນການອະນຸມັດ/ປະຕິເສດ offsite */}
      <Dialog
        open={openOffsiteDialog}
        onOpenChange={handleOffsiteDialogOpenChange}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {offsiteAction === "approve"
                ? "ຢືນຢັນການອະນຸມັດ"
                : "ຢືນຢັນການປະຕິເສດ"}
            </DialogTitle>
            <DialogDescription>
              {offsiteAction === "approve" ? "ອະນຸມັດ" : "ປະຕິເສດ"}ຄໍາຮ້ອງຂໍຂອງ{" "}
              {/* FIX #4: OffsiteTableItem ບໍ່ມີ field 'name' — ໃຊ້ requester.fullNameLo ແທນ */}
              <strong>
                {pendingOffsiteItem?.requester?.fullNameLo ??
                  pendingOffsiteItem?.requester?.fullNameEn}
              </strong>
            </DialogDescription>
          </DialogHeader>
          {offsiteAction === "reject" && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">
                ເຫດຜົນການປະຕິເສດ (ທາງເລືອກ)
              </p>
              <Textarea
                placeholder="ລະບຸເຫດຜົນ..."
                value={offsiteRejectReason}
                onChange={(e) => setOffsiteRejectReason(e.target.value)}
                rows={3}
                disabled={isProcessingOffsite}
              />
            </div>
          )}
          <label
            htmlFor="confirm-offsite"
            className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3 py-2 transition-colors select-none"
          >
            <Checkbox
              id="confirm-offsite"
              checked={confirmOffsite}
              onCheckedChange={(v) => setConfirmOffsite(v === true)}
              className="mt-0.5 shrink-0"
            />
            <span className="text-sm leading-relaxed">
              ຂ້ອຍໄດ້ກວດສອບຂໍ້ມູນແລ້ວ ແລະ ຢືນຢັນການ
              {offsiteAction === "approve" ? "ອະນຸມັດ" : "ປະຕິເສດ"}
            </span>
          </label>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isProcessingOffsite}>
                ຍົກເລີກ
              </Button>
            </DialogClose>
            <Button
              variant={offsiteAction === "reject" ? "destructive" : "default"}
              onClick={handleConfirmOffsiteAction}
              disabled={!confirmOffsite || isProcessingOffsite}
            >
              {isProcessingOffsite
                ? "ກຳລັງດຳເນີນການ..."
                : offsiteAction === "approve"
                  ? "ອະນຸມັດ"
                  : "ປະຕິເສດ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="leave" className="gap-2">
            <Palmtree className="h-4 w-4" />
            ລາຍການຂໍລາພັກ
          </TabsTrigger>
          <TabsTrigger value="offsite" className="gap-2">
            <MapPin className="h-4 w-4" />
            ລາຍການອອກວຽກນອກ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leave" className="mt-4">
          <div className="mb-4 flex w-full justify-end">
            <Button
              onClick={() => router.push("/dashboard/approv/leave/instead")}
            >
              ຂໍລາແທນ
            </Button>
          </div>
          <LeaveTable data={leaveTableData} canApproveBranch={canApproveBranch} onApprove={handleApprove} />
        </TabsContent>

        <TabsContent value="offsite" className="mt-4">
          <OffsiteTable
            data={offsiteTableData}
            canApproveBranch={canApproveBranch}
            onApprove={handleOffsiteApprove}
            onReject={handleOffsiteReject}
            onViewDetail={(item) =>
              router.push(`/dashboard/approv/work-off-site?id=${item.id}`)
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
