"use client";

// ** core
import { useState, useMemo } from "react";

// ** assets / icons
import {
  Plus,
  Palmtree,
  MapPin,
  Clock,
  FileWarning,
  BriefcaseBusiness,
} from "lucide-react";

// ** shared components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { OffsiteListFilterBar } from "@/components/offsite/OffsiteListFilterBar";
import { OffsiteRequestList } from "@/components/offsite/OffsiteRequestList";
import { CreateRequestDialog } from "@/components/offsite/CreateRequestDialog";
import FormsSkeleton from "@/components/skeletons/formsSkeleton";
import LeaveRequestForm from "@/components/dashboard/leave-request-form";

// ** third party
import { useQueryClient } from "@tanstack/react-query";
import { doc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";

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

  // ── persistent tab — lazy init avoids useEffect flash ──
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === "undefined") return "leave";
    const saved = localStorage.getItem("request-tab");
    return saved === "leave" || saved === "offsite" ? saved : "leave";
  });

  function handleTabChange(value: string) {
    setActiveTab(value);
    localStorage.setItem("request-tab", value);
  }

  // ── offsite state ──
  const [filters, setFilters] = useState<OffsiteFilters>(DEFAULT_FILTERS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OffsiteRequestDoc | undefined>();
  const [cancelTarget, setCancelTarget] = useState<OffsiteRequestDoc | null>(
    null,
  );
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

  function handleCreateNew() {
    setEditTarget(undefined);
    setDialogOpen(true);
  }

  function handleEdit(d: OffsiteRequestDoc) {
    setEditTarget(d);
    setDialogOpen(true);
  }

  function handleSuccess() {
    queryClient.invalidateQueries({ queryKey: [OFFSITE_QUERY_KEY] });
  }

  async function handleConfirmCancel() {
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
  }

  if (isLoading) return <FormsSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-foreground text-2xl font-bold">Request Forms</h1>
        <p className="text-muted-foreground">
          Submit leave and off-site work requests
        </p>
      </div>

      {/* Leave Balance Summary */}
      <div className="flex gap-2 overflow-x-auto pb-1">
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
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="leave" className="gap-2">
            <Palmtree className="h-4 w-4" />
            ຟອມຂໍລາພັກ
          </TabsTrigger>
          <TabsTrigger value="offsite" className="gap-2">
            <MapPin className="h-4 w-4" />
            ຟອມອອກວຽກນອກ
          </TabsTrigger>
        </TabsList>

        {/* Leave Tab */}
        <TabsContent value="leave" className="mt-4">
          <LeaveRequestForm />
        </TabsContent>

        {/* Offsite Tab — list view */}
        <TabsContent value="offsite" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-foreground text-base font-semibold">
                ການອອກປະຕິບັດງານນອກສະຖານທີ່
              </h2>
              <p className="text-muted-foreground text-sm">ລາຍການຄຳຂໍຂອງທ່ານ</p>
            </div>
            <Button
              onClick={handleCreateNew}
              size="sm"
              className="shrink-0 gap-2"
            >
              <Plus className="h-4 w-4" />
              ສ້າງຄຳຂໍໃໝ່
            </Button>
          </div>

          <OffsiteListFilterBar
            filters={filters}
            onFiltersChange={setFilters}
            availableMonths={availableMonths}
          />

          <OffsiteRequestList
            docs={filtered}
            isLoading={listLoading}
            error={error}
            currentUid={user?.uid ?? ""}
            onCreateNew={handleCreateNew}
            onEdit={handleEdit}
            onCancel={(d) => setCancelTarget(d)}
            onRetry={refetch}
          />
        </TabsContent>
      </Tabs>

      {/* Create / Edit Dialog */}
      <CreateRequestDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditTarget(undefined);
        }}
        onSuccess={handleSuccess}
        initialData={editTarget}
      />

      {/* Cancel confirmation */}
      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ຍົກເລີກຄຳຂໍນີ້?</AlertDialogTitle>
            <AlertDialogDescription>
              ຄຳຂໍ{" "}
              <span className="font-mono font-semibold">
                {cancelTarget?.requestNo}
              </span>{" "}
              ຈະຖືກຍົກເລີກ ແລະ ບໍ່ສາມາດກັບຄືນໄດ້
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>ປິດ</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? "ກຳລັງຍົກເລີກ..." : "ຍົກເລີກຄຳຂໍ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
