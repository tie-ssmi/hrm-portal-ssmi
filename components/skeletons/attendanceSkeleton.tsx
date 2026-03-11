import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function AttendanceSkeleton() {
	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<Skeleton className="h-8 w-56" />
				<Skeleton className="h-4 w-64" />
			</div>

			<Card>
				<CardContent className="pt-6">
					<div className="space-y-3 text-center">
						<Skeleton className="h-4 w-24 mx-auto" />
						<Skeleton className="h-10 w-44 mx-auto" />
						<Skeleton className="h-4 w-52 mx-auto" />
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-2">
					<Skeleton className="h-5 w-32" />
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="flex items-center justify-between">
						<Skeleton className="h-9 w-32" />
						<Skeleton className="h-6 w-28 rounded-full" />
					</div>
					<Skeleton className="h-3 w-28" />
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<Skeleton className="h-5 w-36" />
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						{Array.from({ length: 2 }).map((_, i) => (
							<div key={i} className="rounded-lg bg-muted/50 p-4 text-center space-y-2">
								<Skeleton className="h-3 w-20 mx-auto" />
								<Skeleton className="h-7 w-20 mx-auto" />
							</div>
						))}
					</div>
					<div className="flex justify-center">
						<Skeleton className="h-8 w-36 rounded-full" />
					</div>
				</CardContent>
			</Card>

			<div className="grid grid-cols-2 gap-4">
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-16 w-full" />
			</div>

			<Card>
				<CardHeader>
					<Skeleton className="h-5 w-36" />
					<Skeleton className="h-4 w-48" />
				</CardHeader>
				<CardContent className="space-y-2">
					{Array.from({ length: 4 }).map((_, i) => (
						<div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
							<div className="space-y-2">
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-3 w-28" />
							</div>
							<Skeleton className="h-6 w-16 rounded-full" />
						</div>
					))}
				</CardContent>
			</Card>
		</div>
	)
}
