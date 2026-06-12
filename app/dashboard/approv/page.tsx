"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Palmtree, MapPin } from "lucide-react";
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
import FormsSkeleton from "@/components/skeletons/formsSkeleton";
import LeaveTable from "@/components/leaveTable";
import OffsiteTable from "@/components/offSiteTable";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import type { LeaveTableItem } from "@/components/leaveTable";
import type { OffsiteTableItem } from "@/components/offSiteTable";
import type { OffsiteRequestDoc } from "@/types/workOutside";
import { fetchLeavesForApproval, updateLeaveApproval } from "@/services/leaves";

export default function ApprovePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading } = useAuth();

  const {
    loggedInUserUuid,
    departmentUuid,
    workLocationUuid,
    canApproveDept,
    canApproveBranch,
    canApproveAny,
    isUnauthorized,
  } = useMemo(() => {
    const loggedInUserUuid = user?.uid ?? user?.id ?? "";
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
    const canApproveAny = canApproveDept || canApproveBranch;
    const isUnauthorized = !isLoading && !canApproveAny;
    return {
      loggedInUserUuid,
      departmentUuid,
      workLocationUuid,
      canApproveDept,
      canApproveBranch,
      canApproveAny,
      isUnauthorized,
    };
  }, [user, isLoading]);

  // Must declare all hooks before any conditional return to avoid "Rendered fewer hooks than expected"
  useEffect(() => {
    if (isUnauthorized) router.push("/dashboard");
  }, [isUnauthorized, router]);

  const reviewedBy = useMemo(
    () =>
      [user?.firstNameLo || user?.firstName, user?.lastNameLo || user?.lastName]
        .filter(Boolean)
        .join(" ") || loggedInUserUuid,
    [user, loggedInUserUuid],
  );

  const leaveQueryKey = useMemo(
    () => [
      "leaves",
      "approval",
      departmentUuid ?? null,
      workLocationUuid ?? null,
      loggedInUserUuid,
    ],
    [departmentUuid, workLocationUuid, loggedInUserUuid],
  );

  const { data: leaveRequests = [] } = useQuery({
    queryKey: leaveQueryKey,
    queryFn: () =>
      fetchLeavesForApproval({
        departmentUid: departmentUuid!,
        workLocationUid: workLocationUuid!,
        excludeUserUuid: loggedInUserUuid,
      }),
    enabled:
      !!departmentUuid &&
      !!workLocationUuid &&
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
        status: r.status,
        approvals: r.approvals,
      })),
    [leaveRequests],
  );

  // canApproveBranch → ສາຂາດຽວກັນ, ທຸກພະແນກ
  // canApproveDept   → ສາຂາດຽວກັນ + ພະແນກດຽວກັນ
  // ທັງສອງກໍລະນີ: ຕັດ record ຂອງ user ເອງອອກ (client-side filter)
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
      const constraints = canApproveBranch
        ? [where("requester.workLocation.uuid", "==", workLocationUuid)]
        : [
            where("requester.workLocation.uuid", "==", workLocationUuid),
            where("requester.department.uuid", "==", departmentUuid),
          ];
      const snap = await getDocs(query(coll, ...constraints));
      // ດຶງສະເພາະ pending ຫຼື ທີ່ endDate ຢູ່ໃນເດືອນປັດຈຸບັນ
      const monthStart = new Date().toISOString().slice(0, 7) + "-01";
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as OffsiteRequestDoc)
        .filter((d) => d.createdByUid !== loggedInUserUuid)
        .filter((d) => d.status === "pending" || d.endDate >= monthStart)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
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
        details: r.details,
        customerName: r.customerName,
        location: r.location,
        startDate: r.startDate,
        endDate: r.endDate,
        durationDays: r.durationDays,
        estimatedCost: r.estimatedCost,
        status: (r.status === "cancelled" ? "rejected" : r.status) as
          | "pending"
          | "approved"
          | "rejected",
        approvals: r.approvals,
        teammate: r.teammate,
        // Firestore ເກັບ participantIds ເປັນ (string | object)[]
        // string = uid ຮຸ່ນເກົ່າ, object = ParticipantEntry ຮຸ່ນໃໝ່
        // filter string ອອກກ່ອນ ຖ້າບໍ່ TypeScript ຟ້ອງ type mismatch
        participantIds: r.participantIds.filter(
          (p): p is Exclude<typeof p, string> => typeof p !== "string",
        ),
        createdAt: r.createdAt,
        createdBy: r.createdBy,
      })),
    [offsiteRequests],
  );

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === "undefined") return "leave";
    const saved = localStorage.getItem("approv-tab");
    return saved === "leave" || saved === "offsite" ? saved : "leave";
  });

  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [pendingApproveItem, setPendingApproveItem] =
    useState<LeaveTableItem | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  const [openOffsiteDialog, setOpenOffsiteDialog] = useState(false);
  const [offsiteAction, setOffsiteAction] = useState<
    "approve" | "reject" | null
  >(null);
  const [pendingOffsiteItem, setPendingOffsiteItem] =
    useState<OffsiteTableItem | null>(null);
  const [confirmOffsite, setConfirmOffsite] = useState(false);
  const [isProcessingOffsite, setIsProcessingOffsite] = useState(false);

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    localStorage.setItem("approv-tab", value);
  }, []);

  const handleConfirmLeaveChange = useCallback(
    (checked: boolean | "indeterminate") => {
      setConfirmLeave(checked === true);
    },
    [],
  );

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setOpenConfirmDialog(open);
    if (!open) {
      setConfirmLeave(false);
      setPendingApproveItem(null);
    }
  }, []);

  const handleApprove = useCallback((item: LeaveTableItem) => {
    setPendingApproveItem(item);
    setOpenConfirmDialog(true);
  }, []);

  const handleOffsiteApprove = useCallback((item: OffsiteTableItem) => {
    setPendingOffsiteItem(item);
    setOffsiteAction("approve");
    setOpenOffsiteDialog(true);
  }, []);

  const handleOffsiteReject = useCallback((item: OffsiteTableItem) => {
    setPendingOffsiteItem(item);
    setOffsiteAction("reject");
    setOpenOffsiteDialog(true);
  }, []);

  const handleOffsiteDialogOpenChange = useCallback((open: boolean) => {
    setOpenOffsiteDialog(open);
    if (!open) {
      setPendingOffsiteItem(null);
      setOffsiteAction(null);
      setConfirmOffsite(false);
    }
  }, []);

  const handleConfirmOffsiteCheckChange = useCallback(
    (v: boolean | "indeterminate") => setConfirmOffsite(v === true),
    [],
  );

  const handleInsteadClick = useCallback(
    () => router.push("/dashboard/approv/leave/instead"),
    [router],
  );

  const handleViewDetail = useCallback(
    (item: OffsiteTableItem) =>
      router.push(`/dashboard/approv/work-off-site?id=${item.id}`),
    [router],
  );

  const handleConfirmOffsiteAction = useCallback(async () => {
    if (!pendingOffsiteItem || !offsiteAction || !confirmOffsite) return;
    const now = new Date().toISOString();

    setIsProcessingOffsite(true);
    try {
      const decision = offsiteAction === "approve" ? "approved" : "rejected";
      // ຊອກຫາ role ຂອງ approver ທີ່ login ຢູ່ຕໍ່ກັບ approvals array
      const approvalRole = canApproveDept ? "departmentHead" : "manager";
      const fullRecord = offsiteRequests.find(
        (r) => r.id === pendingOffsiteItem.id,
      );
      const approvalIndex =
        fullRecord?.approvals.findIndex((ap) => ap.role === approvalRole) ?? -1;

      const payload: Record<string, unknown> = {
        updatedAt: now,
        updatedBy: reviewedBy,
      };

      if (approvalIndex >= 0 && fullRecord) {
        // ອັບເດດ approval slot ຂອງ user ປັດຈຸບັນ
        const updatedApprovals = fullRecord.approvals.map((ap, i) =>
          i === approvalIndex
            ? { ...ap, decision, reviewedBy, reviewedAt: now }
            : ap,
        );
        payload.approvals = updatedApprovals;

        // ຄຳນວນ status ສຸດທ້າຍຫຼັງ update approvals
        // ຖ້າ set ສະເພາະ rejected — approved ຈະຕິດຄ້າງເປັນ pending ຕລອດ
        const anyRejected = updatedApprovals.some(
          (ap) => ap.decision === "rejected",
        );
        const allApproved = updatedApprovals.every(
          (ap) => ap.decision === "approved",
        );
        if (anyRejected) payload.status = "rejected";
        else if (allApproved) payload.status = "approved";
        // ຍັງ pending ຖ້າບາງ slot ຍັງບໍ່ທັນ review
      } else {
        // ບໍ່ພົບ slot ທີ່ກົງກັບ role → ຕັດສິນໂດຍກົງ
        payload.status = decision;
      }

      await updateDoc(doc(db, "workOutside", pendingOffsiteItem.id), payload);
      await queryClient.invalidateQueries({ queryKey: offsiteQueryKey });
      toast.success(
        offsiteAction === "approve" ? "ອະນຸມັດສຳເລັດ" : "ປະຕິເສດສຳເລັດ",
      );
    } catch {
      toast.error("ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່");
    } finally {
      setIsProcessingOffsite(false);
      setOpenOffsiteDialog(false);
      setPendingOffsiteItem(null);
      setOffsiteAction(null);
      setConfirmOffsite(false);
    }
  }, [
    pendingOffsiteItem,
    offsiteAction,
    confirmOffsite,
    reviewedBy,
    canApproveDept,
    offsiteRequests,
    queryClient,
    offsiteQueryKey,
  ]);

  const handleConfirmApprove = useCallback(async () => {
    if (!pendingApproveItem || !confirmLeave) return;

    // ຖ້າ user ເປັນ approver ທີ 2 ຂຶ້ນໄປ, hardcode index 0 ຈະຂຽນໄປ slot ຜິດ
    const approvalRole = canApproveBranch ? "branchManager" : "departmentHead";
    const fullLeave = leaveRequests.find((r) => r.id === pendingApproveItem.id);
    const approvalIndex =
      fullLeave?.approvals?.findIndex(
        (ap) => ap.role === approvalRole && ap.decision === "pending",
      ) ?? 0;

    setIsApproving(true);
    try {
      await updateLeaveApproval({
        leaveId: pendingApproveItem.id,
        approvalIndex,
        decision: "approved",
        reviewedBy,
        reviewedByUid: loggedInUserUuid,
      });
      await queryClient.invalidateQueries({ queryKey: leaveQueryKey });
      toast.success("ອະນຸມັດສຳເລັດ");
    } catch {
      toast.error("ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່");
    } finally {
      setIsApproving(false);
      setOpenConfirmDialog(false);
      setConfirmLeave(false);
      setPendingApproveItem(null);
    }
  }, [
    pendingApproveItem,
    confirmLeave,
    reviewedBy,
    loggedInUserUuid,
    canApproveBranch,
    leaveRequests,
    queryClient,
    leaveQueryKey,
  ]);

  if (isLoading || isUnauthorized) {
    return <FormsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold">ອະນຸມັດຄຳຮ້ອງ</h1>
        <p className="text-muted-foreground">
          ອະນຸມັດຄຳຮ້ອງລາພັກ ແລະ ອອກວຽກນອກ
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-chart-2/20 bg-chart-2/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-muted-foreground flex items-center gap-2 text-xs">
              <Palmtree className="text-chart-2 h-3.5 w-3.5" />
              ຂໍລາພັກ
            </p>
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
            <p className="text-foreground text-lg font-bold">
              {offsiteTableData.length} ລາຍການ
            </p>
          </CardContent>
        </Card>
      </div>

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
              <strong>
                {pendingOffsiteItem?.requester?.fullNameLo ??
                  pendingOffsiteItem?.requester?.fullNameEn}
              </strong>
            </DialogDescription>
          </DialogHeader>
          <label
            htmlFor="confirm-offsite"
            className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3 py-2 transition-colors select-none"
          >
            <Checkbox
              id="confirm-offsite"
              checked={confirmOffsite}
              onCheckedChange={handleConfirmOffsiteCheckChange}
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
            <Button onClick={handleInsteadClick}>ຂໍລາແທນ</Button>
          </div>
          <LeaveTable data={leaveTableData} onApprove={handleApprove} />
        </TabsContent>

        <TabsContent value="offsite" className="mt-4">
          <OffsiteTable
            data={offsiteTableData}
            canApproveBranch={canApproveBranch}
            onApprove={handleOffsiteApprove}
            onReject={handleOffsiteReject}
            onViewDetail={handleViewDetail}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
