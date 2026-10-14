// OT (ເຮັດວຽກວັນພັກ) check-in rules. Pure — no Firestore, no initializeApp —
// so attendance-ot.test.ts can import it. recordOTCheckIn / recordOTCheckOut in
// index.ts do the I/O. Client mirror: lib/attendance-ot.ts (keep in step).

export type OTRequestLike = {
  id: string;
  formType?: string;
  status?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  requestNo?: string;
  subject?: string;
  location?: string;
  teammate?: ({ uid?: string } | null)[];
};

// The approved OT request that covers `isoDate` and lists `uid` as a teammate.
// Only teammates count — being the requester alone is not enough (the form
// lets the requester add themselves, which is how they get OT too). With
// several matches the earliest-starting one wins, so a day has one OT punch.
export function pickTodayOTRequest<T extends OTRequestLike>(
  requests: T[],
  uid: string,
  isoDate: string,
): T | null {
  const matches = requests.filter(
    (r) =>
      r.formType === "overtime" &&
      r.status === "approved" &&
      !!r.startDate &&
      r.startDate <= isoDate &&
      isoDate <= (r.endDate || r.startDate) &&
      (r.teammate ?? []).some((t) => t?.uid === uid),
  );
  matches.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
  return matches[0] ?? null;
}

// present when checked in at or before the request's start time, late after.
// "HH:mm" strings compare correctly as text. No start time → present.
export function computeOTCheckInStatus(
  checkTime: string,
  startTime: string | undefined,
): "present" | "late" {
  if (!startTime) return "present";
  return checkTime <= startTime ? "present" : "late";
}

// Hours between two "HH:mm" times, 1 decimal — same rounding as recordCheckOut.
export function calcWorkHours(checkInTime: string, checkOutTime: string): number {
  const [inH, inM] = checkInTime.split(":").map(Number);
  const [outH, outM] = checkOutTime.split(":").map(Number);
  const diff = outH * 60 + outM - (inH * 60 + inM);
  return diff > 0 ? Math.round((diff / 60) * 10) / 10 : 0;
}
