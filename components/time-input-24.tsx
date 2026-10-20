"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i));
// ລາຍການລະ 32px (py-1.5 + text-sm) × 10 + padding 8px — ເຫັນ 10 ລາຍການ ແລ້ວເລື່ອນ
const LIST_MAX_HEIGHT = 32 * 10 + 8;

// <input type="time"> ສະແດງ AM/PM ຕາມ locale ຂອງເຄື່ອງ ແລະ ບັງຄັບບໍ່ໄດ້ —
// ໃຊ້ select ຊົ່ວໂມງ/ນາທີ ແທນ ເພື່ອໃຫ້ເປັນແບບ 24 ຊົ່ວໂມງສະເໝີ. ຄ່າເປັນ "HH:mm" ຫຼື "".
export function TimeInput24({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [hour = "", minute = ""] = value ? value.split(":") : [];

  return (
    <div className="flex items-center gap-1">
      <Select
        value={hour}
        onValueChange={(h) => onChange(`${h}:${minute || "00"}`)}
        disabled={disabled}
      >
        <SelectTrigger className="w-20">
          <SelectValue placeholder="ຊມ" />
        </SelectTrigger>
        <SelectContent style={{ maxHeight: LIST_MAX_HEIGHT }}>
          {HOURS.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="font-semibold">:</span>
      <Select
        value={minute}
        onValueChange={(m) => onChange(`${hour || "00"}:${m}`)}
        disabled={disabled}
      >
        <SelectTrigger className="w-20">
          <SelectValue placeholder="ນທ" />
        </SelectTrigger>
        <SelectContent style={{ maxHeight: LIST_MAX_HEIGHT }}>
          {MINUTES.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
