import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  DEFAULT_ATTENDANCE_TIMES,
  parseAttendanceTimes,
  type AttendanceTimes,
} from '@/lib/special-policy'

// adminSettings/attendanceTimes — ເວລາ check in / out ຕັ້ງຈາກ admin. server (recordCheckIn /
// recordCheckOut) ອ່ານເອງ ແລະ ຕັດສິນຈິງ; ຢູ່ນີ້ໃຊ້ສະແດງຜົນ / dialog ອອກກ່ອນເວລາ / ຈັດອັນດັບມາຊ້າ.
// ອ່ານບໍ່ໄດ້ → ເວລາເດີມ (default)
export async function fetchAttendanceTimes(): Promise<AttendanceTimes> {
  try {
    const snap = await getDoc(doc(db, 'adminSettings', 'attendanceTimes'))
    return parseAttendanceTimes(snap.data())
  } catch (error) {
    console.error('Error fetching adminSettings/attendanceTimes:', error)
    return DEFAULT_ATTENDANCE_TIMES
  }
}

// adminSettings/employeeSelfEdit — written by the admin repo (firestore.rules
// restricts writes on this doc to isIT()), read here to decide whether the
// portal offers the self-service profile editor at all.
//
// Missing doc ⇒ enabled. The setting was introduced after the editor shipped,
// so treating "absent" as "off" would silently disable editing for every
// project that never created it. A read failure defaults the same way, so a
// transient Firestore error never locks people out of their own profile.
export async function fetchEmployeeSelfEditEnabled(): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'adminSettings', 'employeeSelfEdit'))
    if (!snap.exists()) return true
    return snap.data().enabled !== false
  } catch (error) {
    console.error('Error fetching adminSettings/employeeSelfEdit:', error)
    return true
  }
}
