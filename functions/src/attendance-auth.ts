import { HttpsError } from "firebase-functions/v2/https";

// ກົດ: Firebase Auth uid ຕ້ອງເທົ່າກັບ doc id ຂອງ employees/{uid}, ແລະ attendance ຕ້ອງມີ
// uid = userUuid = doc id ພະນັກງານ. ກ່ອນໜ້ານີ້ server ກວດແຕ່ data.uid (optional) ແລ້ວຂຽນ
// `uid: data.uid ?? data.userUuid` — ບັນຊີ Auth ທີ່ uid ຜິດ (email ດຽວກັບພະນັກງານ) ສົ່ງ
// uid = auth uid ແຕ່ userUuid = doc id ພະນັກງານ ຈຶ່ງຜ່ານ ແລະ ຂຽນ attendance ທີ່ uid ≠ userUuid
// (ລາຍງານເດືອນຂອງ HRM ຂ້າມ doc ເຫຼົ່ານັ້ນ). ຕອນນີ້ບັງຄັບ userUuid === auth uid ແລະ ຂຽນ uid ຈາກ userUuid.
// ແຍກອອກຈາກ index.ts ເພື່ອໃຫ້ test import ໄດ້ໂດຍບໍ່ initializeApp/web-push
export function assertCallerOwnsAttendance(
  authUid: string,
  userUuid: unknown,
  action: "check in" | "check out",
): string {
  if (typeof userUuid !== "string" || !userUuid) {
    throw new HttpsError("invalid-argument", "userUuid is required");
  }
  if (userUuid !== authUid) {
    throw new HttpsError("permission-denied", `Cannot ${action} as another user`);
  }
  return userUuid;
}
