"use client";

// ** core
import { Fragment, useMemo, useState } from "react";

// ** assets / icons
import { Search, Users, Building2 } from "lucide-react";

// ** shared components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { translateJobTitle } from "@/components/translater";

// ** third party
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs } from "firebase/firestore";

// ** config / utils / types / hooks
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { useAllTodayLeaves } from "@/lib/use-leave-queries";
import type { LeaveRequest } from "@/lib/types";

// ── helpers ────────────────────────────────────────────────────────────────

function getUserWorkLocationName(workLocation: unknown): string {
  if (!workLocation) return "";
  if (typeof workLocation === "string") return workLocation;
  if (typeof workLocation === "object") {
    const wl = workLocation as Record<string, unknown>;
    const name = wl.name ?? wl.nameLo;
    return typeof name === "string" ? name : "";
  }
  return "";
}

function getLeaveTypeLabel(record: LeaveRequest): string {
  return record.policyName ?? record.type ?? "ລາພັກ";
}

function sortDeptGroups(
  entries: [string, LeaveRequest[]][],
): [string, LeaveRequest[]][] {
  return [...entries].sort(([a], [b]) => {
    if (a === "C Level") return -1;
    if (b === "C Level") return 1;
    return a.localeCompare(b);
  });
}

// ── page ───────────────────────────────────────────────────────────────────

export default function LeaveTodayPage() {
  const { user } = useAuth();
  const { data: allRecords = [], isLoading } = useAllTodayLeaves();

  const myWorkLocationUid =
    typeof user?.workLocation === "object" && user.workLocation !== null
      ? ((user.workLocation as { uuid?: string; uid?: string }).uuid ??
        (user.workLocation as { uid?: string }).uid)
      : undefined;

  const userWorkLocation = getUserWorkLocationName(user?.workLocation);

  const [workLocationFilter, setWorkLocationFilter] = useState<string>(
    userWorkLocation ? "__user__" : "__all__",
  );
  const [search, setSearch] = useState("");

  const { data: workLocationDocs = [] } = useQuery({
    queryKey: ["workLocations", "all"],
    queryFn: async () => {
      const snap = await getDocs(collection(db, "workLocation"));
      return snap.docs.map((d) => ({
        uid: d.id,
        name: (d.data().nameLo ||
          d.data().nameEn ||
          d.data().nameEN ||
          d.id) as string,
      }));
    },
    staleTime: 1000 * 60 * 10,
  });

  // uid → name lookup
  const workLocationNameMap = useMemo(
    () => Object.fromEntries(workLocationDocs.map((wl) => [wl.uid, wl.name])),
    [workLocationDocs],
  );

  // unique work location uids present in today's records (excluding the user's own)
  const otherWorkLocations = useMemo(() => {
    const uids = new Set(
      allRecords.map((r) => r.workLocationUid).filter(Boolean),
    );
    if (myWorkLocationUid) uids.delete(myWorkLocationUid);
    return Array.from(uids) as string[];
  }, [allRecords, myWorkLocationUid]);

  const filtered = useMemo(() => {
    return allRecords
      .filter((r) => {
        if (workLocationFilter === "__all__") return true;
        if (workLocationFilter === "__user__")
          return r.workLocationUid === myWorkLocationUid;
        return r.workLocationUid === workLocationFilter;
      })
      .filter((r) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (r.leaveUserName ?? "").toLowerCase().includes(q);
      });
  }, [allRecords, workLocationFilter, myWorkLocationUid, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, LeaveRequest[]>();
    filtered.forEach((r) => {
      const dept = r.departmentNameLo || r.departmentNameEn || "ບໍ່ລະບຸ";
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept)!.push(r);
    });
    return sortDeptGroups(Array.from(map.entries()));
  }, [filtered]);

  const numberedRows = useMemo(() => {
    let i = 0;
    return grouped.map(([dept, records]) => ({
      dept,
      records: records.map((record) => ({ record, rowNum: ++i })),
    }));
  }, [grouped]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-foreground text-2xl font-bold">ການລາພັກວັນນີ້</h1>
        <p className="text-muted-foreground text-sm">
          ລາຍຊື່ພະນັກງານທີ່ລາພັກວັນນີ້
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Users className="text-muted-foreground h-4 w-4" />
              <p className="text-muted-foreground text-xs">ທັງໝົດ</p>
            </div>
            <p className="text-foreground mt-1 text-2xl font-bold">
              {filtered.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Building2 className="text-muted-foreground h-4 w-4" />
              <p className="text-muted-foreground text-xs">ພາກແນກ</p>
            </div>
            <p className="text-foreground mt-1 text-2xl font-bold">
              {grouped.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-xs flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="ຄົ້ນຫາຊື່..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
        <Select
          value={workLocationFilter}
          onValueChange={setWorkLocationFilter}
        >
          <SelectTrigger className="h-9 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {userWorkLocation && (
              <SelectItem value="__user__">{userWorkLocation}</SelectItem>
            )}
            <SelectItem value="__all__">ທຸກສາຂາ</SelectItem>
            {otherWorkLocations.map((uid) => (
              <SelectItem key={uid} value={uid}>
                {workLocationNameMap[uid] ?? uid}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            ລາຍຊື່ ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
              <Spinner /> ກຳລັງໂຫຼດ...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-muted-foreground py-16 text-center text-sm">
              ບໍ່ມີຂໍ້ມູນ
            </div>
          ) : (
            <>
              {/* Mobile cards — grouped by department */}
              <div className="space-y-4 p-3 md:hidden">
                {grouped.map(([dept, records]) => (
                  <div key={dept}>
                    <div className="mb-2 flex items-center gap-2">
                      <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                        {dept}
                      </p>
                      <span className="text-muted-foreground text-xs">
                        ({records.length})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {records.map((record) => (
                        <div
                          key={record.id}
                          className="bg-background flex items-center gap-3 rounded-lg border p-3"
                        >
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarImage
                              src={record.leaveImage || ""}
                              alt={record.leaveUserName}
                              className="object-cover"
                            />

                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {(record.leaveUserName || "?")[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {record.leaveUserName || "-"}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {translateJobTitle(record.jobTitle ?? "") || "-"}
                            </p>
                            <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                              <span>{record.startDate}</span>
                              <span>–</span>
                              <span>{record.endDate}</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <Badge variant="secondary" className="text-[10px]">
                              {getLeaveTypeLabel(record)}
                            </Badge>
                            <span className="text-primary text-xs font-bold">
                              {record.duration ?? "-"} ມື້
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table — grouped by department */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-muted/40">
                      <TableHead className="w-12 px-4">#</TableHead>
                      <TableHead className="min-w-[200px] px-4">
                        ຊື່ / ຕຳແໜ່ງ
                      </TableHead>
                      <TableHead className="min-w-[140px] px-4">
                        ພາກແນກ
                      </TableHead>
                      <TableHead className="w-32 px-4">ປະເພດລາ</TableHead>
                      <TableHead className="w-48 px-4">ວັນທີ</TableHead>
                      <TableHead className="w-20 px-4 text-center">
                        ຈຳນວນ
                      </TableHead>
                      <TableHead className="w-40 px-4">ຜູ້ຮັບວຽກຕໍ່</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {numberedRows.map(({ dept, records }) => (
                      <Fragment key={dept}>
                        <TableRow className="bg-muted/20 hover:bg-transparent">
                          <TableCell colSpan={7} className="px-4 py-2">
                            <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                              {dept}
                            </span>
                            <span className="text-muted-foreground ml-2 text-xs">
                              ({records.length})
                            </span>
                          </TableCell>
                        </TableRow>
                        {records.map(({ record, rowNum }) => (
                          <TableRow
                            key={record.id}
                            className="hover:bg-muted/30"
                          >
                            <TableCell className="text-muted-foreground px-4 py-3 text-sm font-semibold">
                              {rowNum}
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <div className="flex min-w-0 items-center gap-2">
                                <Avatar className="h-8 w-8 shrink-0">
                                  <AvatarImage
                                    src={record.leaveImage || ""}
                                    alt={record.leaveUserName}
                                    className="object-cover"
                                  />

                                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {(record.leaveUserName || "?")[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">
                                    {record.leaveUserName || "-"}
                                  </p>
                                  <p className="text-muted-foreground truncate text-xs">
                                    {translateJobTitle(record.jobTitle ?? "") ||
                                      "-"}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-foreground px-4 py-3 text-sm">
                              {record.departmentNameLo ||
                                record.departmentNameEn ||
                                "-"}
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <Badge variant="secondary" className="text-xs">
                                {getLeaveTypeLabel(record)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-foreground px-4 py-3 text-sm tabular-nums">
                              {record.startDate} – {record.endDate}
                            </TableCell>
                            <TableCell className="text-primary px-4 py-3 text-center text-sm font-bold tabular-nums">
                              {record.duration ?? "-"} ມື້
                            </TableCell>
                            <TableCell className="text-muted-foreground px-4 py-3 text-sm">
                              {record.successorNameLo ||
                                record.successorNameEn ||
                                "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
