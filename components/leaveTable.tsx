'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarRange, UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'

type LeaveTableStatus = 'pending' | 'approved' | 'rejected'

export type LeaveTableItem = {
	id: string
	name: string
	position?: string
	department?: string
	reason?: string
	note?: string
	successor?: string
	startDate: string
	endDate: string
	type?: {
		id?: string
		name?: string
	}
	status?: LeaveTableStatus
}

type LeaveTableProps = {
	data: LeaveTableItem[]
	onViewDetail?: (item: LeaveTableItem) => void
	onApprove?: (item: LeaveTableItem) => void
	className?: string
}

function statusLabel(status?: LeaveTableStatus) {
	switch (status) {
		case 'approved':
			return 'ອະນຸມັດແລ້ວ'
		case 'rejected':
			return 'ປະຕິເສດ'
		default:
			return 'ລໍຖ້າອະນຸມັດ'
	}
}

function statusVariant(status?: LeaveTableStatus): 'default' | 'destructive' | 'secondary' {
	if (status === 'approved') return 'default'
	if (status === 'rejected') return 'destructive'
	return 'secondary'
}

export default function LeaveTable({ data, onViewDetail, onApprove, className }: LeaveTableProps) {
	const router = useRouter()

	const handleViewDetail = (item: LeaveTableItem) => {
		if (onViewDetail) {
			onViewDetail(item)
			return
		}

		const params = new URLSearchParams({
			name: item.name,
			department: item.department || '',
			successor: item.successor || '',
			startDate: item.startDate,
			endDate: item.endDate,
			reason: item.reason || '',
			position: item.position || '',
			note: item.note || '',
			typeId: item.type?.id || '',
			typeName: item.type?.name || '',
		})

		router.push(`/dashboard/approv/leave/${item.id}?${params.toString()}`)
	}

	if (data.length === 0) {
		return (
			<Card className={className}>
				<CardContent className="py-12 text-center text-sm text-muted-foreground">
					ຍັງບໍ່ມີລາຍການຄໍາຂໍລາ
				</CardContent>
			</Card>
		)
	}

	return (
		<Card className={className}>
			<CardContent className="p-0">
				<div className="space-y-3 p-3 md:hidden">
					{data.map((item, index) => {
						const canApprove = item.status !== 'approved' && item.status !== 'rejected'

						return (
							<Card key={item.id} className="border bg-background">
								<CardContent className="space-y-3 p-3">
									<div className="flex items-start justify-between gap-2">
										<div className="flex items-start gap-2">
											<span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
												<UserRound className="h-4 w-4" />
											</span>
											<div>
												<p className="text-xs text-muted-foreground">#{index + 1}</p>
												<p className="text-sm font-semibold text-foreground leading-tight">{item.name}</p>
												<p className="text-xs text-muted-foreground">{item.position || '-'} • {item.department || '-'}</p>
											</div>
										</div>
										<Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
									</div>

									<div className="space-y-1">
										<p className="text-xs text-muted-foreground">ເຫດຜົນ</p>
										<p className="text-sm text-foreground leading-6">{item.reason || '-'}</p>
									</div>

									<div className="grid grid-cols-2 gap-2 text-xs">
										<div className="rounded-md bg-muted p-2">
											<p className="text-muted-foreground">ເລີ່ມຕົ້ນ</p>
											<p className="mt-1 inline-flex items-center gap-1 font-medium text-foreground">
												<CalendarRange className="h-3.5 w-3.5" />
												{item.startDate}
											</p>
										</div>
										<div className="rounded-md bg-muted p-2">
											<p className="text-muted-foreground">ສິ້ນສຸດ</p>
											<p className="mt-1 inline-flex items-center gap-1 font-medium text-foreground">
												<CalendarRange className="h-3.5 w-3.5" />
												{item.endDate}
											</p>
										</div>
									</div>

									<div className="text-xs">
										<span className="text-muted-foreground">ຜູ້ຮັບວຽກຕໍ່: </span>
										<span className="font-medium text-foreground">{item.successor || '-'}</span>
									</div>

									<div className="grid grid-cols-2 gap-2 pt-1">
										<Button type="button" variant="outline" size="sm" onClick={() => handleViewDetail(item)}>
											ລາຍລະອຽດ
										</Button>
										<Button type="button" size="sm" onClick={() => onApprove?.(item)} disabled={!canApprove}>
											{canApprove ? 'ອະນຸມັດ' : 'ສໍາເລັດ'}
										</Button>
									</div>
								</CardContent>
							</Card>
						)
					})}
				</div>

				<div className="hidden md:block">
					<Table>
						<TableHeader className="bg-muted/40">
							<TableRow className="hover:bg-muted/40">
								<TableHead className="w-14 px-4">ລໍາດັບ</TableHead>
								<TableHead className="px-4 min-w-[180px]">ຊື່ ແລະ ນາມສະກຸນ</TableHead>
								<TableHead className="px-4 min-w-[120px]">ຕໍາແໜ່ງ</TableHead>
								<TableHead className="px-4 min-w-[110px]">ພະແນກ</TableHead>
								<TableHead className="px-4 min-w-[220px]">ເຫດຜົນ</TableHead>
								<TableHead className="px-4 min-w-[150px]">ຜູ້ຮັບວຽກຕໍ່</TableHead>
								<TableHead className="px-4 min-w-[130px]">ມື້ເລີ່ມຕົ້ນ</TableHead>
								<TableHead className="px-4 min-w-[130px]">ມື້ສິ້ນສຸດ</TableHead>
								<TableHead className="px-4 min-w-[190px]">ສະຖານະ</TableHead>
								<TableHead className="px-4 min-w-[170px] text-right">ຈັດການ</TableHead>
							</TableRow>
						</TableHeader>

						<TableBody>
							{data.map((item, index) => {
								const canApprove = item.status !== 'approved' && item.status !== 'rejected'

								return (
									<TableRow key={item.id} className="align-top" onClick={() => handleViewDetail(item)}>
										<TableCell className="px-4 py-4 font-semibold text-muted-foreground">{index + 1}</TableCell>

										<TableCell className="px-4 py-3">
											<div className="flex items-center gap-2">
												<span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
													<UserRound className="h-4 w-4" />
												</span>
												<span className="font-medium text-foreground leading-tight">{item.name}</span>
											</div>
										</TableCell>

										<TableCell className="px-4 py-3 text-foreground">{item.position || '-'}</TableCell>
										<TableCell className="px-4 py-3 text-foreground">{item.department || '-'}</TableCell>

										<TableCell className="px-4 py-3">
											<p className="max-w-[240px] whitespace-normal break-words text-foreground leading-6">
												{item.reason || '-'}
											</p>
										</TableCell>

										<TableCell className="px-4 py-3 text-foreground">{item.successor || '-'}</TableCell>

										<TableCell className="px-4 py-3">
											<div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
												<CalendarRange className="h-3.5 w-3.5" />
												{item.startDate}
											</div>
										</TableCell>

										<TableCell className="px-4 py-3">
											<div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
												<CalendarRange className="h-3.5 w-3.5" />
												{item.endDate}
											</div>
										</TableCell>

										<TableCell className="px-4 py-3">
											<Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
										</TableCell>

										<TableCell className="px-4 py-3">
											<div className="flex items-center justify-end gap-2">
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="min-w-[84px]"
													onClick={() => handleViewDetail(item)}
												>
													ລາຍລະອຽດ
												</Button>
												<Button
													type="button"
													size="sm"
													className="min-w-[84px]"
													onClick={() => onApprove?.(item)}
													disabled={!canApprove}
												>
													{canApprove ? 'ອະນຸມັດ' : 'ສໍາເລັດ'}
												</Button>
											</div>
										</TableCell>
									</TableRow>
								)
							})}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	)
}
