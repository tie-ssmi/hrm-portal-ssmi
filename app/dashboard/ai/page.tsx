// components/SinaChat.tsx
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useRef } from 'react';

export default function SinaChat() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ຕົວຢ່າງ: ສົ່ງຂໍ້ມູນໄປຫາ SINA
  const sendMessageToSina = () => {
    const data = { userName: "mua", role: "Developer" };
    iframeRef.current?.contentWindow?.postMessage(data, "*");
  };

  return (
    <div className="space-y-6">
 <div>
        <h1 className="text-2xl font-bold text-foreground">Sina Al</h1>
        <p className="text-muted-foreground"></p>
      </div>


        <Card className='w-full h-[600px]'>
         <CardContent className='p-0 h-full'>
            
                  <iframe
        ref={iframeRef}
        // src="https://script.google.com/macros/s/AKfycbz3ogdQbR2GUztgLG1TtpFbatCFCXVzgMK43j5zWdd0PQ1enAKCnjJWoyVjNDOzDoiRPg/exec" // ເອົາ URL ທີ່ໄດ້ຈາກການ Deploy Apps Script ມາໃສ່ນີ້
        src="https://chatbot.ssmilaos.com/" // ເອົາ URL ທີ່ໄດ້ຈາກການ Deploy Apps Script ມາໃສ່ນີ້
       className='w-full h-full border-none rounded-lg shadow-2xl'
        title="SINA AI Assistant"
      />
            
            </CardContent>   

    </Card>
    </div>
    
  );
}