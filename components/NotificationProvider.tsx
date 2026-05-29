"use client";

import { createContext, useContext, useEffect, useState, useRef, useMemo } from "react";
import { db } from "@/lib/firebase"; 
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context"; 
import { toast } from "sonner";

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

  const triggerNotification = (title: string, body: string) => {
    toast.success(title, { description: body, duration: 5000 });
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body: body, icon: "/apple-icon.png" });
    }
  };

  const userUid = user?.uid || user?.id;
  
  const userDepartmentId = useMemo(() => {
    if (!user?.department) return undefined;
    return typeof user.department === 'string' ? user.department : (user.department as any).uuid || (user.department as any).id;
  }, [user?.department]);

  const userWorkLocationId = useMemo(() => {
    if (!user?.workLocation) return undefined;
    return typeof user.workLocation === 'string' ? user.workLocation : (user.workLocation as any).uuid || (user.workLocation as any).id;
  }, [user?.workLocation]);

  useEffect(() => {
    if (!userUid || !userDepartmentId || !userWorkLocationId) {
      setLeaveNotifications([]);
      setWorkNotifications([]);
      isInitialLeaves.current = true;
      isInitialWork.current = true;
      return;
    }

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    console.log("🚀 [Firebase Snapshot]: ເລີ່ມຕັ້ງຄ່າດັກຟັງ Real-time...");

    // =========================================================================
    // 🚨 1. ດັກຟັງໃບລາພັກ (leaves)
    // =========================================================================
    const qLeaves = query(collection(db, "leaves"), where("status", "==", "pending"));
    const unsubscribeLeaves = onSnapshot(qLeaves, (snapshot) => {
      const leaveItems: NotificationItem[] = [];

      snapshot.docs.forEach((doc) => {
        const data = doc.data();

        const matchLocation = data.workLocationUid === userWorkLocationId;
        const matchDepartment = data.departmentUid === userDepartmentId;
        const isNotSelf = data.leaveUserUuid !== userUid;
        
        // 🔒 FIX: ໃຊ້ app?.role ເພື່ອປ້ອງກັນ null pointer error
        const hasPendingDeptHeadApproval = Array.isArray(data.approvals) && data.approvals.some(
          (app: any) => app?.role === "departmentHead" && app?.decision === "pending"
        );

        if (matchLocation && matchDepartment && isNotSelf && hasPendingDeptHeadApproval) {
          leaveItems.push({
            id: doc.id,
            type: "leave",
            title: "ໃບລາພັກໃໝ່",
            userName: data.leaveUserName || "ບໍ່ມີຊື່",
            detail: data.reason || "ບໍ່ລະບຸເຫດຜົນ"
          });
        }
      });

      if (!isInitialLeaves.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            const hasPendingDeptHeadApproval = Array.isArray(data.approvals) && data.approvals.some(
              (app: any) => app?.role === "departmentHead" && app?.decision === "pending"
            );

            if (
              data.workLocationUid === userWorkLocationId &&
              data.departmentUid === userDepartmentId &&
              data.leaveUserUuid !== userUid &&
              hasPendingDeptHeadApproval
            ) {
              triggerNotification("🔔 ມີໃບລາພັກໃໝ່!", `ພະນັກງານ: ${data.leaveUserName || "ບໍ່ມີຊື່"} ສົ່ງຄຳຂໍລາພັກ`);
            }
          }
        });
      } else {
        isInitialLeaves.current = false;
      }

      setLeaveNotifications(leaveItems);
    });
// =========================================================================
    // 🚗 2. ດັກຟັງໃບຂໍອອກນອກສະຖານທີ່ (workOutside) - ເວີຊັນແກ້ໄຂຕາມ JSON ຈິງ
    // =========================================================================
    const qWork = query(collection(db, "workOutside"), where("status", "==", "pending"));
    const unsubscribeWork = onSnapshot(qWork, (snapshot) => {
      const workItems: NotificationItem[] = [];

      snapshot.docs.forEach((doc) => {
        const data = doc.data();

        // 🌟 FIX: ດຶງ ID ໂລເຄຊັນຈາກ requester.workLocation ໂດຍກົງ (ເພາະ workLocationUid ດ້ານນອກເກັບເປັນ "0303")
        const workLocationId = data.requester?.workLocation?.uuid || 
                             data.requester?.workLocation?.id || 
                             data.workLocationUid;
        
        // 🌟 FIX: ດຶງ ID ແຜນກຈາກ requester.department
        const deptId = data.requester?.department?.uuid || 
                       data.requester?.department?.id || 
                       data.departmentUid;

        const matchLocation = workLocationId === userWorkLocationId;
        const matchDepartment = deptId === userDepartmentId;
        const isNotSelf = data.createdByUid !== userUid;
        
        const hasPendingDeptHeadApproval = Array.isArray(data.approvals) && data.approvals.some(
          (app: any) => app?.role === "departmentHead" && app?.decision === "pending"
        );

        if (matchLocation && matchDepartment && isNotSelf && hasPendingDeptHeadApproval) {
          workItems.push({
            id: doc.id,
            type: "workOutside",
            title: "ຂໍອອກນອກສະຖານທີ່",
            userName: data.createdBy || "ບໍ່ມີຊື່",
            detail: `${data.activityType?.name || ""} ໄປທີ່: ${data.location || "ບໍ່ລະບຸ"}`
          });
        }
      });

      if (!isInitialWork.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            
            const workLocationId = data.requester?.workLocation?.uuid || 
                                 data.requester?.workLocation?.id || 
                                 data.workLocationUid;
            const deptId = data.requester?.department?.uuid || 
                           data.requester?.department?.id || 
                           data.departmentUid;
            
            const hasPendingDeptHeadApproval = Array.isArray(data.approvals) && data.approvals.some(
              (app: any) => app?.role === "departmentHead" && app?.decision === "pending"
            );

            if (
              workLocationId === userWorkLocationId &&
              deptId === userDepartmentId &&
              data.createdByUid !== userUid &&
              hasPendingDeptHeadApproval
            ) {
              triggerNotification(
                "🚗 ມີຄຳຂໍອອກນอกສະຖານທີ່ໃໝ່!",
                `ພະນັກງານ: ${data.createdBy || "ບໍ່ມີຊື່"} ຂໍອອກໄປ: ${data.location || "ບໍ່ລະບຸ"}`
              );
            }
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
  }, [userUid, userDepartmentId, userWorkLocationId]); 

  const notifications = useMemo(() => {
    return [...leaveNotifications, ...workNotifications];
  }, [leaveNotifications, workNotifications]);

  return (
    <NotificationContext.Provider value={{ notifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);