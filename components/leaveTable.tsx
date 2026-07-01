'use client'

// ** core
import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ** assets / icons
import { CalendarRange, Eye, Check, X, MoreHorizontal, UserRound, HelpCircle } from 'lucide-react'

// ** shared components
import { Button } from '@/components/ui/button'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/offsite/StatusBadge'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'

// ** third party
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

// ** config / utils / types / hooks
import type { LeaveApprovalStep } from '@/lib/types'

const ROLE_LABEL: Record<string, string> = {
	departmentHead: 'ຫົວໜ້າພະແນກ',
	hr: 'HR',
	manager: 'ຜູ້ຈັດການ',
}

function getWhoPending(approvals?: LeaveApprovalStep[]): string | null {
	if (!Array.isArray(approvals) || approvals[0]?.decision === 'pending') return null
	const pending = approvals
		.filter(a => a?.decision === 'pending')
		.map(a => ROLE_LABEL[a.role ?? ''] ?? a.role)
	return pending.length > 0 ? pending.join(', ') : null
}

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
	duration?: number
	type?: { id?: string; name?: string }
	status?: LeaveTableStatus
	approvals?: LeaveApprovalStep[]
}

type LeaveTableProps = {
	data: LeaveTableItem[]
	onViewDetail?: (item: LeaveTableItem) => void
	onApprove?: (item: LeaveTableItem) => void
	onReject?: (item: LeaveTableItem) => void
	canApproveBranch?: boolean
	className?: string
}

type TabValue = 'all' | 'pending' | 'inprogress' | 'rejected'

const TABS: { value: TabValue; label: string }[] = [
	{ value: 'all',        label: 'ທັງໝົດ' },
	{ value: 'pending',    label: 'ລໍຖ້າ' },
	{ value: 'inprogress', label: 'ດຳເນີນການ' },
	{ value: 'rejected',   label: 'ປະຕິເສດ' },
]

function tabMatch(item: LeaveTableItem, tab: TabValue): boolean {
	if (tab === 'pending')    return item.approvals?.[0]?.decision === 'pending' && item.status !== 'rejected'
	if (tab === 'inprogress') return item.approvals?.[0]?.decision === 'approved' && item.status !== 'rejected'
	if (tab === 'rejected')   return item.status === 'rejected'
	return true
}

function computeRowMeta(item: LeaveTableItem) {
	const canApprove =
		item.status !== 'approved' &&
		item.status !== 'rejected' &&
		item.approvals?.[0]?.decision !== 'approved' &&
		item.approvals?.[0]?.decision !== 'rejected'
	const whoPending = getWhoPending(item.approvals)
	return { canApprove, whoPending }
}

function formatDuration(duration?: number): string {
	if (duration == null) return ''
	return duration === 0.5 ? '0.5 ວັນ' : `${duration} ວັນ`
}

export default function LeaveTable({ data, onViewDetail, onApprove, onReject, canApproveBranch = false, className }: LeaveTableProps) {
	const router = useRouter()
	const [activeTab, setActiveTab] = useState<TabValue>('all')
	const [deptFilter, setDeptFilter] = useState('all')

	const departments = useMemo(() => {
		const set = new Set<string>()
		data.forEach(i => { if (i.department) set.add(i.department) })
		return Array.from(set).sort()
	}, [data])

	const deptFiltered = useMemo(() =>
		canApproveBranch && deptFilter !== 'all'
			? data.filter(i => i.department === deptFilter)
			: data,
		[data, deptFilter, canApproveBranch],
	)

	const counts = useMemo(() => ({
		all:        deptFiltered.length,
		pending:    deptFiltered.filter(i => tabMatch(i, 'pending')).length,
		inprogress: deptFiltered.filter(i => tabMatch(i, 'inprogress')).length,
		rejected:   deptFiltered.filter(i => tabMatch(i, 'rejected')).length,
	}), [deptFiltered])

	const filtered = useMemo(() =>
		activeTab === 'all' ? deptFiltered : deptFiltered.filter(i => tabMatch(i, activeTab)),
		[deptFiltered, activeTab],
	)

	// ── Driver.js tour ──
	const TOUR_KEY = 'leave-table-tour-seen'

	const startTour = useCallback(() => {
		const driverObj = driver({
			showProgress: true,
			animate: true,
			overlayColor: 'rgba(0,0,0,0.55)',
			nextBtnText: 'ຕໍ່ໄປ',
			prevBtnText: 'ກັບຄືນ',
			doneBtnText: 'ເຂົ້າໃຈແລ້ວ',
			progressText: '{{current}} / {{total}}',
			steps: [
				{
					element: '#leave-table-tabs',
					popover: {
						title: 'ຕົວກັ່ນຕອງ',
						description: 'ກັ່ນຕອງຕາມສະຖານະ: ທັງໝົດ, ລໍຖ້າ, ດຳເນີນການ, ປະຕິເສດ',
						side: 'bottom' as const,
						align: 'start' as const,
					},
				},
				{
					element: '#leave-table-list',
					popover: {
						title: 'ລາຍການຄໍາຮ້ອງຂໍ',
						description: 'ເບິ່ງລາຍລະອຽດ, ອະນຸมັດ ຫຼື ປະຕິເສດ ແຕ່ລະຄໍາຮ້ອງ',
						side: 'top' as const,
						align: 'center' as const,
					},
				},
			],
			onDestroyed: () => {
				localStorage.setItem(TOUR_KEY, '1')
			},
		})
		driverObj.drive()
	}, [])

	useEffect(() => {
		if (!localStorage.getItem(TOUR_KEY)) {
			const timer = setTimeout(startTour, 600)
			return () => clearTimeout(timer)
		}
	}, [startTour])

	function handleViewDetail(item: LeaveTableItem) {
		if (onViewDetail) { onViewDetail(item); return }
		const params = new URLSearchParams({
			id: item.id,
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
		router.push(`/dashboard/approv/leave/detail?${params.toString()}`)
	}

	return (
		<Card className={className}>
			{/* Filter bar */}
			<div id="leave-table-tabs" className="border-b px-4 pt-3 pb-0 space-y-3">
				{canApproveBranch && departments.length > 0 && (
					<Select value={deptFilter} onValueChange={setDeptFilter}>
						<SelectTrigger className="h-8 w-48 text-xs">
							<SelectValue placeholder="ທຸກພະແນກ" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">ທຸກພະແນກ</SelectItem>
							{departments.map(dept => (
								<SelectItem key={dept} value={dept}>{dept}</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}
				<div className="flex items-center gap-0 overflow-x-auto">
					<Button type="button" variant="ghost" size="icon" className="shrink-0 h-7 w-7 mr-1" onClick={startTour}>
						<HelpCircle className="w-4 h-4 text-muted-foreground" />
					</Button>
					{TABS.map(tab => (
						<button
							key={tab.value}
							type="button"
							onClick={() => setActiveTab(tab.value)}
							className={[
								'relative flex items-center gap-1.5 px-3 pb-2.5 pt-1 text-sm whitespace-nowrap transition-colors',
								activeTab === tab.value
									? 'text-foreground font-medium after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-t'
									: 'text-muted-foreground hover:text-foreground',
							].join(' ')}
						>
							{tab.label}
							<span className={[
								'inline-flex items-center justify-center rounded-full px-1.5 py-0 text-[10px] font-medium min-w-[18px]',
								activeTab === tab.value
									? 'bg-primary/10 text-primary'
									: 'bg-muted text-muted-foreground',
							].join(' ')}>
								{counts[tab.value]}
							</span>
						</button>
					))}
				</div>
			</div>

			<CardContent id="leave-table-list" className="p-0">
				{filtered.length === 0 ? (
					<div className="py-12 text-center text-sm text-muted-foreground">
						ບໍ່ມີລາຍການ
					</div>
				) : (
					<>
						{/* Mobile cards */}
						<div className="space-y-3 p-3 md:hidden">
							{filtered.map((item, index) => {
								const { canApprove, whoPending } = computeRowMeta(item)
								return (
									<Card key={item.id} className="border bg-background">
										<CardContent className="space-y-3 p-3">
											<div className="flex items-start justify-between gap-2">
												<div className="flex items-start gap-2 min-w-0">
													<span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
														<UserRound className="h-4 w-4" />
													</span>
													<div className="min-w-0">
														<p className="text-xs text-muted-foreground">#{index + 1}</p>
														<p className="text-sm font-semibold text-foreground leading-tight truncate">{item.name}</p>
														<p className="text-xs text-muted-foreground truncate">
															{item.position || '-'} · {item.department || '-'}
														</p>
													</div>
												</div>
												<div className="flex flex-col items-end gap-0.5 shrink-0">
													<StatusBadge status={item.status ?? 'pending'} />
													{item.status === 'pending' && whoPending && (
														<span className="text-[10px] text-muted-foreground">{whoPending}</span>
													)}
												</div>
											</div>

											{item.type?.name && (
												<p className="text-xs text-muted-foreground">
													ປະເພດ: <span className="font-medium text-foreground">{item.type.name}</span>
												</p>
											)}

											{item.reason && (
												<p className="text-sm text-foreground leading-5 line-clamp-2">{item.reason}</p>
											)}

											<div className="flex items-center gap-2 text-xs text-muted-foreground">
												<CalendarRange className="h-3.5 w-3.5 shrink-0" />
												<span>{item.startDate} – {item.endDate}</span>
												{item.duration != null && (
													<span className="ml-auto font-medium text-foreground">{formatDuration(item.duration)}</span>
												)}
											</div>

											{item.successor && (
												<div className="text-xs text-muted-foreground">
													ຜູ້ຮັບວຽກຕໍ່: <span className="font-medium text-foreground">{item.successor}</span>
												</div>
											)}

											<div className="flex gap-2 pt-1">
												<Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => handleViewDetail(item)}>
													<Eye className="h-3.5 w-3.5 mr-1" />
													ລາຍລະອຽດ
												</Button>
												{canApprove && (
													<>
														<Button type="button" size="sm" className="flex-1" onClick={() => onApprove?.(item)}>
															<Check className="h-3.5 w-3.5 mr-1" />
															ອະນຸມັດ
														</Button>
														{onReject && (
															<Button type="button" variant="destructive" size="sm" className="flex-1" onClick={() => onReject(item)}>
																<X className="h-3.5 w-3.5 mr-1" />
																ປະຕິເສດ
															</Button>
														)}
													</>
												)}
											</div>
										</CardContent>
									</Card>
								)
							})}
						</div>

						{/* Desktop table */}
						<div className="hidden md:block overflow-x-auto">
							<Table>
								<TableHeader className="bg-muted/40">
									<TableRow className="hover:bg-muted/40">
										<TableHead className="w-12 px-4">#</TableHead>
										<TableHead className="px-4 min-w-[200px]">ຊື່ / ຕໍາແໜ່ງ</TableHead>
										<TableHead className="px-4 min-w-[200px]">ເຫດຜົນ</TableHead>
										<TableHead className="px-4 min-w-[160px]">ວັນທີ</TableHead>
										<TableHead className="px-4 min-w-[140px]">ຜູ້ຮັບວຽກຕໍ່</TableHead>
										<TableHead className="px-4 w-28">ສະຖານະ</TableHead>
										<TableHead className="px-4 w-12 text-right">...</TableHead>
									</TableRow>
								</TableHeader>

								<TableBody>
									{filtered.map((item, index) => {
										const { canApprove, whoPending } = computeRowMeta(item)
										return (
											<TableRow key={item.id} className="hover:bg-muted/30">
												<TableCell className="px-4 py-3 font-semibold text-muted-foreground text-sm">
													{index + 1}
												</TableCell>

												<TableCell className="px-4 py-3">
													<div className="flex items-center gap-2 min-w-0">
														<span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
															<UserRound className="h-4 w-4" />
														</span>
														<div className="min-w-0">
															<p className="text-sm font-medium text-foreground truncate">{item.name}</p>
															<p className="text-xs text-muted-foreground truncate">
																{item.position || '-'} · {item.department || '-'}
															</p>
														</div>
													</div>
												</TableCell>

												<TableCell className="px-4 py-3">
													<p className="text-sm text-foreground line-clamp-2 max-w-[200px]">
														{item.reason || '-'}
													</p>
													{item.type?.name && (
														<p className="text-xs text-muted-foreground mt-0.5">{item.type.name}</p>
													)}
												</TableCell>

												<TableCell className="px-4 py-3 whitespace-nowrap">
													<div className="flex items-center gap-1 text-xs text-muted-foreground">
														<CalendarRange className="h-3 w-3 shrink-0" />
														<span>{item.startDate} – {item.endDate}</span>
													</div>
													{item.duration != null && (
														<p className="text-xs text-muted-foreground mt-0.5 pl-4">
															{formatDuration(item.duration)}
														</p>
													)}
												</TableCell>

												<TableCell className="px-4 py-3">
													<p className="text-sm text-foreground truncate max-w-[140px]">
														{item.successor || '-'}
													</p>
												</TableCell>

												<TableCell className="px-4 py-3">
													<div className="flex flex-col gap-0.5">
														<StatusBadge status={item.status ?? 'pending'} />
														{item.status === 'pending' && whoPending && (
															<span className="text-[10px] text-muted-foreground">{whoPending}</span>
														)}
													</div>
												</TableCell>

												<TableCell className="px-4 py-3 text-right">
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<Button variant="ghost" size="icon" className="h-8 w-8" aria-label="ຕົວເລືອກ">
																<MoreHorizontal className="h-4 w-4" />
															</Button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end">
															<DropdownMenuItem onClick={() => handleViewDetail(item)}>
																<Eye className="h-4 w-4 mr-2" />
																ເບິ່ງລາຍລະອຽດ
															</DropdownMenuItem>
															{canApprove && (
																<>
																	<DropdownMenuSeparator />
																	<DropdownMenuItem onClick={() => onApprove?.(item)}>
																		<Check className="h-4 w-4 mr-2" />
																		ອະນຸມັດ
																	</DropdownMenuItem>
																	{onReject && (
																		<DropdownMenuItem
																			onClick={() => onReject(item)}
																			className="text-destructive focus:text-destructive"
																		>
																			<X className="h-4 w-4 mr-2" />
																			ປະຕິເສດ
																		</DropdownMenuItem>
																	)}
																</>
															)}
														</DropdownMenuContent>
													</DropdownMenu>
												</TableCell>
											</TableRow>
										)
									})}
								</TableBody>
							</Table>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	)
}
