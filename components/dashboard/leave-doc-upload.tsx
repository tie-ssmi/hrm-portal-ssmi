"use client";

import { useRef } from "react";
import { CheckCircle, Upload, Timer, X } from "lucide-react";
import { cn } from "@/lib/utils";

type DocUploadChoice = "now" | "later" | "skip" | null;

type Props = {
  documentRequired: "yes" | "option";
  docUploadChoice: DocUploadChoice;
  onChoiceChange: (choice: DocUploadChoice) => void;
  docFile: File | null;
  onFileChange: (file: File | null) => void;
};

function SectionHeader({
  number,
  icon: Icon,
  title,
}: {
  number: number;
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
        {number}
      </div>
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm font-semibold">{title}</span>
    </div>
  );
}

export default function LeaveDocUpload({
  documentRequired,
  docUploadChoice,
  onChoiceChange,
  docFile,
  onFileChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <SectionHeader
        number={4}
        icon={Upload}
        title={
          documentRequired === "yes"
            ? "ເອກະສານປະກອບ (ຕ້ອງການ)"
            : "ເອກະສານປະກອບ (ທາງເລືອກ)"
        }
      />

      {documentRequired === "yes" && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          ປະເພດການລານີ້ຕ້ອງການເອກະສານ — ກະລຸນາເລືອກ
        </p>
      )}

      <div className="grid grid-cols-1 gap-2">
        {/* Upload now */}
        <button
          type="button"
          onClick={() => onChoiceChange("now")}
          className={cn(
            "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm text-left transition-colors",
            docUploadChoice === "now"
              ? "border-primary bg-primary/5 text-primary"
              : "border-input hover:bg-muted",
          )}
        >
          <Upload className="w-4 h-4 shrink-0" />
          <div>
            <p className="font-medium">ອັບໂຫຼດຕອນນີ້</p>
            <p className="text-xs text-muted-foreground">ເລືອກໄຟລ໌ແນບທັນທີ</p>
          </div>
          {docUploadChoice === "now" && (
            <CheckCircle className="w-4 h-4 ml-auto shrink-0" />
          )}
        </button>

        {/* Upload later */}
        <button
          type="button"
          onClick={() => {
            onChoiceChange("later");
            onFileChange(null);
          }}
          className={cn(
            "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm text-left transition-colors",
            docUploadChoice === "later"
              ? "border-primary bg-primary/5 text-primary"
              : "border-input hover:bg-muted",
          )}
        >
          <Timer className="w-4 h-4 shrink-0" />
          <div>
            <p className="font-medium">ອັບໂຫຼດພາຍຫຼັງ</p>
            <p className="text-xs text-muted-foreground">
              ສົ່ງຄໍາຮ້ອງກ່ອນ ແລ້ວຄ່ອຍແນບໃຫ້ທີ່ຫຼັງ
            </p>
          </div>
          {docUploadChoice === "later" && (
            <CheckCircle className="w-4 h-4 ml-auto shrink-0" />
          )}
        </button>

        {/* Skip — only for optional */}
        {documentRequired === "option" && (
          <button
            type="button"
            onClick={() => {
              onChoiceChange("skip");
              onFileChange(null);
            }}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm text-left transition-colors",
              docUploadChoice === "skip"
                ? "border-primary bg-primary/5 text-primary"
                : "border-input hover:bg-muted",
            )}
          >
            <X className="w-4 h-4 shrink-0" />
            <div>
              <p className="font-medium">ບໍ່ຕ້ອງການເອກະສານ</p>
              <p className="text-xs text-muted-foreground">
                ດໍາເນີນການໂດຍບໍ່ຕ້ອງແນບໄຟລ໌
              </p>
            </div>
            {docUploadChoice === "skip" && (
              <CheckCircle className="w-4 h-4 ml-auto shrink-0" />
            )}
          </button>
        )}
      </div>

      {/* File picker — shown when 'now' selected */}
      {docUploadChoice === "now" && (
        <div className="space-y-2">
          <label
            htmlFor="doc-file-input"
            className="block"
            onClick={() => fileInputRef.current?.click()}
          >
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer transition-colors active:bg-primary/10",
                docFile
                  ? "border-primary bg-primary/5"
                  : "border-input hover:bg-muted",
              )}
            >
              <Upload className="w-6 h-6 text-muted-foreground" />
              {docFile ? (
                <div className="text-center">
                  <p className="text-sm font-medium text-primary">
                    {docFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(docFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    ກົດເພື່ອເລືອກໄຟລ໌
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF, JPG, PNG (ສູງສຸດ 10MB)
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                id="doc-file-input"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </label>
          {docFile && (
            <button
              type="button"
              onClick={() => onFileChange(null)}
              className="flex items-center gap-1 text-xs text-destructive hover:underline"
            >
              <X className="w-3 h-3" /> ລຶບໄຟລ໌
            </button>
          )}
        </div>
      )}
    </div>
  );
}
