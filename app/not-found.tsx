import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <div className="text-center space-y-3 w-full max-w-sm">
        <p className="text-6xl font-bold text-muted-foreground/30">404</p>
        <h2 className="text-2xl font-semibold">ບໍ່ພົບໜ້າເວັບໄຊນີ້</h2>
        <p className="text-muted-foreground">ໜ້າທີ່ທ່ານຊອກຫາບໍ່ມີໃນລະບົບ.</p>
        <Link href="/">
          <Button>ກັບໄປໜ້າຫຼັກ</Button>
        </Link>
      </div>
    </div>
  )
}