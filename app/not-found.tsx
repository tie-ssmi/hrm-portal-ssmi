import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-start h-screen">
      <div className="text-center space-y-2 w-[250px] h-auto">
        <DotLottieReact
      src="https://lottie.host/125836f7-baa2-4650-8489-9357e329713c/zBRtRP70Mf.lottie"
      loop
      autoplay
    />
        <h2 className="text-2xl font-semibold">ບໍ່ພົບໜ້າເວັບໄຊນີ້</h2>
        <p className="text-muted-foreground">ໜ້າທີ່ທ່ານຊອກຫາບໍ່ມີໃນລະບົບ.</p>
        <Link href="/">
          <Button>ກັບໄປໜ້າຫຼັກ</Button>
        </Link>
      </div>
    </div>
  )
}