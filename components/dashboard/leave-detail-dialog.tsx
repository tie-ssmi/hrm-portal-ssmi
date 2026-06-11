"use client";

import { CheckCircle, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export type LeaveRecord = {
  id: string;
  status: string;
  policyName?: string | null;
  type?: string | null;
  startDate: string;
  endDate: string;
  startPeriod?: string | null;
  endPeriod?: string | null;
  duration?: number;
  createdAt?: string | null;
  reason?: string | null;
  species?: string | null;
  createdBy?: string | null;
  approvals?: ({ role: string; decision: string } | null | undefined)[] | null;
};

type Props = {
  selectedLeave: LeaveRecord | null;
  onClose: () => void;
};

function getStatusIcon(status: string) {
  switch (status) {
    case "approved":
      return <CheckCircle className="w-3 h-3" />;
    case "rejected":
      return <XCircle className="w-3 h-3" />;
    default:
      return <Clock className="w-3 h-3" />;
  }
}

function getStatusVariant(status: string) {
  switch (status) {
    case "approved":
      return "default" as const;
    case "rejected":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function formatDuration(d: number): string {
  return d === 0.5 ? "0.5 ວັນ" : d === 1 ? "1 ວັນ" : `${d} ວັນ`;
}

export default function LeaveDetailDialog({ selectedLeave, onClose }: Props) {
  return (
    <Dialog
      open={!!selectedLeave}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {selectedLeave?.policyName || selectedLeave?.type}
          </DialogTitle>
        </DialogHeader>
        {selectedLeave && (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">ສະຖານະ</span>
              <Badge
                variant={getStatusVariant(selectedLeave.status)}
                className="flex items-center gap-1"
              >
                {getStatusIcon(selectedLeave.status)}
                {selectedLeave.status}
              </Badge>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">ວັນເລີ່ມຕົ້ນ</p>
                <p className="font-medium">
                  {format(new Date(selectedLeave.startDate), "dd MMM yyyy")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedLeave.startPeriod === "morning"
                    ? "ຕອນເຊົ້າ"
                    : "ຕອນບ່າຍ"}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">ວັນສິ້ນສຸດ</p>
                <p className="font-medium">
                  {format(new Date(selectedLeave.endDate), "dd MMM yyyy")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedLeave.endPeriod === "morning"
                    ? "ຕອນເຊົ້າ"
                    : "ຕອນບ່າຍ"}
                </p>
              </div>
            </div>
            {selectedLeave.duration !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">ຈຳນວນ</span>
                <Badge variant="secondary">
                  {formatDuration(selectedLeave.duration)}
                </Badge>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">ວັນທີຍື່ນ</span>
              <span>{selectedLeave.createdAt}</span>
            </div>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground mb-1">ເຫດຜົນ</p>
              <p>{selectedLeave.reason}</p>
              {selectedLeave.species === "instead" && (
                <p className="mt-2 text-sm text-muted-foreground">
                  ແທນດ້ວຍ: {selectedLeave.createdBy}
                </p>
              )}
            </div>
            {selectedLeave.approvals && selectedLeave.approvals.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    ການອານຸມັດ
                  </p>
                  <div className="space-y-1.5">
                    {selectedLeave.approvals
                      .filter(Boolean)
                      .map((approval, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between"
                        >
                          <span className="text-xs capitalize">
                            {approval!.role}
                          </span>
                          <Badge
                            variant={getStatusVariant(approval!.decision)}
                            className="flex items-center gap-1 text-xs"
                          >
                            {getStatusIcon(approval!.decision)}
                            {approval!.decision}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
