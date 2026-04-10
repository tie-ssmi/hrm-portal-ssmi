'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, CirclePlus, FileText } from 'lucide-react'

export default function LeavePage() {
	const router = useRouter()

	return (
		<div className="space-y-6 pb-8">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p className="text-sm text-muted-foreground">Leave Requests</p>
					<h1 className="text-2xl font-bold leading-tight">Select a leave request</h1>
				</div>
				<Button type="button" size="sm" onClick={() => router.push('/dashboard/request')}>
					<CirclePlus className="mr-2 h-4 w-4" />
					Add New
				</Button>
			</div>

			<Card>
				<CardContent className="space-y-4 py-10 text-center">
					<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
						<FileText className="h-5 w-5" />
					</div>
					<div>
						<p className="text-lg font-semibold">No leave request selected</p>
						<p className="mt-1 text-sm text-muted-foreground">
							Open a request from the approval table to see its detail page.
						</p>
					</div>
					<div className="flex items-center justify-center gap-2">
						<Button type="button" variant="outline" size="sm" onClick={() => router.back()}>
							<ArrowLeft className="mr-2 h-4 w-4" />
							Back
						</Button>
						<Button type="button" size="sm" onClick={() => router.push('/dashboard/approv')}>
							Go to Approvals
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
