import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function HistorySkeleton() {
	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<Skeleton className="h-8 w-28" />
				<Skeleton className="h-4 w-64" />
			</div>

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Card key={i}>
						<CardContent className="pt-4 pb-4">
							<div className="flex items-center gap-3">
								<Skeleton className="h-10 w-10 rounded-lg" />
								<div className="space-y-2">
									<Skeleton className="h-3 w-16" />
									<Skeleton className="h-6 w-12" />
								</div>
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			<Card>
				<CardContent className="pt-6 space-y-4">
					<div className="grid grid-cols-4 gap-2">
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton key={i} className="h-9 w-full" />
						))}
					</div>

					<Card>
						<CardHeader>
							<Skeleton className="h-5 w-40" />
							<Skeleton className="h-4 w-52" />
						</CardHeader>
						<CardContent className="space-y-3">
							{Array.from({ length: 5 }).map((_, i) => (
								<div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
									<div className="space-y-2">
										<Skeleton className="h-4 w-44" />
										<Skeleton className="h-3 w-36" />
									</div>
									<Skeleton className="h-6 w-16 rounded-full" />
								</div>
							))}
						</CardContent>
					</Card>
				</CardContent>
			</Card>
		</div>
	)
}
