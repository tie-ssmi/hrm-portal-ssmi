"use client";

// ** core
import { useMemo, useState } from "react";

// ** assets / icons
import { Search, Users, Building2, Calendar } from "lucide-react";

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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";

// ** config / utils / types / hooks
import { useAuth } from "@/lib/auth-context";
import { useAllTodayOffsite } from "@/lib/use-work-outside-queries";
import type { Department, OffsiteRequestDoc } from "@/types/workOutside";

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

function sortDeptGroups<T>(entries: [string, T[]][]): [string, T[]][] {
  return [...entries].sort(([a], [b]) => {
    if (a === "C Level") return -1;
    if (b === "C Level") return 1;
    return a.localeCompare(b);
  });
}

// participantCount may be 0 on old records saved before the field existed;
// fall back to teammates array length + 1 (the requester themselves)
function tripPersonCount(record: OffsiteRequestDoc): number {
  return record.participantCount || (record.teammate?.length ?? 0) + 1;
}

// One row per teammate, each carrying its trip's details
type TripPersonRow = {
  uid: string;
  fullNameLo: string;
  fullNameEn: string;
  jobTitle: string;
  department: Department;
  photoUrl?: string;
  position: string;
  record: OffsiteRequestDoc;
};

function tripMembers(record: OffsiteRequestDoc): TripPersonRow[] {
  return (record.teammate ?? []).map((m) => ({
    uid: m.uid,
    fullNameLo: m.fullNameLo,
    fullNameEn: m.fullNameEn,
    jobTitle: m.jobTitle,
    department: m.department,
    photoUrl: m.photoUrl,
    position: m.position,
    record,
  }));
}

// ── page ───────────────────────────────────────────────────────────────────

export default function OffsiteTodayPage() {
  const { user } = useAuth();
  const { data: allRecords = [], isLoading } = useAllTodayOffsite();

  const userWorkLocation = getUserWorkLocationName(user?.workLocation);

  const [workLocationFilter, setWorkLocationFilter] = useState<string>(
    userWorkLocation ? "__user__" : "__all__",
  );
  const [search, setSearch] = useState("");

  const workLocations = useMemo(() => {
    const set = new Set<string>();
    allRecords.forEach((r) => {
      const name = r.requester?.workLocation?.nameLo;
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [allRecords]);

  const filteredRecords = useMemo(() => {
    const activeLocation =
      workLocationFilter === "__user__"
        ? userWorkLocation
        : workLocationFilter === "__all__"
          ? ""
          : workLocationFilter;

    return allRecords
      .filter(
        (r) =>
          !activeLocation ||
          r.requester?.workLocation?.nameLo === activeLocation,
      )
      .filter((r) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const subj = (r.subject || "").toLowerCase();
        const matchesPerson = (p?: {
          fullNameLo?: string;
          fullNameEn?: string;
        }) => (p?.fullNameLo || p?.fullNameEn || "").toLowerCase().includes(q);
        return (
          subj.includes(q) ||
          matchesPerson(r.requester) ||
          (r.teammate ?? []).some(matchesPerson)
        );
      });
  }, [allRecords, workLocationFilter, userWorkLocation, search]);

  // One row per teammate — not one row per trip record
  const rows = useMemo(
    () => filteredRecords.flatMap(tripMembers),
    [filteredRecords],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, TripPersonRow[]>();
    rows.forEach((row) => {
      const dept = row.department?.department || "ບໍ່ລະບຸ";
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept)!.push(row);
    });
    return sortDeptGroups(Array.from(map.entries()));
  }, [rows]);

  const numberedRows = useMemo(() => {
    let i = 0;
    return grouped.map(([dept, deptRows]) => ({
      dept,
      rows: deptRows.map((row) => ({ row, rowNum: ++i })),
    }));
  }, [grouped]);

  // Show branch info when viewing all branches so user can distinguish records by branch
  const showBranchCol = workLocationFilter !== "__user__" || !userWorkLocation;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-foreground text-2xl font-bold">ອອກວຽກນອກວັນນີ້</h1>
        <p className="text-muted-foreground text-sm">
          ລາຍຊື່ພະນັກງານທີ່ອອກວຽກນອກສະຖານທີ່ວັນນີ້
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Users className="text-muted-foreground h-4 w-4" />
              <p className="text-muted-foreground text-xs">ພະນັກງານທັງໝົດ</p>
            </div>
            <p className="text-foreground mt-1 text-2xl font-bold">
              {rows.length}
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
            placeholder="ຄົ້ນຫາຊື່ / ຫົວຂໍ້..."
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
            {workLocations
              .filter((loc) => loc !== userWorkLocation)
              .map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {loc}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            ລາຍຊື່ ({rows.length} ຄົນ)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
              <Spinner /> ກຳລັງໂຫຼດ...
            </div>
          ) : rows.length === 0 ? (
            <div className="text-muted-foreground py-16 text-center text-sm">
              ບໍ່ມີຂໍ້ມູນ
            </div>
          ) : (
            <div className="space-y-4 p-3">
              {numberedRows.map(({ dept, rows: deptRows }) => (
                <div key={dept}>
                  <div className="mb-2 flex items-center gap-2">
                    <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      {dept}
                    </p>
                    <span className="text-muted-foreground text-xs">
                      ({deptRows.length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {deptRows.map(({ row, rowNum }) => (
                      <div
                        key={`${row.record.id}-${row.uid}`}
                        className="bg-card flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-3"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="text-muted-foreground w-6 shrink-0 text-center text-sm font-bold">
                            {rowNum}
                          </span>
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarImage
                              src={row.photoUrl}
                              alt={row.fullNameLo || row.fullNameEn}
                              className="object-cover"
                            />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                              {(row.fullNameLo || row.fullNameEn || "?").charAt(
                                0,
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-foreground truncate text-sm font-semibold">
                              {row.fullNameLo || row.fullNameEn}
                            </p>
                            <p
                              className="text-muted-foreground truncate text-xs"
                              title={row.record.subject}
                            >
                              {row.record.subject}
                            </p>
                            {showBranchCol && (
                              <p className="text-muted-foreground truncate text-xs">
                                {row.record.requester?.workLocation?.nameLo ??
                                  "-"}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-row flex-wrap items-center gap-2 pl-9 sm:shrink-0 sm:flex-col sm:items-end sm:gap-0.5 sm:pl-0">
                          <Badge variant="secondary" className="text-xs">
                            {row.record.activityType?.name || "-"}
                          </Badge>
                          <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                            <Calendar className="h-3 w-3" />
                            {row.record.startDate} – {row.record.endDate}
                          </span>
                          <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                            <Users className="h-3 w-3" />
                            {tripPersonCount(row.record)} ຄົນ
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
