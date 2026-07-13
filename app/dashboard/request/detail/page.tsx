"use client";

// ** core
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// ** assets / icons
import {
  ArrowLeft,
  MapPin,
  CalendarDays,
  Users,
  Banknote,
  FileText,
  User,
  ClipboardList,
  Wrench,
  BookMarked,
} from "lucide-react";

// ** shared components
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/offsite/StatusBadge";
import { ActivityTypeBadge } from "@/components/offsite/ActivityTypeBadge";

// ** third party
import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";

// ** config / utils / types / hooks
import { db } from "@/lib/firebase";
import { formatDateRange, formatKip } from "@/lib/format";
import type { OffsiteRequestDoc } from "@/types/workOutside";

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex w-28 shrink-0 items-start gap-1.5">
        <Icon className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span className="text-muted-foreground text-xs">{label}</span>
      </div>
      <span className="flex-1 text-sm">{children}</span>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 pb-8">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function OffsiteRequestDetailPage() {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get("id"));
  }, []);

  const {
    data: record,
    isLoading,
    error,
  } = useQuery<OffsiteRequestDoc | null>({
    queryKey: ["workOutside-detail", id],
    queryFn: async () => {
      if (!id) return null;
      const snap = await getDoc(doc(db, "workOutside", id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as OffsiteRequestDoc;
    },
    enabled: !!id,
  });

  function goBack() {
    router.push("/dashboard/request?tab=offsite");
  }

  if (id === null || isLoading) return <DetailSkeleton />;

  if (error || !record) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <p className="text-muted-foreground text-sm">ບໍ່ພົບຂໍ້ມູນຄຳຂໍນີ້</p>
        <Button variant="outline" size="sm" onClick={goBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          ກັບຄືນ
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={goBack}
        className="-ml-2 gap-1.5"
      >
        <ArrowLeft className="h-4 w-4" />
        ກັບຄືນ
      </Button>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-primary font-mono text-sm font-semibold">
            {record.requestNo}
          </span>
          <StatusBadge status={record.status} />
        </div>
        <h1 className="text-foreground mt-1 text-lg font-semibold">
          {record.subject}
        </h1>
        {record.customerName && (
          <p className="text-muted-foreground text-sm">{record.customerName}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ActivityTypeBadge code={record.activityType.code} />
        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
          {record.durationDays} ມື້
        </span>
      </div>

      <Separator />

      <div className="space-y-3">
        <InfoRow icon={CalendarDays} label="ວັນທີ">
          {formatDateRange(record.startDate, record.endDate)}
        </InfoRow>
        <InfoRow icon={MapPin} label="ສະຖານທີ່">
          {record.location || "—"}
        </InfoRow>
        <InfoRow icon={User} label="ຜູ້ສະເໜີ">
          {record.requester.fullNameLo || record.requester.fullNameEn}
        </InfoRow>
        {record.details && (
          <InfoRow icon={FileText} label="ລາຍລະອຽດ">
            {record.details}
          </InfoRow>
        )}
        {record.objective && (
          <InfoRow icon={ClipboardList} label="ຈຸດປະສົງ">
            {record.objective}
          </InfoRow>
        )}
        <InfoRow icon={Banknote} label="ຄ່າໃຊ້ຈ່າຍ">
          {formatKip(record.estimatedCost)}
        </InfoRow>
        {record.equipmentUsed && (
          <InfoRow icon={Wrench} label="ອຸປະກອນ">
            {record.equipmentUsed}
          </InfoRow>
        )}
      </div>

      {record.references?.length > 0 && (
        <>
          <Separator />
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <BookMarked className="text-muted-foreground h-3.5 w-3.5" />
              <span className="text-muted-foreground text-xs font-medium">
                ອ້າງອີງ
              </span>
            </div>
            <ul className="space-y-1 text-sm list-disc pl-4">
              {record.references.map((ref, i) => (
                <li key={i}>{ref}</li>
              ))}
            </ul>
          </div>
        </>
      )}

      {record.scheduleDetails?.length > 0 && (
        <>
          <Separator />
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
              <span className="text-muted-foreground text-xs font-medium">
                ຕາຕະລາງກຳນົດການ
              </span>
            </div>
            <div className="space-y-3">
              {record.scheduleDetails.map((day, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <p className="text-sm font-semibold">{day.date}</p>
                  <div className="mt-2 space-y-2">
                    {day.timeline.map((entry, j) => (
                      <div key={j} className="flex gap-3 text-sm">
                        <span className="text-muted-foreground w-28 shrink-0">
                          {entry.time}
                        </span>
                        <span className="flex-1">{entry.details}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {record.teammate.length > 0 && (
        <>
          <Separator />
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <Users className="text-muted-foreground h-3.5 w-3.5" />
              <span className="text-muted-foreground text-xs font-medium">
                ທີມງານ ({record.participantCount} ຄົນ)
              </span>
            </div>
            <div className="space-y-1.5">
              {record.teammate.map((t) => (
                <div
                  key={t.uid}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{t.fullNameLo || t.fullNameEn}</span>
                  <span className="text-muted-foreground text-xs">
                    {t.position}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {record.status === "rejected" && record.rejectReason && (
        <>
          <Separator />
          <div className="bg-destructive/5 border-destructive/20 rounded-lg border p-3">
            <p className="text-destructive mb-1 text-xs font-medium">
              ເຫດຜົນປະຕິເສດ
            </p>
            <p className="text-sm">{record.rejectReason}</p>
          </div>
        </>
      )}
    </div>
  );
}
