'use client'

import { Suspense } from 'react'
import LeaveDetailClient from '../[id]/leave-detail-client'
import { Spinner } from '@/components/ui/spinner'

export default function LeaveDetailPage() {
	return (
		<Suspense fallback={<div className="flex items-center justify-center py-12"><Spinner className="w-8 h-8" /></div>}>
			<LeaveDetailClient />
		</Suspense>
	)
}
