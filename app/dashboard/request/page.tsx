"use client";

// ** core
import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from "react";

// ** assets / icons
import {
  Plus,
  Palmtree,
  MapPin,
  Clock,
  FileWarning,
  BriefcaseBusiness,
  HelpCircle,
} from "lucide-react";

// ** shared components (critical path — always visible)
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FormsSkeleton from "@/components/skeletons/formsSkeleton";
import LeaveRequestForm from "@/components/dashboard/leave-request-form";

// ** lazy — offsite + dialogs load on demand
const OffsiteListFilterBar = lazy(() =>
  import("@/components/offsite/OffsiteListFilterBar").then((m) => ({ default: m.OffsiteListFilterBar })),
);
const OffsiteRequestList = lazy(() =>
  import("@/components/offsite/OffsiteRequestList").then((m) => ({ default: m.OffsiteRequestList })),
);
const CreateRequestDialog = lazy(() =>
  import("@/components/offsite/CreateRequestDialog").then((m) => ({ default: m.CreateRequestDialog })),
);
const LazyAlertDialog = lazy(() =>
  import("@/components/ui/alert-dialog").then((m) => {
    function CancelDialog({ target, isCancelling, onConfirm, onClose }: {
      target: { requestNo: string } | null;
      isCancelling: boolean;
      onConfirm: () => void;
      onClose: () => void;
    }) {
      return (
        <m.AlertDialog open={!!target} onOpenChange={(open: boolean) => { if (!open) onClose(); }}>
          <m.AlertDialogContent>
            <m.AlertDialogHeader>
              <m.AlertDialogTitle>ຍົກເລີກຄຳຂໍນີ້?</m.AlertDialogTitle>
              <m.AlertDialogDescription>
                ຄຳຂໍ{" "}
                <span className="font-mono font-semibold">{target?.requestNo}</span>
                {" "}ຈະຖືກຍົກເລີກ ແລະ ບໍ່ສາມາດກັບຄືນໄດ້
              </m.AlertDialogDescription>
            </m.AlertDialogHeader>
            <m.AlertDialogFooter>
              <m.AlertDialogCancel disabled={isCancelling}>ປິດ</m.AlertDialogCancel>
              <m.AlertDialogAction
                onClick={onConfirm}
                disabled={isCancelling}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isCancelling ? "ກຳລັງຍົກເລີກ..." : "ຍົກເລີກຄຳຂໍ"}
              </m.AlertDialogAction>
            </m.AlertDialogFooter>
          </m.AlertDialogContent>
        </m.AlertDialog>
      );
    }
    return { default: CancelDialog };
  }),
);

// ** third party
import { useQueryClient } from "@tanstack/react-query";
import { doc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// ** config / utils / types / hooks
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import {
  useUpcomingLeaves,
  usePendingDocLeaves,
} from "@/lib/use-leave-queries";
import {
  useMyOffsiteRequests,
  OFFSITE_QUERY_KEY,
} from "@/hooks/useMyOffsiteRequests";
import type { OffsiteFilters } from "@/hooks/useMyOffsiteRequests";
import type { OffsiteRequestDoc } from "@/types/workOutside";

const DEFAULT_FILTERS: OffsiteFilters = {
  status: "",
  activityCode: "",
  monthKey: "",
  search: "",
};

export default function FormsPage() {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === "undefined") return "leave";
    const saved = localStorage.getItem("request-tab");
    return saved === "leave" || saved === "offsite" ? saved : "leave";
  });

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    localStorage.setItem("request-tab", value);
  }, []);

  const [filters, setFilters] = useState<OffsiteFilters>(DEFAULT_FILTERS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OffsiteRequestDoc | undefined>();
  const [cancelTarget, setCancelTarget] = useState<OffsiteRequestDoc | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const isOffsiteTab = activeTab === "offsite";

  const {
    filtered,
    allDocs,
    isLoading: listLoading,
    error,
    refetch,
    availableMonths,
  } = useMyOffsiteRequests(filters, isOffsiteTab);

  const userUuid = user?.uuid ?? user?.uid ?? "";
  const { data: upcomingLeaves = [], isLoading: leavesLoading } = useUpcomingLeaves(userUuid);
  const { data: pendingDocLeaves = [], isLoading: docLeavesLoading } = usePendingDocLeaves(userUuid);
  const statsLoading = leavesLoading || docLeavesLoading;

  const pendingLeaveCount = useMemo(
    () => upcomingLeaves.filter((l) => l.status === "pending").length,
    [upcomingLeaves],
  );

  const { approvedOffsiteCount, approvedOffsiteDays } = useMemo(() => {
    const approved = allDocs.filter((d) => d.status === "approved");
    return {
      approvedOffsiteCount: approved.length,
      approvedOffsiteDays: approved.reduce((sum, d) => sum + (d.durationDays ?? 0), 0),
    };
  }, [allDocs]);

  const handleCreateNew = useCallback(() => {
    setEditTarget(undefined);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((d: OffsiteRequestDoc) => {
    setEditTarget(d);
    setDialogOpen(true);
  }, []);

  const handleSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [OFFSITE_QUERY_KEY] });
  }, [queryClient]);

  const handleDialogChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditTarget(undefined);
  }, []);

  const handleSetCancelTarget = useCallback((d: OffsiteRequestDoc) => {
    setCancelTarget(d);
  }, []);

  const handleCancelClose = useCallback(() => setCancelTarget(null), []);

  const handleConfirmCancel = useCallback(async () => {
    if (!cancelTarget || !user) return;
    setIsCancelling(true);
    try {
      const now = new Date().toISOString();
      const fullName =
        `${user.firstNameEn ?? user.firstName ?? ""} ${user.lastNameEn ?? user.lastName ?? ""}`.trim();
      await updateDoc(doc(db, "workOutside", cancelTarget.id), {
        status: "cancelled",
        updatedAt: now,
        updatedBy: fullName,
      });
      toast.success(`ຍົກເລີກຄຳຂໍ ${cancelTarget.requestNo} ສຳເລັດ`);
      queryClient.invalidateQueries({ queryKey: [OFFSITE_QUERY_KEY] });
    } catch (err) {
      console.error(err);
      toast.error("ຍົກເລີກລົ້ມເຫລວ ກະລຸນາລອງໃໝ່");
    } finally {
      setIsCancelling(false);
      setCancelTarget(null);
    }
  }, [cancelTarget, user, queryClient]);

  // ── Driver.js tour ──
  const REQUEST_TOUR_KEY = "request-page-tour-seen";

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
          element: "#request-stats",
          popover: {
            title: "ສະຖິຕິ",
            description: "ເບິ່ງຈຳນວນຄຳຮ້ອງລາພັກລໍຖ້າ, ເອກະສານຄ້າງ ແລະ ການອອກວຽກນອກ",
            side: "bottom" as const,
            align: "center" as const,
          },
        },
        {
          element: "#request-tabs",
          popover: {
            title: "ສອງແບບຟອມ",
            description: "ສະຫຼັບລະຫວ່າງ ຟອມຂໍລາພັກ ແລະ ຟອມອອກວຽກນອກ",
            side: "bottom" as const,
            align: "center" as const,
          },
        },
        {
          element: "#tab-leave",
          popover: {
            title: "ຟອມຂໍລາພັກ",
            description: "ຍື່ນຄໍາຮ້ອງຂໍລາພັກ — ເລືອກປະເພດ, ວັນທີ ແລະ ສົ່ງຄໍາຮ້ອງ",
            side: "bottom" as const,
            align: "start" as const,
          },
        },
        {
          element: "#tab-offsite",
          popover: {
            title: "ຟອມອອກວຽກນອກ",
            description: "ສ້າງຄຳຂໍອອກປະຕິບັດງານນອກສະຖານທີ່ ພ້ອມເພີ່ມສະມາຊິກທີມ",
            side: "bottom" as const,
            align: "end" as const,
          },
        },
      ],
      onDestroyed: () => {
        localStorage.setItem(REQUEST_TOUR_KEY, "1");
      },
    });
    driverObj.drive();
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(REQUEST_TOUR_KEY)) {
      const timer = setTimeout(startTour, 600);
      return () => clearTimeout(timer);
    }
  }, [startTour]);

  if (isLoading) return <FormsSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">Request Forms</h1>
          <p className="text-muted-foreground">Submit leave and off-site work requests</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={startTour}>
          <HelpCircle className="w-5 h-5 text-muted-foreground" />
        </Button>
      </div>

      {/* Stats */}
      <div id="request-stats" className="flex gap-2 overflow-x-auto pb-1">
        <Card className="min-w-0 flex-1 border-amber-200/40 bg-amber-50/50 dark:border-amber-800/30 dark:bg-amber-950/20">
          <CardContent className="px-3 pt-3 pb-3">
            <div className="mb-1 flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0 text-amber-500" />
              <p className="text-muted-foreground truncate text-[11px]">ລາພັກລໍຖ້າ</p>
            </div>
            {statsLoading ? (
              <div className="bg-muted h-5 w-6 animate-pulse rounded" />
            ) : (
              <p className="text-foreground text-base font-bold">
                {pendingLeaveCount}
                {pendingLeaveCount > 0 && (
                  <span className="ml-1 inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
                )}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="min-w-0 flex-1 border-blue-200/40 bg-blue-50/50 dark:border-blue-800/30 dark:bg-blue-950/20">
          <CardContent className="px-3 pt-3 pb-3">
            <div className="mb-1 flex items-center gap-1">
              <FileWarning className="h-3 w-3 shrink-0 text-blue-500" />
              <p className="text-muted-foreground truncate text-[11px]">ລໍຖ້າເອກະສານ</p>
            </div>
            {statsLoading ? (
              <div className="bg-muted h-5 w-6 animate-pulse rounded" />
            ) : (
              <p className="text-foreground text-base font-bold">
                {pendingDocLeaves.length}
                {pendingDocLeaves.length > 0 && (
                  <span className="ml-1 inline-flex h-1.5 w-1.5 rounded-full bg-blue-400" />
                )}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="min-w-0 flex-1 border-emerald-200/40 bg-emerald-50/50 dark:border-emerald-800/30 dark:bg-emerald-950/20">
          <CardContent className="px-3 pt-3 pb-3">
            <div className="mb-1 flex items-center gap-1">
              <BriefcaseBusiness className="h-3 w-3 shrink-0 text-emerald-500" />
              <p className="text-muted-foreground truncate text-[11px]">ອອກວຽກນອກ</p>
            </div>
            {statsLoading ? (
              <div className="bg-muted h-5 w-6 animate-pulse rounded" />
            ) : (
              <p className="text-foreground text-base leading-tight font-bold">
                {approvedOffsiteCount}
                <span className="text-muted-foreground text-[10px] font-normal"> ຄັ້ງ</span>
                <span className="text-muted-foreground/40 mx-0.5">/</span>
                {approvedOffsiteDays}
                <span className="text-muted-foreground text-[10px] font-normal"> ວັນ</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList id="request-tabs" className="grid w-full grid-cols-2">
          <TabsTrigger id="tab-leave" value="leave" className="gap-2">
            <Palmtree className="h-4 w-4" />
            ຟອມຂໍລາພັກ
          </TabsTrigger>
          <TabsTrigger id="tab-offsite" value="offsite" className="gap-2">
            <MapPin className="h-4 w-4" />
            ຟອມອອກວຽກນອກ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leave" className="mt-4">
          <LeaveRequestForm />
        </TabsContent>

        <TabsContent value="offsite" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-foreground text-base font-semibold">ການອອກປະຕິບັດງານນອກສະຖານທີ່</h2>
              <p className="text-muted-foreground text-sm">ລາຍການຄຳຂໍຂອງທ່ານ</p>
            </div>
            <Button onClick={handleCreateNew} size="sm" className="shrink-0 gap-2">
              <Plus className="h-4 w-4" />
              ສ້າງຄຳຂໍໃໝ່
            </Button>
          </div>

          <Suspense fallback={<div className="bg-muted h-10 animate-pulse rounded-lg" />}>
            <OffsiteListFilterBar
              filters={filters}
              onFiltersChange={setFilters}
              availableMonths={availableMonths}
            />
          </Suspense>

          <Suspense fallback={<FormsSkeleton />}>
            <OffsiteRequestList
              docs={filtered}
              isLoading={listLoading}
              error={error}
              currentUid={user?.uid ?? ""}
              onCreateNew={handleCreateNew}
              onEdit={handleEdit}
              onCancel={handleSetCancelTarget}
              onRetry={refetch}
            />
          </Suspense>
        </TabsContent>
      </Tabs>

      {/* Dialogs — lazy, render only when triggered */}
      {dialogOpen && (
        <Suspense fallback={null}>
          <CreateRequestDialog
            open={dialogOpen}
            onOpenChange={handleDialogChange}
            onSuccess={handleSuccess}
            initialData={editTarget}
          />
        </Suspense>
      )}

      {cancelTarget && (
        <Suspense fallback={null}>
          <LazyAlertDialog
            target={cancelTarget}
            isCancelling={isCancelling}
            onConfirm={handleConfirmCancel}
            onClose={handleCancelClose}
          />
        </Suspense>
      )}
    </div>
  );
}
