import { Suspense } from 'react'
import OffsiteDetailClient from '@/app/dashboard/approv/work-off-site/offsite-detail-client'

export default function OffsiteDetailPage() {
  return (
    <Suspense>
      <OffsiteDetailClient />
    </Suspense>
  )
}
