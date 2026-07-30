"use client";

// ** core
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// ** assets / icons
import {
  Calendar,
  Clock,
  AlertTriangle,
  DollarSign,
  HeartPulse,
  MapPinX,
  ChevronDown,
} from "lucide-react";

// ** shared components
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import HomeSkeleton from "@/components/skeletons/homeSkeleton";
import {
  CheckInToday,
  TodayLeaveSection,
  TodayOffsiteSection,
} from "@/components/leaveLists";
import { formatDayDateLao, formatMonthYearLao } from "@/components/laoDate";
import WeatherWidget from "@/components/WeatherWidget";
// ** third party
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";

// ** config / utils / types / hooks
import { useAuth } from "@/lib/auth-context";
import { useHRM } from "@/lib/hrm-context";
import { db } from "@/lib/firebase";
import { useUserLeaves } from "@/lib/use-leave-queries";
import { useLateRankingForMonth } from "@/lib/use-late-ranking-queries";
import type { LeaveRequest, PolicyRecord } from "@/lib/types";
import type { OffsiteRequestDoc } from "@/types/workOutside";

// ** services
import { fetchPoliciesForGender } from "@/services/policies";

const VISIBLE_COUNT = 3;

function buildRankMonths(): string[] {
  const now = new Date();
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
  });
}

function PolicyRow({ policy, used }: { policy: PolicyRecord; used: number }) {
  const total = policy.days ?? 0;
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2">
          <Calendar className="text-chart-2 h-4 w-4" />
          {policy.name || policy.requestType}
        </span>
        <span className="text-muted-foreground">
          {used} / {total} ວັນ
        </span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

function PolicyList({
  policies,
  usedByPolicy,
}: {
  policies: PolicyRecord[];
  usedByPolicy: Map<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const visible = policies.slice(0, VISIBLE_COUNT);
  const hidden = policies.slice(VISIBLE_COUNT);
  const hasMore = hidden.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-4">
      {visible.map((policy) => (
        <PolicyRow
          key={policy.uuid ?? policy.id}
          policy={policy}
          used={
            usedByPolicy.get(policy.uuid ?? "") ??
            usedByPolicy.get(policy.id) ??
            0
          }
        />
      ))}

      {hasMore && (
        <>
          <CollapsibleContent className="space-y-4">
            {hidden.map((policy) => (
              <PolicyRow
                key={policy.uuid ?? policy.id}
                policy={policy}
                used={
                  usedByPolicy.get(policy.uuid ?? "") ??
                  usedByPolicy.get(policy.id) ??
                  0
                }
              />
            ))}
          </CollapsibleContent>

          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground w-full gap-1 text-xs"
            >
              {open ? "ຫຍໍ້ລົງ" : `ເບິ່ງທັງໝົດ (${hidden.length} ລາຍການ)`}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
              />
            </Button>
          </CollapsibleTrigger>
        </>
      )}
    </Collapsible>
  );
}

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const { leaveBalance, todayAttendance, attendanceHistory } = useHRM();
  const router = useRouter();
  const userUid = user?.uid ?? "";
  const now = new Date();
  const currentMonthKey = `${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getFullYear()}`;

  const { data: policies = [] } = useQuery({
    queryKey: ["policies", "gender", user?.gender ?? null],
    queryFn: () => fetchPoliciesForGender(user?.gender),
    enabled: !!user,
  });

  // all leaves for policy usage calculation
  const { data: userLeaves = [] } = useUserLeaves(user?.uuid);

  // late ranking — last 5 months selector (memoised so array reference is stable)
  const rankMonths = useMemo(buildRankMonths, []);
  const [selectedRankMonth, setSelectedRankMonth] = useState(
    () => rankMonths[0],
  );
  const {
    data: lateRanking = [],
    isLoading: rankingLoading,
    isError: rankingError,
  } = useLateRankingForMonth(selectedRankMonth, !!user);

  // used days per policy (approved leaves only)
  const usedByPolicy = useMemo(() => {
    const map = new Map<string, number>();
    userLeaves.forEach((req: LeaveRequest) => {
      if (req.status !== "approved") return;
      const key = req.policyUuid || req.policyId;
      if (!key) return;
      map.set(key, (map.get(key) ?? 0) + (req.duration ?? 1));
    });
    return map;
  }, [userLeaves]);

  const { data: offsiteThisMonth = [] } = useQuery<OffsiteRequestDoc[]>({
    queryKey: ["workOutside", "dashboard", userUid, currentMonthKey],
    queryFn: async () => {
      if (!userUid) return [];
      const col = collection(db, "workOutside");
      const [snap1, snap2, snap3] = await Promise.all([
        getDocs(
          query(
            col,
            where("participantUids", "array-contains", userUid),
            where("monthKey", "==", currentMonthKey),
          ),
        ),
        getDocs(
          query(
            col,
            where("participantIds", "array-contains", userUid),
            where("monthKey", "==", currentMonthKey),
          ),
        ),
        getDocs(
          query(
            col,
            where("createdByUid", "==", userUid),
            where("monthKey", "==", currentMonthKey),
          ),
        ),
      ]);
      const seen = new Set<string>();
      const docs: OffsiteRequestDoc[] = [];
      for (const snap of [snap1, snap2, snap3]) {
        for (const d of snap.docs) {
          if (!seen.has(d.id)) {
            seen.add(d.id);
            docs.push({ id: d.id, ...d.data() } as OffsiteRequestDoc);
          }
        }
      }
      return docs;
    },
    enabled: !!userUid,
  });

  const offsiteDaysThisMonth = offsiteThisMonth
    .filter((r) => r.status === "approved")
    .reduce((sum, r) => sum + (r.durationDays ?? 0), 0);

  const { lateThisMonth, notCheckInThisMonth, computedTotalFines } =
    useMemo(() => {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const todayStr = `${y}-${(m + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
      const isAfter10 = now.getHours() * 60 + now.getMinutes() >= 10 * 60;
      const thisMonth = attendanceHistory.filter((r) => {
        const d = new Date(r.date);
        return d.getFullYear() === y && d.getMonth() === m;
      });
      const late = thisMonth.filter((r) => r.status === "late").length;
      const notCheckIn = thisMonth.reduce((sum, r) => {
        if (r.date === todayStr) {
          if (!isAfter10) return sum;
          return (
            sum +
            (r.status === "not_check_in" || r.status === "not_checked_in"
              ? 1
              : 0)
          );
        }
        // absent OR came >10:01 and forgot checkout → 2 pts
        if (r.status === "not_checked_in") return sum + 2;
        if (r.status === "not_check_in" && r.checkOutTime == null)
          return sum + 2;
        // came >10:01 but checked out → 1 pt
        if (r.status === "not_check_in" && r.checkOutTime != null)
          return sum + 1;
        if (
          r.status !== "not_check_in" &&
          r.status !== "leave" &&
          r.checkOutTime == null
        )
          return sum + 1;
        return sum;
      }, 0);
      const fines = notCheckIn * 10000 + (late > 4 ? (late - 4) * 10000 : 0);
      return {
        lateThisMonth: late,
        notCheckInThisMonth: notCheckIn,
        computedTotalFines: fines,
      };
    }, [attendanceHistory]);

  if (isLoading) {
    return <HomeSkeleton />;
  }

  // Keep stat cards working: derive totals from the matching policy types
  const annualPolicy = policies.find((p) => p.requestType === "annual");
  const sickPolicy = policies.find((p) => p.requestType === "sick");

  const effectiveLeaveBalance = {
    ...leaveBalance,
    annual: annualPolicy?.days ?? leaveBalance.annual,
    sick: sickPolicy?.days ?? leaveBalance.sick,
    personal: leaveBalance.personal,
  };

  const sickRemaining = Math.max(
    0,
    effectiveLeaveBalance.sick - leaveBalance.sickUsed,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-foreground text-2xl font-bold">
            ຍີນດີຕ້ອນຮັບ, {user?.firstNameLo}
          </h1>
          <p className="text-muted-foreground">
            {formatDayDateLao(new Date())}
          </p>
        </div>
        <WeatherWidget />
      </div>

      {/* Today's Status */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full">
                <Clock className="text-primary h-6 w-6" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">
                  Today&apos;s Status
                </p>
                <p className="text-foreground text-lg font-semibold">
                  {todayAttendance?.checkIn
                    ? `ກົດເຊັກ-ອິນ ຕອນ ${todayAttendance.checkIn}`
                    : "ຍັງບໍ່ໄດ້ເຊັກ-ອິນ"}
                </p>
              </div>
            </div>
            <Badge
              variant={todayAttendance?.checkIn ? "default" : "secondary"}
              onClick={() => router.push("/dashboard/attendance")}
            >
              {todayAttendance?.checkOut
                ? "ກັບບ້ານແລ້ວ"
                : todayAttendance?.checkIn
                  ? "ເຂົ້າເຮັດວຽກແລ້ວ"
                  : "ຍັງບໍ່ໄດ້ເຊັກ-ອິນ"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Late Balance */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-chart-3/10 flex h-10 w-10 items-center justify-center rounded-lg">
                <AlertTriangle className="text-chart-3 h-5 w-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">ມາຊ້າ</p>
                <p className="text-foreground text-xl font-bold">
                  {lateThisMonth}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Fines */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-destructive/10 flex h-10 w-10 items-center justify-center rounded-lg">
                <DollarSign className="text-destructive h-5 w-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">ຄ່າປັນ</p>
                <p className="text-foreground text-xl font-bold">
                  {computedTotalFines.toLocaleString()} ₭
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Annual Leave */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-chart-2/10 flex h-10 w-10 items-center justify-center rounded-lg">
                <MapPinX className="text-chart-2 h-5 w-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">ລືມກົດເຂົ້າວຽກ</p>
                <p className="text-foreground text-xl font-bold">
                  {notCheckInThisMonth}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* work off site */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-chart-1/10 flex h-10 w-10 items-center justify-center rounded-lg">
                <HeartPulse className="text-chart-1 h-5 w-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">ອອກວຽກນອກ</p>
                <p className="text-foreground text-xl font-bold">
                  {offsiteDaysThisMonth} ມື້
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leave Balance Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            ປະເພດມື້ພັກ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {policies.length === 0 ? (
            <p className="text-muted-foreground py-2 text-center text-sm">
              ບໍ່ມີຂໍ້ມູນລາພັກ
            </p>
          ) : (
            <PolicyList policies={policies} usedByPolicy={usedByPolicy} />
          )}
        </CardContent>
      </Card>

      {/* leave      */}

      <Tabs defaultValue="checkIn" className="w-full">
        <TabsList>
          <TabsTrigger value="checkIn">ເຂົ້າວຽກ</TabsTrigger>
          <TabsTrigger value="leave">ລາພັກ</TabsTrigger>
          <TabsTrigger value="off_site">ອອກວຽກນອກ</TabsTrigger>
          <TabsTrigger value="topLeave">ມາຊ້າ (Top)</TabsTrigger>
        </TabsList>
        <TabsContent value="checkIn">
          <Card>
            <div>
              <CardContent className="text-muted-foreground h-auto max-h-[500px] overflow-auto text-sm">
                <div className="mb-4 flex items-center justify-between">
                  <p className="mb-2 text-lg font-semibold">
                    ລາຍການມາວຽກມື້ນີ້{" "}
                  </p>
                  <Button
                    variant="link"
                    onClick={() => {
                      const today = new Date();
                      const formattedToday = today.toISOString().split("T")[0];
                      const url = `/dashboard/check-in?date=${formattedToday}`;
                      router.push(url);
                    }}
                  >
                    ທັງໝົດ
                  </Button>
                </div>
                <CheckInToday />
              </CardContent>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="leave">
          <Card>
            <CardContent className="text-muted-foreground h-auto max-h-[500px] overflow-auto text-sm">
              <TodayLeaveSection />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="off_site">
          <Card>
            <CardContent className="text-muted-foreground h-auto max-h-[500px] overflow-auto pt-6 text-sm">
              <TodayOffsiteSection />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="topLeave">
          <Card>
            <CardContent className="pt-4 pb-0 text-sm">
              {/* Select lives outside overflow-auto so Radix portal is never clipped */}
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-foreground text-lg font-semibold">
                  ອັນດັບມາຊ້າ
                </p>
                <Select
                  value={selectedRankMonth}
                  onValueChange={setSelectedRankMonth}
                >
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rankMonths.map((mk) => (
                      <SelectItem key={mk} value={mk} className="text-xs">
                        {formatMonthYearLao(new Date(mk + "-01"))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Scrollable list only — Select is above this */}
              <div className="text-muted-foreground max-h-[440px] overflow-auto pb-4">
                {rankingLoading ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8">
                    <p className="text-muted-foreground text-sm">
                      ກຳລັງໂຫຼດ...
                    </p>
                  </div>
                ) : rankingError ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8">
                    <AlertTriangle className="text-destructive h-10 w-10" />
                    <p className="text-destructive text-sm">
                      ໂຫຼດຂໍ້ມູນລົ້ມເຫລວ
                    </p>
                  </div>
                ) : lateRanking.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8">
                    <AlertTriangle className="text-muted-foreground h-10 w-10" />
                    <p className="text-muted-foreground text-sm">ບໍ່ມີຂໍ້ມູນ</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lateRanking.map((entry, index) => (
                      <div
                        key={entry.userUuid ?? `rank-${index}`}
                        className="bg-card flex items-center gap-3 rounded-lg border px-4 py-3"
                      >
                        <span
                          className={`w-6 shrink-0 text-center text-sm font-bold ${index === 0 ? "text-yellow-500" : index === 1 ? "text-slate-400" : index === 2 ? "text-amber-600" : "text-muted-foreground"}`}
                        >
                          {index + 1}
                        </span>
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage
                            src={entry.employeeImage}
                            alt={entry.fullNameLo}
                            className="object-cover"
                          />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {entry.fullNameLo?.charAt(0) ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground truncate text-sm font-semibold">
                            {entry.fullNameLo ?? entry.fullNameEn}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {entry.workLocation?.name}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {entry.department?.name}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end">
                          <span className="text-destructive text-xl font-bold">
                            {entry.lateCount}
                          </span>
                          <span className="text-muted-foreground text-[10px]">
                            +{entry.penaltyMinutes} ນທ
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recent Leaves */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Recent Leave Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentLeaves.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No leave requests yet
            </p>
          ) : (
            <div className="space-y-3">
              {recentLeaves.map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {leave.policyName || leave.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(leave.startDate), 'MMM d')} - {format(new Date(leave.endDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <Badge
                    variant={
                      leave.status === 'approved' ? 'default' :
                        leave.status === 'rejected' ? 'destructive' :
                          'secondary'
                    }
                  >
                    {leave.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card> */}
    </div>
  );
}
