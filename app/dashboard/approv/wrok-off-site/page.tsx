import { Suspense } from 'react'
import OffsiteDetailClient from '@/app/dashboard/approv/wrok-off-site/offsite-detail-client'

export default function OffsiteDetailPage() {
  return (
    <Suspense>
      <OffsiteDetailClient />
    </Suspense>
  )
}
