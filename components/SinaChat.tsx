// components/SinaChat.tsx
'use client';

import { useRef } from 'react';

export default function SinaChat() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ຕົວຢ່າງ: ສົ່ງຂໍ້ມູນໄປຫາ SINA
  const sendMessageToSina = () => {
    const data = { userName: "Mua Lee", role: "Developer" };
    iframeRef.current?.contentWindow?.postMessage(data, "*");
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <iframe
        ref={iframeRef}
        src="YOUR_APPS_SCRIPT_URL" // ເອົາ URL ທີ່ໄດ້ຈາກການ Deploy Apps Script ມາໃສ່ນີ້
        className="w-[350px] h-[500px] border-none rounded-lg shadow-2xl"
        title="SINA AI Assistant"
      />
    </div>
  );
}