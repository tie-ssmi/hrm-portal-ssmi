import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function ProfileSkeleton() {
	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<Skeleton className="h-8 w-36" />
				<Skeleton className="h-4 w-72" />
			</div>

			<Card>
				<CardContent className="pt-6">
					<div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
						<Skeleton className="h-24 w-24 rounded-full" />
						<div className="space-y-2 text-center sm:text-left">
							<Skeleton className="h-7 w-56" />
							<Skeleton className="h-5 w-48" />
							<Skeleton className="h-4 w-40" />
							<div className="flex gap-2 justify-center sm:justify-start">
								<Skeleton className="h-6 w-24 rounded-full" />
								<Skeleton className="h-6 w-16 rounded-full" />
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-36" />
					<Skeleton className="h-4 w-56" />
				</CardHeader>
				<CardContent className="space-y-4">
					{Array.from({ length: 7 }).map((_, i) => (
						<div key={i} className="flex items-center justify-between py-2">
							<div className="flex items-center gap-3">
								<Skeleton className="h-9 w-9 rounded-lg" />
								<div className="space-y-2">
									<Skeleton className="h-3 w-24" />
									<Skeleton className="h-4 w-36" />
								</div>
							</div>
							<Skeleton className="h-8 w-8" />
						</div>
					))}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-40" />
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						{Array.from({ length: 8 }).map((_, i) => (
							<div key={i} className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
								<Skeleton className="h-8 w-8 rounded-lg" />
								<div className="space-y-2">
									<Skeleton className="h-3 w-24" />
									<Skeleton className="h-4 w-36" />
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-44" />
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={i} className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
								<Skeleton className="h-8 w-8 rounded-lg" />
								<div className="space-y-2">
									<Skeleton className="h-3 w-24" />
									<Skeleton className="h-4 w-36" />
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-36" />
				</CardHeader>
				<CardContent className="space-y-3">
					{Array.from({ length: 2 }).map((_, i) => (
						<div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
							<div className="space-y-2">
								<Skeleton className="h-4 w-28" />
								<Skeleton className="h-3 w-44" />
							</div>
							<Skeleton className="h-6 w-16 rounded-full" />
						</div>
					))}
				</CardContent>
			</Card>
		</div>
	)
}
