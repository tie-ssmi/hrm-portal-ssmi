"use client";

// ** core
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

// ** assets / icons
import {
  MapPin,
  LogIn,
  LogOut,
  Clock,
  CheckCircle,
  AlertTriangle,
  Navigation,
  Shield,
  ShieldX,
  MapPinOff,
} from "lucide-react";

// ** shared components
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CameraCapture } from "@/components/camera-capture";
import { formatDateLao, formatDayDateLao } from "@/components/laoDate";

// ** third party
import { toast } from "sonner";
import { addDays, format, startOfWeek } from "date-fns";

// ** config / utils / types / hooks
import { useAuth } from "@/lib/auth-context";
import { useHRM } from "@/lib/hrm-context";
import {
  useAttendanceHistory,
  useTodayAttendance,
  useCheckIn,
  useCheckOut,
  useTodayLeaveStatus,
  useTodayTrip,
} from "@/lib/use-attendance-queries";
import { useOfficialHolidays } from "@/lib/use-official-holidays-query";
import { getVientianeIsoDate } from "@/lib/server-time";
import type { AttendanceRecord } from "@/lib/types";

type LocationState = {
  lat: number;
  lng: number;
  accuracy: number;
  error?: string;
};

// Turns a "YYYY-MM-DD" Vientiane calendar date into a local Date at local
// midnight for that same day, so date-fns / getDay() (which read local time)
// land on the correct day regardless of the viewer's own timezone offset.
function isoDateToLocalDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// --- Sub-components ---

// Isolated — 1s interval only re-renders this widget, not the whole page
const LiveClock = memo(function LiveClock() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const id = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <Card className="bg-primary text-primary-foreground">
      <CardContent className="pt-6">
        <div className="text-center">
          <p className="text-sm opacity-80">ເວລາປະຈຸບັນ</p>
          <p className="mt-1 text-4xl font-bold">
            {time ? format(time, "HH:mm:ss") : "--:--:--"}
          </p>
          <p className="mt-2 text-sm opacity-80">
            {time ? formatDayDateLao(time) : ""}
          </p>
        </div>
      </CardContent>
    </Card>
  );
});

const LocationCard = memo(function LocationCard({
  location,
  isLoadingLocation,
  isWithinOffice,
  geoFenceStatus,
  officeDistance,
  onRefresh,
}: {
  location: LocationState | null;
  isLoadingLocation: boolean;
  isWithinOffice: boolean;
  geoFenceStatus: string;
  officeDistance: number | null;
  onRefresh: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4" />
          ສະຖານທີ່ຂອງທ່ານ
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoadingLocation}
          >
            {isLoadingLocation ? (
              <Spinner className="mr-2" />
            ) : (
              <Navigation className="mr-2 h-4 w-4" />
            )}
            ດຶງຂໍ້ມູນຕຳແໜ່ງໃໝ່
          </Button>

          {location && !location.error && (
            <Badge
              variant={isWithinOffice ? "default" : "destructive"}
              className="flex items-center gap-1"
            >
              {isWithinOffice ? (
                <>
                  <Shield className="h-3 w-3" /> ຢູ່ໃນພື້ນທີ່ຫ້ອງການ
                </>
              ) : (
                <>
                  <ShieldX className="h-3 w-3" /> ຢູ່ນອກພື້ນທີ່ຫ້ອງການ
                </>
              )}
            </Badge>
          )}
        </div>

        {location && !location.error && (
          <div className="mt-3 space-y-2">
            {geoFenceStatus === "loading" && (
              <p className="text-muted-foreground text-xs">
                ກຳລັງໂຫຼດຂໍ້ມູນສະຖານທີ່ຫ້ອງການ...
              </p>
            )}
            {geoFenceStatus === "no_coordinates" && (
              <p className="text-xs text-amber-600">
                ຫ້ອງການຍັງບໍ່ໄດ້ຕັ້ງຄ່າພິກັດ GPS — ການກວດສອບໄລຍະຖືກຂ້າມ
              </p>
            )}
            {geoFenceStatus === "not_found" && (
              <p className="text-destructive text-xs">
                ບໍ່ພົບຂໍ້ມູນສະຖານທີ່ຫ້ອງການ
              </p>
            )}
            {geoFenceStatus === "found" && officeDistance !== null && (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">ໄກຈາກຫ້ອງການ</span>
                  <span
                    className={`font-semibold tabular-nums ${officeDistance > 100 ? "text-destructive" : "text-emerald-600"}`}
                  >
                    {officeDistance} / 100 ແມັດ
                  </span>
                </div>
                <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${officeDistance > 100 ? "bg-destructive" : "bg-emerald-500"}`}
                    style={{
                      width: `${Math.max(Math.min((officeDistance / 100) * 100, 100), 4)}%`,
                    }}
                  />
                </div>
              </>
            )}
            <p className="text-muted-foreground text-xs">
              ຄວາມແມ່ນຍໍາ GPS: {Math.round(location.accuracy)} ແມັດ
            </p>
          </div>
        )}

        {location?.error && (
          <p className="text-destructive mt-2 text-xs">{location.error}</p>
        )}
      </CardContent>
    </Card>
  );
});

const DailySummaryCard = memo(function DailySummaryCard({
  todayAttendance,
  isLoadingHistory,
  isOffsite,
  onIsOffsiteChange,
}: {
  todayAttendance: AttendanceRecord | undefined | null;
  isLoadingHistory: boolean;
  isOffsite: boolean;
  onIsOffsiteChange: (v: boolean) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">ສະຫຼຸບປະຈຳວັນ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-muted-foreground mb-1 text-xs">ເຂົ້າວຽກ</p>
            {isLoadingHistory ? (
              <Skeleton className="mx-auto mt-1 h-7 w-16" />
            ) : (
              <p className="text-foreground text-xl font-bold">
                {todayAttendance?.checkIn || "--:--"}
              </p>
            )}
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-muted-foreground mb-1 text-xs">ອອກວຽກ</p>
            {isLoadingHistory ? (
              <Skeleton className="mx-auto mt-1 h-7 w-16" />
            ) : (
              <p className="text-foreground text-xl font-bold">
                {todayAttendance?.checkOut || "--:--"}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center">
          {isLoadingHistory ? (
            <Skeleton className="h-8 w-36 rounded-full" />
          ) : (
            <Badge
              variant={
                todayAttendance?.status === "present"
                  ? "default"
                  : todayAttendance?.status === "late"
                    ? "secondary"
                    : todayAttendance?.status === "not_check_in"
                      ? "destructive"
                      : "outline"
              }
              className="px-4 py-1 text-sm"
            >
              {todayAttendance?.checkOut ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" /> ກັບແລ້ວ
                </>
              ) : todayAttendance?.status === "not_check_in" ? (
                <>
                  <AlertTriangle className="mr-2 h-4 w-4" /> ລືມກົດເຂົ້າວຽກ
                </>
              ) : todayAttendance?.checkIn ? (
                <>
                  <Clock className="mr-2 h-4 w-4" />{" "}
                  {todayAttendance.status === "late"
                    ? "ເຂົ້າວຽກ (ຊ້າ)"
                    : "ເຂົ້າວຽກ"}
                </>
              ) : (
                <>
                  <AlertTriangle className="mr-2 h-4 w-4" /> ຍັງບໍ່ເຂົ້າວຽກ
                </>
              )}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-lg border px-3 py-2.5">
          <Checkbox
            id="offsite-mode"
            checked={isOffsite}
            onCheckedChange={(v) => onIsOffsiteChange(v === true)}
          />
          <Label
            htmlFor="offsite-mode"
            className="flex cursor-pointer items-center gap-1.5 text-sm select-none"
          >
            <MapPinOff className="text-muted-foreground h-3.5 w-3.5" />
            ອອກວຽກນອກ
          </Label>
          {isOffsite && (
            <span className="ml-auto text-[10px] font-medium text-amber-600">
              ບໍ່ກວດໄລຍະ · ຕ້ອງຖ່າຍຮູບ
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

const WeeklyHistoryCard = memo(function WeeklyHistoryCard({
  weeklyHistory,
  isLoadingHistory,
  onSelectOffsiteDetail,
}: {
  weeklyHistory: AttendanceRecord[];
  isLoadingHistory: boolean;
  onSelectOffsiteDetail: (record: AttendanceRecord) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">ສະຫຼຸບປະຈຳອາທິດ</CardTitle>
        <CardDescription>ບັນທຶກ ການມາວຽກໃນອາທິດນີ້</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingHistory ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-muted/50 flex items-center justify-between rounded-lg p-3"
              >
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {weeklyHistory.map((record) => (
              <div
                key={record.id}
                className={[
                  "bg-muted/50 flex items-center justify-between rounded-lg p-3",
                  record.isOffsite
                    ? "hover:bg-muted/80 cursor-pointer transition-colors"
                    : "",
                ].join(" ")}
                onClick={() =>
                  record.isOffsite && onSelectOffsiteDetail(record)
                }
              >
                <div>
                  <p className="text-sm font-medium">
                    {formatDateLao(new Date(`${record.date}T00:00:00`))}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {record.checkIn || "--:--"} - {record.checkOut || "--:--"}
                  </p>
                </div>
                <Badge
                  variant={
                    record.status === "present"
                      ? "default"
                      : record.status === "late"
                        ? "secondary"
                        : record.status === "leave"
                          ? "outline"
                          : record.status === "trip"
                            ? "outline"
                            : "destructive"
                  }
                >
                  {record.isOffsite && record.status === "present"
                    ? "ອອກວຽກນອກ"
                    : record.isOffsite && record.status === "late"
                      ? "ອອກວຽກນອກ (ຊ້າ)"
                      : record.status === "present"
                        ? "ມາວຽກ"
                        : record.status === "late"
                          ? "ມາວຽກ (ຊ້າ)"
                          : record.status === "leave"
                            ? "ພັກ"
                            : record.status === "trip"
                              ? "ທັດສະນະ"
                              : "ບໍ່ມາວຽກ"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

const OffsiteDetailDialog = memo(function OffsiteDetailDialog({
  detail,
  onClose,
}: {
  detail: AttendanceRecord | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!detail}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>ລາຍລະອຽດອອກວຽກນອກ</DialogTitle>
        </DialogHeader>
        {detail && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                ເຂົ້າວຽກ
              </p>
              <p className="text-sm font-semibold">
                {detail.checkIn || "--:--"}
              </p>
              {detail.checkInImageURL ? (
                <img
                  src={detail.checkInImageURL}
                  alt="ຮູບເຂົ້າວຽກ"
                  className="bg-muted max-h-48 w-full rounded-lg object-cover"
                />
              ) : (
                <div className="bg-muted text-muted-foreground flex h-24 items-center justify-center rounded-lg text-xs">
                  ບໍ່ມີຮູບ
                </div>
              )}
            </div>

            <div className="border-t" />

            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                ອອກວຽກ
              </p>
              <p className="text-sm font-semibold">
                {detail.checkOut || "--:--"}
              </p>
              {detail.checkOutImageURL ? (
                <img
                  src={detail.checkOutImageURL}
                  alt="ຮູບອອກວຽກ"
                  className="bg-muted max-h-48 w-full rounded-lg object-cover"
                />
              ) : (
                <div className="bg-muted text-muted-foreground flex h-24 items-center justify-center rounded-lg text-xs">
                  ບໍ່ມີຮູບ
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});

// --- Main page ---

export default function AttendancePage() {
  const { user } = useAuth();
  const { distanceToOffice, geoFenceStatus } = useHRM();

  // Recomputed each render to detect midnight boundary (intentional — cheap string).
  // Must use Vientiane time, not the browser's local timezone, since leave/attendance
  // dates are all anchored to Asia/Vientiane regardless of the viewer's device.
  const todayIso = getVientianeIsoDate();

  const { data: todayAttendance, isLoading: isLoadingHistory } =
    useTodayAttendance(user?.uuid);
  const { data: attendanceHistory = [] } = useAttendanceHistory(user?.uuid);
  const { data: holidays = [] } = useOfficialHolidays();
  const { data: todayLeaveStatus = "none", isLoading: isLoadingLeaveStatus } =
    useTodayLeaveStatus(user?.uuid, todayIso);
  const { data: todayTrip = null } = useTodayTrip(user?.uuid, todayIso);
  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();

  const [location, setLocation] = useState<LocationState | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isOffsite, setIsOffsite] = useState(false);
  const [offsiteDetail, setOffsiteDetail] = useState<AttendanceRecord | null>(
    null,
  );

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraType, setCameraType] = useState<"checkIn" | "checkOut">(
    "checkIn",
  );
  const pendingResolveRef = useRef<((file: File | null) => void) | null>(null);

  // Refs keep handleAttendance stable across mutation isPending state changes
  const checkInMutRef = useRef(checkInMutation);
  checkInMutRef.current = checkInMutation;
  const checkOutMutRef = useRef(checkOutMutation);
  checkOutMutRef.current = checkOutMutation;

  const captureImage = useCallback(
    (type: "checkIn" | "checkOut"): Promise<File | null> => {
      return new Promise((resolve) => {
        pendingResolveRef.current = resolve;
        setCameraType(type);
        setCameraOpen(true);
      });
    },
    [],
  );

  const handleCameraCapture = useCallback((file: File) => {
    pendingResolveRef.current?.(file);
    pendingResolveRef.current = null;
  }, []);

  const handleCameraClose = useCallback((open: boolean) => {
    setCameraOpen(open);
    if (!open) {
      pendingResolveRef.current?.(null);
      pendingResolveRef.current = null;
    }
  }, []);

  const getLocation = useCallback(async (): Promise<LocationState | null> => {
    setIsLoadingLocation(true);
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setIsLoadingLocation(false);
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc: LocationState = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          setLocation(loc);
          setIsLoadingLocation(false);
          resolve(loc);
        },
        (error) => {
          setLocation({ lat: 0, lng: 0, accuracy: 0, error: error.message });
          setIsLoadingLocation(false);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
  }, []);

  const getValidatedLocation =
    useCallback(async (): Promise<LocationState | null> => {
      // Reuse cached GPS if already fetched — avoids double-fetch that causes false GPS failures on check-in/out
      const loc = location && !location.error ? location : await getLocation();
      if (!loc || loc.error) {
        toast.error(
          'ບໍ່ສາມາດຮັບຂໍ້ມູນສະຖານທີ່. ກະລຸນາກົດ "ດຶງຂໍ້ມູນຕຳແໜ່ງໃໝ່" ກ່ອນ.',
        );
        return null;
      }
      if (geoFenceStatus === "no_coordinates") return loc;
      const dist = distanceToOffice(loc.lat, loc.lng);
      if (dist === null) {
        toast.error("ບໍ່ສາມາດໂຫຼດຂໍ້ມູນສະຖານທີ່ຫ້ອງການໄດ້. ກະລຸນາລອງໃໝ່.");
        return null;
      }
      if (dist > 100) {
        toast.error(
          `ທ່ານຢູ່ຫ່າງຈາກຫ້ອງການ ${dist} ແມັດ. ຕ້ອງຢູ່ພາຍໃນ 100 ແມັດ.`,
        );
        return null;
      }
      return loc;
    }, [location, getLocation, distanceToOffice, geoFenceStatus]);

  const isBlockedDay = useMemo(() => {
    const day = isoDateToLocalDate(todayIso).getDay();
    if (day === 0 || day === 6)
      return {
        blocked: true,
        reason: "ວັນນີ້ເປັນວັນພັກທ້າຍອາທິດ ບໍ່ສາມາດ Check-In ໄດ້",
      };
    const holiday = holidays.find((h) => h.date === todayIso);
    if (holiday)
      return { blocked: true, reason: `ວັນນີ້ເປັນວັນພັກ: ${holiday.name}` };
    if (todayLeaveStatus === "blocked")
      return {
        blocked: true,
        reason: "ທ່ານມີວັນລາພັກທີ່ໄດ້ຮັບອະນຸມັດໃນວັນນີ້ ບໍ່ສາມາດ Check-In ໄດ້",
      };
    if (todayTrip)
      return {
        blocked: true,
        reason:
          todayTrip.reason ||
          "ທ່ານກຳລັງໄປທັດສະນະ/ວຽກນອກສະຖານທີ່ເປັນກຸ່ມ ບໍ່ສາມາດ Check-In ໄດ້",
      };
    return { blocked: false, reason: "" };
  }, [holidays, todayIso, todayLeaveStatus, todayTrip]);

  const handleAttendance = useCallback(
    async (type: "checkIn" | "checkOut") => {
      if (!user) {
        toast.error("ບໍ່ເຫັນຂໍ້ມູນຜູ້ໃຊ້. ກະລຸນາເຂົ້າລະບົບອີກຄັ້ງ.");
        return;
      }
      if (type === "checkIn" && isLoadingLeaveStatus) {
        toast.error("ກຳລັງກວດສອບສະຖານະລາພັກ. ກະລຸນາລໍຖ້າ ແລ້ວລອງໃໝ່.");
        return;
      }
      if (type === "checkIn" && isBlockedDay.blocked) {
        toast.error(isBlockedDay.reason);
        return;
      }

      const mutation =
        type === "checkIn" ? checkInMutRef.current : checkOutMutRef.current;
      const successMsg = isOffsite
        ? type === "checkIn"
          ? "ເຂົ້າວຽກນອກສຳເລັດ"
          : "ອອກວຽກນອກສຳເລັດ"
        : type === "checkIn"
          ? "ເຂົ້າການສຳເລັດແລ້ວ"
          : "ອອກຈາກການສຳເລັດແລ້ວ";

      try {
        if (isOffsite) {
          const imageFile = await captureImage(type);
          if (!imageFile) {
            toast.error("ກະລຸນາຖ່າຍຮູບກ່ອນ.");
            return;
          }
          const loc = await getLocation();
          await mutation.mutateAsync({
            user,
            location: loc ? { lat: loc.lat, lng: loc.lng } : undefined,
            imageFile,
            isOffsite: true,
          });
        } else {
          const loc = await getValidatedLocation();
          if (!loc) return;
          await mutation.mutateAsync({
            user,
            location: { lat: loc.lat, lng: loc.lng },
          });
        }
        toast.success(successMsg);
      } catch (error) {
        const code = (error as { code?: string }).code ?? "";
        let msg: string;
        if (code === "functions/internal" || code === "functions/unknown") {
          msg = "ເກີດຂໍ້ຜິດພາດ. ກະລຸນາລອງໃໝ່.";
        } else if (code === "functions/unavailable") {
          msg = "ບໍ່ສາມາດເຊື່ອມຕໍ່ server. ກະລຸນາກວດ internet.";
        } else if (code === "functions/unauthenticated") {
          msg = "ກະລຸນາເຂົ້າລະບົບໃໝ່.";
        } else {
          msg =
            error instanceof Error
              ? error.message
              : "ເກີດຂໍ້ຜິດພາດ. ກະລຸນາລອງໃໝ່.";
        }
        toast.error(msg);
      }
    },
    [
      user,
      isOffsite,
      isBlockedDay,
      isLoadingLeaveStatus,
      getLocation,
      getValidatedLocation,
      captureImage,
    ],
  );

  const officeDistance = useMemo(() => {
    if (!location || location.error) return null;
    return distanceToOffice(location.lat, location.lng);
  }, [distanceToOffice, location]);

  const isWithinOffice = useMemo(() => {
    if (!location || !!location.error) return true;
    if (geoFenceStatus === "no_coordinates") return true;
    // Must match the 100m limit enforced in getValidatedLocation — otherwise
    // the button disables (and badge reads "outside office") for users who
    // are actually still within the allowed check-in radius.
    return officeDistance !== null && officeDistance <= 100;
  }, [location, officeDistance, geoFenceStatus]);

  const weeklyHistory = useMemo(() => {
    const weekStart = startOfWeek(isoDateToLocalDate(todayIso), { weekStartsOn: 1 });
    const weekStartIso = format(weekStart, "yyyy-MM-dd");
    const weekEndIso = format(addDays(weekStart, 6), "yyyy-MM-dd");
    return attendanceHistory
      .filter((r) => {
        const d = r.date.slice(0, 10);
        return d >= weekStartIso && d <= weekEndIso;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendanceHistory, todayIso]);

  const handleCloseOffsiteDetail = useCallback(
    () => setOffsiteDetail(null),
    [],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold">
          Check-In / Check-Out
        </h1>
        <p className="text-muted-foreground">
          ບັນທຶກການເຂົ້າຮ່ວມຂອງທ່ານດ້ວຍການຢັ້ງຢືນ GPS
        </p>
      </div>

      <LiveClock />

      <LocationCard
        location={location}
        isLoadingLocation={isLoadingLocation}
        isWithinOffice={isWithinOffice}
        geoFenceStatus={geoFenceStatus}
        officeDistance={officeDistance}
        onRefresh={getLocation}
      />

      <DailySummaryCard
        todayAttendance={todayAttendance}
        isLoadingHistory={isLoadingHistory}
        isOffsite={isOffsite}
        onIsOffsiteChange={setIsOffsite}
      />

      <CameraCapture
        open={cameraOpen}
        onOpenChange={handleCameraClose}
        onCapture={handleCameraCapture}
        title={cameraType === "checkIn" ? "ຖ່າຍຮູບເຂົ້າວຽກ" : "ຖ່າຍຮູບອອກວຽກ"}
      />

      {/* Leave status banner */}
      {todayLeaveStatus === "blocked" && (
        <div className="border-destructive/30 bg-destructive/5 flex items-start gap-2 rounded-lg border p-3">
          <AlertTriangle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="text-destructive text-sm font-medium">
              ລາພັກໄດ້ຮັບອະນຸມັດແລ້ວ
            </p>
            <p className="text-destructive/80 mt-0.5 text-xs">
              ທ່ານມີການລາພັກໃນວັນນີ້ — ບໍ່ສາມາດ Check-In ໄດ້
            </p>
          </div>
        </div>
      )}
      {todayLeaveStatus === "morning_leave" && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
              ລາພັກເຄິ່ງເຊົ້າ
            </p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-500">
              ທ່ານລາພັກໃນຕອນເຊົ້າ — ສາມາດ Check-In ໄດ້ຮອດ 14:00 · ທັນ ≤ 12:30 ·
              ຊ້າ 12:31–14:00
            </p>
          </div>
        </div>
      )}
      {isBlockedDay.blocked && isBlockedDay.reason && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
              ໄປທ່ຽວປະຈຳປີກັບບໍລິສັດ
            </p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-500">
              {isBlockedDay.reason}
            </p>
          </div>
        </div>
      )}

      {isLoadingHistory ? (
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <Button
              size="lg"
              className="h-16 text-lg"
              onClick={() => handleAttendance("checkIn")}
              disabled={
                isBlockedDay.blocked ||
                isLoadingLeaveStatus ||
                checkInMutation.isPending ||
                !!todayAttendance?.checkIn ||
                (!isOffsite && !isWithinOffice)
              }
            >
              {checkInMutation.isPending ? (
                <Spinner className="mr-2" />
              ) : (
                <LogIn className="mr-2 h-5 w-5" />
              )}
              Check In
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="h-16 text-lg"
              onClick={() => handleAttendance("checkOut")}
              disabled={
                checkOutMutation.isPending ||
                !todayAttendance?.checkIn ||
                !!todayAttendance?.checkOut ||
                (!isOffsite && !isWithinOffice)
              }
            >
              {checkOutMutation.isPending ? (
                <Spinner className="mr-2" />
              ) : (
                <LogOut className="mr-2 h-5 w-5" />
              )}
              Check Out
            </Button>
          </div>
        </div>
      )}

      <WeeklyHistoryCard
        weeklyHistory={weeklyHistory}
        isLoadingHistory={isLoadingHistory}
        onSelectOffsiteDetail={setOffsiteDetail}
      />

      <OffsiteDetailDialog
        detail={offsiteDetail}
        onClose={handleCloseOffsiteDetail}
      />
    </div>
  );
}
