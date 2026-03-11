import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function HomeSkeleton() {
	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<Skeleton className="h-8 w-52" />
				<Skeleton className="h-4 w-44" />
			</div>

			<Card className="border-primary/20 bg-primary/5">
				<CardContent className="pt-6">
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-4">
							<Skeleton className="h-12 w-12 rounded-full" />
							<div className="space-y-2">
								<Skeleton className="h-4 w-28" />
								<Skeleton className="h-5 w-48" />
							</div>
						</div>
						<Skeleton className="h-6 w-20 rounded-full" />
					</div>
				</CardContent>
			</Card>

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Card key={i}>
						<CardContent className="pt-6">
							<div className="flex items-center gap-3">
								<Skeleton className="h-10 w-10 rounded-lg" />
								<div className="space-y-2">
									<Skeleton className="h-3 w-20" />
									<Skeleton className="h-6 w-12" />
								</div>
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-40" />
				</CardHeader>
				<CardContent className="space-y-4">
					{Array.from({ length: 3 }).map((_, i) => (
						<div key={i} className="space-y-2">
							<div className="flex items-center justify-between">
								<Skeleton className="h-4 w-28" />
								<Skeleton className="h-4 w-32" />
							</div>
							<Skeleton className="h-2 w-full rounded-full" />
						</div>
					))}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-48" />
				</CardHeader>
				<CardContent className="space-y-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
							<div className="space-y-2">
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-3 w-36" />
							</div>
							<Skeleton className="h-6 w-16 rounded-full" />
						</div>
					))}
				</CardContent>
			</Card>
		</div>
	)
}
