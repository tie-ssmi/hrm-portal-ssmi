"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Plus,
  Palmtree,
  MapPin,
  Clock,
  FileWarning,
  BriefcaseBusiness,
} from "lucide-react";
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
import LeaveRequestForm from "@/components/dashboard/leave-request-form";
import { OffsiteListFilterBar } from "@/components/offsite/OffsiteListFilterBar";
import { OffsiteRequestList } from "@/components/offsite/OffsiteRequestList";
import { CreateRequestDialog } from "@/components/offsite/CreateRequestDialog";
import { useQueryClient } from "@tanstack/react-query";
import { doc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
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

function StatCard({
  icon,
  label,
  value,
  cardClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  cardClass: string;
}) {
  return (
    <Card className={cardClass}>
      <CardContent className="pt-4 pb-4">
        <div className="mb-1 flex items-center gap-1.5">
          {icon}
          <p className="text-muted-foreground text-xs">{label}</p>
        </div>
        <p className="text-foreground text-lg leading-tight font-bold">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export default function FormsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState(() => {
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
  const [cancelTarget, setCancelTarget] = useState<OffsiteRequestDoc | null>(
    null,
  );
  const [isCancelling, setIsCancelling] = useState(false);

  const {
    filtered,
    allDocs,
    isLoading: listLoading,
    error,
    refetch,
    availableMonths,
  } = useMyOffsiteRequests(filters);

  const userUuid = user?.uuid ?? user?.uid ?? "";
  const { data: upcomingLeaves = [] } = useUpcomingLeaves(userUuid);
  const { data: pendingDocLeaves = [] } = usePendingDocLeaves(userUuid);

  const pendingLeaveCount = useMemo(
    () => upcomingLeaves.filter((l) => l.status === "pending").length,
    [upcomingLeaves],
  );

  const { approvedOffsiteCount, approvedOffsiteDays } = useMemo(() => {
    const approved = allDocs.filter((d) => d.status === "approved");
    return {
      approvedOffsiteCount: approved.length,
      approvedOffsiteDays: approved.reduce(
        (sum, d) => sum + (d.durationDays ?? 0),
        0,
      ),
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

  const handleConfirmCancel = useCallback(async () => {
    if (!cancelTarget || !user) return;
    setIsCancelling(true);
    try {
      const fullName =
        `${user.firstNameEn ?? user.firstName ?? ""} ${user.lastNameEn ?? user.lastName ?? ""}`.trim();
      await updateDoc(doc(db, "workOutside", cancelTarget.id), {
        status: "cancelled",
        updatedAt: new Date().toISOString(),
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

  const handleCancel = useCallback(
    (d: OffsiteRequestDoc) => setCancelTarget(d),
    [],
  );

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditTarget(undefined);
  }, []);

  const handleAlertOpenChange = useCallback((open: boolean) => {
    if (!open) setCancelTarget(null);
  }, []);


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold">Request Forms</h1>
        <p className="text-muted-foreground">
          Submit leave and off-site work requests
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<Clock className="h-3.5 w-3.5 text-amber-500" />}
          label="ລາພັກລໍຖ້າ"
          cardClass="border-amber-200/40 bg-amber-50/50 dark:border-amber-800/30 dark:bg-amber-950/20"
          value={
            <>
              {pendingLeaveCount}
              {pendingLeaveCount > 0 && (
                <span className="ml-1.5 inline-flex h-2 w-2 items-center justify-center rounded-full bg-amber-400" />
              )}
            </>
          }
        />
        <StatCard
          icon={<FileWarning className="h-3.5 w-3.5 text-blue-500" />}
          label="ລໍຖ້າເອກະສານ"
          cardClass="border-blue-200/40 bg-blue-50/50 dark:border-blue-800/30 dark:bg-blue-950/20"
          value={
            <>
              {pendingDocLeaves.length}
              {pendingDocLeaves.length > 0 && (
                <span className="ml-1.5 inline-flex h-2 w-2 items-center justify-center rounded-full bg-blue-400" />
              )}
            </>
          }
        />
        <StatCard
          icon={<BriefcaseBusiness className="h-3.5 w-3.5 text-emerald-500" />}
          label="ອອກວຽກນອກ"
          cardClass="border-emerald-200/40 bg-emerald-50/50 dark:border-emerald-800/30 dark:bg-emerald-950/20"
          value={
            <>
              {approvedOffsiteCount}{" "}
              <span className="text-muted-foreground text-xs font-normal">
                ຄັ້ງ
              </span>
              <span className="text-muted-foreground/40 mx-1">/</span>
              {approvedOffsiteDays}{" "}
              <span className="text-muted-foreground text-xs font-normal">
                ວັນ
              </span>
            </>
          }
        />
      </div>

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

        <TabsContent value="leave" className="mt-4">
          <LeaveRequestForm />
        </TabsContent>

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
            onCancel={handleCancel}
            onRetry={refetch}
          />
        </TabsContent>
      </Tabs>

      <CreateRequestDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        onSuccess={handleSuccess}
        initialData={editTarget}
      />

      <AlertDialog open={!!cancelTarget} onOpenChange={handleAlertOpenChange}>
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
