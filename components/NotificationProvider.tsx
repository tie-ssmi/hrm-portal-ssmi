"use client";

// ** core
import { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from "react";

// ** third party
import { collection, doc, query, updateDoc, where, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";

// ** config / utils / types / hooks
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

interface NotificationItem {
  id: string;
  type: "leave" | "workOutside";
  title: string;
  userName: string;
  detail: string;
}

const NotificationContext = createContext<{
  notifications: NotificationItem[];
}>({ notifications: [] });

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [leaveNotifications, setLeaveNotifications] = useState<NotificationItem[]>([]);
  const [workNotifications, setWorkNotifications] = useState<NotificationItem[]>([]);

  const { user } = useAuth();

  const isInitialLeaves = useRef(true);
  const isInitialWork = useRef(true);

  // Fix: useCallback — stable reference so onSnapshot closure always has latest version
  const triggerNotification = useCallback((title: string, body: string) => {
    toast.success(title, { description: body, duration: 5000 });
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/apple-icon.png" });
    }
  }, []);

  const userUid = user?.uid || user?.id;

  useEffect(() => {
    if (!userUid) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    const uid = userUid;
    const key = vapidKey;

    async function registerPush() {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const reg = await navigator.serviceWorker.ready;
        let subscription = await reg.pushManager.getSubscription();

        if (!subscription) {
          subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(key),
          });
        }

        const serialized = JSON.parse(JSON.stringify(subscription));

        const empRef = doc(db, "employees", uid);
        const { getDoc } = await import("firebase/firestore");
        const empSnap = await getDoc(empRef);
        if (!empSnap.exists()) return;

        const stored = empSnap.data()?.pushSubscription;
        if (stored?.endpoint === serialized.endpoint) return;

        await updateDoc(empRef, { pushSubscription: serialized });
      } catch (err) {
        console.error("[Push] subscription failed:", err);
      }
    }

    registerPush();
  }, [userUid]);

  // Fix: add .uid — codebase uses .uid as the primary key field (was missing, caused undefined → notifications never matched)
  const userDepartmentId = useMemo(() => {
    if (!user?.department) return undefined;
    const dept = user.department as any;
    return typeof dept === "string" ? dept : dept.uid || dept.uuid || dept.id;
  }, [user?.department]);

  const userWorkLocationId = useMemo(() => {
    if (!user?.workLocation) return undefined;
    const loc = user.workLocation as any;
    return typeof loc === "string" ? loc : loc.uid || loc.uuid || loc.id;
  }, [user?.workLocation]);

  const canApprove = !!user?.rolePermissions?.approveDepartment || !!user?.rolePermissions?.approveBranch;

  useEffect(() => {
    if (!userUid || !userDepartmentId || !userWorkLocationId || !canApprove) {
      setLeaveNotifications([]);
      setWorkNotifications([]);
      isInitialLeaves.current = true;
      isInitialWork.current = true;
      return;
    }

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // =========================================================================
    // 🚨 1. ດັກຟັງໃບລາພັກ (leaves)
    // =========================================================================

    // Fix: filter at Firestore level — avoids downloading all company-wide pending leaves
    // was: where("status","==","pending") only → downloaded entire collection, filtered in JS
    // now: also scoped by workLocationUid + departmentUid → only relevant dept/location
    // Requires composite index: (status, workLocationUid, departmentUid)
    const qLeaves = query(
      collection(db, "leaves"),
      where("status", "==", "pending"),
      where("workLocationUid", "==", userWorkLocationId),
      where("departmentUid", "==", userDepartmentId),
    );

    // Fix: single matcher used by both the state-build loop and the toast-trigger loop
    function isMatchingLeave(data: Record<string, any>): boolean {
      return (
        data.leaveUserUuid !== userUid &&
        Array.isArray(data.approvals) &&
        data.approvals.some(
          (app: any) => app?.role === "departmentHead" && app?.decision === "pending"
        )
      );
    }

    const unsubscribeLeaves = onSnapshot(qLeaves, (snapshot) => {
      const leaveItems: NotificationItem[] = snapshot.docs
        .filter((doc) => isMatchingLeave(doc.data()))
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            type: "leave" as const,
            title: "ໃບລາພັກໃໝ່",
            userName: data.leaveUserName || "ບໍ່ມີຊື່",
            detail: data.reason || "ບໍ່ລະບຸເຫດຜົນ",
          };
        });

      if (!isInitialLeaves.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added" && isMatchingLeave(change.doc.data())) {
            const data = change.doc.data();
            triggerNotification(
              "🔔 ມີໃບລາພັກໃໝ່!",
              `ພະນັກງານ: ${data.leaveUserName || "ບໍ່ມີຊື່"} ສົ່ງຄຳຂໍລາພັກ`
            );
          }
        });
      } else {
        isInitialLeaves.current = false;
      }

      setLeaveNotifications(leaveItems);
    });

    // =========================================================================
    // 🚗 2. ດັກຟັງໃບຂໍອອກນອກສະຖານທີ່ (workOutside)
    // =========================================================================
    // docs ໃໝ່ມີ departmentUid top-level ແລ້ວ — filter ຢູ່ Firestore level
    // docs ເກົ່າທີ່ບໍ່ມີ field ນີ້ຈະບໍ່ match query (ຍອมຮັບໄດ້ ເພາະ docs ເກົ່າບໍ່ແມ່ນ pending ແລ້ວ)
    const qWork = query(
      collection(db, "workOutside"),
      where("status", "==", "pending"),
      where("departmentUid", "==", userDepartmentId),
    );

    function isMatchingWork(data: Record<string, any>): boolean {
      const workLocationId =
        data.requesterWorkLocationUid ||
        data.requester?.workLocation?.uid ||
        data.requester?.workLocation?.uuid ||
        data.requester?.workLocation?.id;

      return (
        workLocationId === userWorkLocationId &&
        data.createdByUid !== userUid &&
        Array.isArray(data.approvals) &&
        data.approvals.some(
          (app: any) => app?.role === "departmentHead" && app?.decision === "pending"
        )
      );
    }

    const unsubscribeWork = onSnapshot(qWork, (snapshot) => {
      const workItems: NotificationItem[] = snapshot.docs
        .filter((doc) => isMatchingWork(doc.data()))
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            type: "workOutside" as const,
            title: "ຂໍອອກນອກສະຖານທີ່",
            userName: data.createdBy || "ບໍ່ມີຊື່",
            detail: `${data.activityType?.name || ""} ໄປທີ່: ${data.location || "ບໍ່ລະບຸ"}`,
          };
        });

      if (!isInitialWork.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added" && isMatchingWork(change.doc.data())) {
            const data = change.doc.data();
            triggerNotification(
              "🚗 ມີຄຳຂໍອອກນອກສະຖານທີ່ໃໝ່!",
              `ພະນັກງານ: ${data.createdBy || "ບໍ່ມີຊື່"} ຂໍອອກໄປ: ${data.location || "ບໍ່ລະບຸ"}`
            );
          }
        });
      } else {
        isInitialWork.current = false;
      }

      setWorkNotifications(workItems);
    });

    return () => {
      unsubscribeLeaves();
      unsubscribeWork();
    };
  }, [userUid, userDepartmentId, userWorkLocationId, canApprove, triggerNotification]);

  const notifications = useMemo(
    () => [...leaveNotifications, ...workNotifications],
    [leaveNotifications, workNotifications]
  );

  return (
    <NotificationContext.Provider value={{ notifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
