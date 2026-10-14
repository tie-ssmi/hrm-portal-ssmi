"use client";

// OT check-in tab on the attendance page. Shown only to a teammate on an
// approved OT request covering today (see lib/attendance-ot.ts). Every punch
// needs a photo and GPS; there is no geofence. The server
// (recordOTCheckIn / recordOTCheckOut) re-checks all of it.

// ** core
import { useCallback, useRef, useState } from "react";

// ** assets / icons
import { Clock, LogIn, LogOut, MapPin, Timer } from "lucide-react";

// ** shared components
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { CameraCapture } from "@/components/camera-capture";

// ** third party
import { toast } from "sonner";

// ** config / utils / types / hooks
import { useTodayOTAttendance, useOTPunch } from "@/lib/use-attendance-ot-queries";
import type { Employee } from "@/lib/types";
import type { OffsiteRequestDoc } from "@/types/workOutside";

type Props = {
  user: Employee;
  otRequest: OffsiteRequestDoc;
  todayIso: string;
};

function getGps(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

export function OTCheckInPanel({ user, otRequest, todayIso }: Props) {
  const { data: today, isLoading } = useTodayOTAttendance(user.uuid, todayIso, true);
  const punch = useOTPunch(todayIso);

  const [submitting, setSubmitting] = useState<"checkIn" | "checkOut" | null>(null);
  const submittingRef = useRef(false);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraType, setCameraType] = useState<"checkIn" | "checkOut">("checkIn");
  const resolveRef = useRef<((file: File | null) => void) | null>(null);

  const captureImage = useCallback((type: "checkIn" | "checkOut") => {
    return new Promise<File | null>((resolve) => {
      resolveRef.current = resolve;
      setCameraType(type);
      setCameraOpen(true);
    });
  }, []);

  const handlePunch = useCallback(
    async (type: "checkIn" | "checkOut") => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(type);
      try {
        const imageFile = await captureImage(type);
        if (!imageFile) {
          toast.error("ກະລຸນາຖ່າຍຮູບກ່ອນ.");
          return;
        }
        const gps = await getGps();
        if (!gps) {
          toast.error("ບໍ່ສາມາດຮັບຂໍ້ມູນ GPS. ກະລຸນາເປີດຕຳແໜ່ງ ແລ້ວລອງໃໝ່.");
          return;
        }
        await punch.mutateAsync({
          user,
          type,
          imageFile,
          location: { lat: gps.lat, lng: gps.lng },
          accuracy: gps.accuracy,
        });
        toast.success(type === "checkIn" ? "ເຂົ້າ OT ສຳເລັດ" : "ອອກ OT ສຳເລັດ");
      } catch (error) {
        const code = (error as { code?: string }).code ?? "";
        toast.error(
          code === "functions/unavailable"
            ? "ບໍ່ສາມາດເຊື່ອມຕໍ່ server. ກະລຸນາກວດ internet."
            : code === "functions/internal" || code === "functions/unknown"
              ? "ເກີດຂໍ້ຜິດພາດ. ກະລຸນາລອງໃໝ່."
              : error instanceof Error
                ? error.message
                : "ເກີດຂໍ້ຜິດພາດ. ກະລຸນາລອງໃໝ່.",
        );
      } finally {
        submittingRef.current = false;
        setSubmitting(null);
      }
    },
    [captureImage, punch, user],
  );

  const busy = submitting !== null || punch.isPending;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ຄຳຂໍ OT ມື້ນີ້</CardTitle>
          <CardDescription className="font-mono text-xs">
            {otRequest.requestNo}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-medium">{otRequest.subject}</p>
          {(otRequest.startTime || otRequest.endTime) && (
            <p className="text-muted-foreground flex items-center gap-1.5 tabular-nums">
              <Clock className="h-3.5 w-3.5" />
              ເວລາ OT {otRequest.startTime || "—"} – {otRequest.endTime || "—"}
            </p>
          )}
          {otRequest.location && (
            <p className="text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {otRequest.location}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <dl className="grid grid-cols-3 gap-2 text-center tabular-nums">
              <div>
                <dt className="text-muted-foreground text-xs">ເຂົ້າ OT</dt>
                <dd className="mt-1 text-lg font-semibold">{today?.checkInTime ?? "--:--"}</dd>
                {today?.status && (
                  <Badge
                    variant={today.status === "present" ? "default" : "secondary"}
                    className="mt-1"
                  >
                    {today.status === "present" ? "ທັນເວລາ" : "ມາສາຍ"}
                  </Badge>
                )}
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">ອອກ OT</dt>
                <dd className="mt-1 text-lg font-semibold">{today?.checkOutTime ?? "--:--"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground flex items-center justify-center gap-1 text-xs">
                  <Timer className="h-3 w-3" /> ຊົ່ວໂມງ
                </dt>
                <dd className="mt-1 text-lg font-semibold">
                  {today?.workHours != null ? today.workHours : "--"}
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Button
          size="lg"
          className="h-16 text-lg"
          onClick={() => handlePunch("checkIn")}
          disabled={isLoading || busy || !!today?.checkInTime}
        >
          {submitting === "checkIn" ? (
            <Spinner className="mr-2" />
          ) : (
            <LogIn className="mr-2 h-5 w-5" />
          )}
          Check In OT
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-16 text-lg"
          onClick={() => handlePunch("checkOut")}
          disabled={isLoading || busy || !today?.checkInTime || !!today?.checkOutTime}
        >
          {submitting === "checkOut" ? (
            <Spinner className="mr-2" />
          ) : (
            <LogOut className="mr-2 h-5 w-5" />
          )}
          Check Out OT
        </Button>
      </div>
      <p className="text-muted-foreground text-center text-xs">
        ທຸກຄັ້ງຕ້ອງຖ່າຍຮູບ ແລະ ເປີດ GPS · ເຂົ້າຫຼັງ {otRequest.startTime ?? "ເວລາເລີ່ມ"} ນັບເປັນມາສາຍ
      </p>

      <CameraCapture
        open={cameraOpen}
        onOpenChange={(open) => {
          setCameraOpen(open);
          if (!open) {
            resolveRef.current?.(null);
            resolveRef.current = null;
          }
        }}
        onCapture={(file) => {
          resolveRef.current?.(file);
          resolveRef.current = null;
        }}
        title={cameraType === "checkIn" ? "ຖ່າຍຮູບເຂົ້າ OT" : "ຖ່າຍຮູບອອກ OT"}
      />
    </div>
  );
}
