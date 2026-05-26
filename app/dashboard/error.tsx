'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-destructive/10 mx-auto">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">ໂຫຼດໜ້ານີ້ບໍ່ສຳເລັດ</h2>
            <p className="text-sm text-muted-foreground">
              ເກີດຂໍ້ຜິດພາດໃນການໂຫຼດຂໍ້ມູນ ກະລຸນາລອງໃໝ່ຫຼືກັບໄປໜ້າຫຼັກ
            </p>
          </div>
          <div className="flex gap-3 justify-center pt-2">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              <Home className="w-4 h-4 mr-2" />
              ໜ້າຫຼັກ
            </Button>
            <Button onClick={reset}>
              <RefreshCw className="w-4 h-4 mr-2" />
              ລອງໃໝ່
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
