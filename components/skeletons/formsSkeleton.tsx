import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function FormsSkeleton() {
	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<Skeleton className="h-8 w-44" />
				<Skeleton className="h-4 w-64" />
			</div>

			<div className="grid grid-cols-3 gap-3">
				{Array.from({ length: 3 }).map((_, i) => (
					<Card key={i}>
						<CardContent className="pt-4 pb-4 space-y-2">
							<Skeleton className="h-3 w-12" />
							<Skeleton className="h-7 w-20" />
						</CardContent>
					</Card>
				))}
			</div>

			<Card>
				<CardContent className="pt-6 space-y-4">
					<div className="grid grid-cols-2 gap-2">
						<Skeleton className="h-9 w-full" />
						<Skeleton className="h-9 w-full" />
					</div>

					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-40" />
							<Skeleton className="h-4 w-44" />
						</CardHeader>
						<CardContent className="space-y-4">
							<Skeleton className="h-10 w-full" />
							<div className="grid grid-cols-2 gap-4">
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
							<Skeleton className="h-24 w-full" />
							<Skeleton className="h-10 w-full" />
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<Skeleton className="h-5 w-32" />
						</CardHeader>
						<CardContent className="space-y-3">
							{Array.from({ length: 3 }).map((_, i) => (
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
				</CardContent>
			</Card>
		</div>
	)
}
