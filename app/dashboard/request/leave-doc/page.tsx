"use client";

import { useState } from "react";
import { FileText, Upload, X, Calendar, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  usePendingDocLeaves,
  useAttachLeaveDocument,
} from "@/lib/use-leave-queries";
import { cn } from "@/lib/utils";
import type { LeaveRequest } from "@/lib/types";
import { uploadLeaveDocument } from "@/services/leaves";

const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);

const statusLabel: Record<string, string> = {
  pending: "ລໍຖ້າອະນຸມັດ",
  approved: "ອະນຸມັດແລ້ວ",
};

function PendingDocCard({
  leave,
  userUuid,
}: {
  leave: LeaveRequest;
  userUuid: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const attachDocument = useAttachLeaveDocument();

  const isUploading = uploadProgress !== null;

  const handleSubmit = async () => {
    if (!file) {
      toast.error("ກະລຸນາເລືອກໄຟລ໌ເອກະສານ");
      return;
    }
    try {
      setUploadProgress(0);
      const docLink = await uploadLeaveDocument(
        file,
        userUuid,
        setUploadProgress,
      );
      await attachDocument.mutateAsync({
        leaveId: leave.id,
        docLink,
        userUuid,
      });
      toast.success("ສົ່ງເອກະສານສຳເລັດ");
      setFile(null);
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : "ສົ່ງເອກະສານລົ້ມເຫລວ ກະລຸນາລອງໃໝ່";
      toast.error(msg);
    } finally {
      setUploadProgress(null);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-foreground truncate text-sm font-semibold">
              {leave.policyName || leave.type}
            </p>
            <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
              <Calendar className="h-3 w-3 shrink-0" />
              <span>
                {leave.startDate} – {leave.endDate}
              </span>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0 text-xs">
            {statusLabel[leave.status] ?? leave.status}
          </Badge>
        </div>

        {leave.reason && (
          <p className="text-muted-foreground line-clamp-2 text-xs">
            {leave.reason}
          </p>
        )}

        <div className="space-y-2">
          <label
            className={cn(
              "active:bg-primary/10 relative flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 transition-colors",
              file
                ? "border-primary bg-primary/5"
                : "border-input hover:bg-muted",
            )}
          >
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-[0.01]"
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null;
                if (selected && !ALLOWED_MIME.has(selected.type)) {
                  toast.error("ອະນຸຍາດສະເພາະ PDF, JPG, PNG ເທົ່ານັ້ນ");
                  e.target.value = "";
                  return;
                }
                if (selected && selected.size > 10 * 1024 * 1024) {
                  toast.error("ໄຟລ໌ໃຫຍ່ເກີນ 10MB ກະລຸນາເລືອກໄຟລ໌ໃໝ່");
                  e.target.value = "";
                  return;
                }
                setFile(selected);
              }}
            />
            <Upload className="text-muted-foreground pointer-events-none h-5 w-5" />
            {file ? (
              <div className="pointer-events-none text-center">
                <p className="text-primary max-w-[14rem] truncate text-sm font-medium">
                  {file.name}
                </p>
                <p className="text-muted-foreground text-xs">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div className="pointer-events-none text-center">
                <p className="text-muted-foreground text-sm">
                  ກົດເພື່ອເລືອກໄຟລ໌ເອກະສານ
                </p>
                <p className="text-muted-foreground text-xs">
                  PDF, JPG, PNG (ສູງສຸດ 10MB)
                </p>
              </div>
            )}
          </label>
          {file && (
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-destructive flex items-center gap-1 text-xs hover:underline"
            >
              <X className="h-3 w-3" /> ລຶບໄຟລ໌
            </button>
          )}
        </div>

        {isUploading && (
          <div className="space-y-1">
            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-muted-foreground text-right text-xs">
              {uploadProgress}%
            </p>
          </div>
        )}

        <Button
          type="button"
          className="w-full"
          size="sm"
          disabled={!file || attachDocument.isPending || isUploading}
          onClick={handleSubmit}
        >
          {isUploading ? (
            <Spinner className="mr-2" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {isUploading ? `ກຳລັງສົ່ງ... ${uploadProgress}%` : "ສົ່ງເອກະສານ"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function LeaveDocPage() {
  const { user } = useAuth();
  const userUuid = user?.uuid || user?.uid || "";
  const { data: leaves = [], isLoading } = usePendingDocLeaves(userUuid);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold">ສົ່ງເອກະສານລາພັກ</h1>
        <p className="text-muted-foreground text-sm">
          ລາຍການລາພັກທີ່ທ່ານເລືອກສົ່ງເອກະສານພາຍຫຼັງ
        </p>
      </div>

      {!userUuid || isLoading ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
          <Spinner /> ກຳລັງໂຫຼດ...
        </div>
      ) : leaves.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <FileText className="text-muted-foreground/50 h-8 w-8" />
            <p className="text-foreground text-sm font-medium">
              ບໍ່ມີລາຍການທີ່ຕ້ອງສົ່ງເອກະສານ
            </p>
            <p className="text-muted-foreground text-xs">
              ລາຍການລາພັກທີ່ທ່ານເລືອກ &ldquo;ສົ່ງເອກະສານພາຍຫຼັງ&rdquo;
              ຈະສະແດງຢູ່ບ່ອນນີ້
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {leaves.map((leave) => (
            <PendingDocCard key={leave.id} leave={leave} userUuid={userUuid} />
          ))}
        </div>
      )}
    </div>
  );
}
