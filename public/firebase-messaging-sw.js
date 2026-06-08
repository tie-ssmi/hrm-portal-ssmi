importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// ຕັ້ງຄ່າ Firebase ໃນ Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyBOz7kNhNpXqPjezyPTP2olrDtSsxyxR6c",
  authDomain: "hrm-ssmi.firebaseapp.com",
  projectId: "hrm-ssmi",
  storageBucket: "hrm-ssmi.firebasestorage.app",
  messagingSenderId: "39051360088",
   //Prodution
  // appId: "1:39051360088:web:ccaec7f7b0e287f6f6572d",
  //Staging
  appId: "1:39051360088:web:86b1af09f33f72daf6572d",
    
});

const messaging = firebase.messaging();

// 🌟 ດັກຈັບການແຈ້ງເຕືອນຕອນປິດເວັບໄຊ (Background) - ລວມໃຫ້ເຫຼືອຟັງຊັນດຽວ
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  // 1. ກວດເຊັກຄ່າຈາກ Custom Data (Key-Value) ກ່ອນ
  let title = payload.data && payload.data.type ? `🚨 ${payload.data.type} Request!` : "";
  let body = payload.data && payload.data.employeeName ? `ພະນັກງານ: ${payload.data.employeeName} ໄດ້ສົ່ງຄຳຂໍເຂົ້າມາໃນລະບົບ.` : "";

  // 2. ຖ້າບໍ່ມີ Custom Data, ໃຫ້ດຶງຄ່າຈາກ Notification ປົກກະຕິທີ່ພິມມາຈາກ Console
  if (!title && payload.notification) {
    title = payload.notification.title || "ແຈ້ງເຕືອນໃໝ່";
  }
  if (!body && payload.notification) {
    body = payload.notification.body || "ທ່ານມີຂໍ້ຄວາມໃໝ່ໃນລະບົບ";
  }

  // 3. ຕັ້ງຄ່າ Options ຂອງການສະແດງຜົນ
  const notificationOptions = {
    body: body,
    icon: "/SSMI.png",       // ໃຊ້ໂລໂກ້ເວັບໄຊຂອງເຈົ້າ
    badge: "/SSMI.png",      // ໄອຄອນນ້ອຍໆເທິງແຖບແຈ້ງເຕືອນ
    vibrate: [200, 100, 200],
    tag: "hrm-custom-push"   // ປ້ອງກັນບໍ່ໃຫ້ແຈ້ງເຕືອນເດັ້ງຊ້ຳກັນຫຼາຍເກີນໄປ
  };

  // 4. ສັ່ງໃຫ້ Browser ເດັ້ງ Push Notification ອອກມາ
  return self.registration.showNotification(title, notificationOptions);
});