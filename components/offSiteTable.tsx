'use client'

import { useState, useMemo } from 'react'
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarRange, Eye, Check, X, MoreHorizontal, UserRound, Users } from 'lucide-react'
import { StatusBadge } from '@/components/offsite/StatusBadge'

const ROLE_LABEL: Record<string, string> = {
	departmentHead: 'ຫົວໜ້າພະແນກ',
	hr: 'HR',
	manager: 'ຜູ້ຈັດການ',
}

// Bug #1 fixed: removed inverted early-return — now correctly finds pending approvers
function getWhoPending(approvals?: { role: string; decision: string }[]): string | null {
	if (!Array.isArray(approvals)) return null
	const pending = approvals
		.filter(a => a?.decision === 'pending')
		.map(a => ROLE_LABEL[a.role] ?? a.role)
	return pending.length > 0 ? pending.join(', ') : null
}

// Bug #2 fixed: same inverted early-return removed
function getWhoRejected(approvals?: { role: string; decision: string }[]): string | null {
	if (!Array.isArray(approvals)) return null
	const rejected = approvals
		.filter(a => a?.decision === 'rejected')
		.map(a => ROLE_LABEL[a.role] ?? a.role)
	return rejected.length > 0 ? rejected.join(', ') : null
}
export type OffsiteTableItem = {
	id: string
	name: string
	position?: string
	department?: string
	reason?: string
	successor?: string
	startDate: string
	endDate: string
	status?: 'pending' | 'approved' | 'rejected' | 'cancelled'
	approvals?: { role: string; decision: string }[]
}

type OffsiteTableProps = {
	data: OffsiteTableItem[]
	onViewDetail?: (item: OffsiteTableItem) => void
	onApprove?: (item: OffsiteTableItem) => void
	onReject?: (item: OffsiteTableItem) => void
	canApproveBranch?: boolean
	currentUserRole?: string   // e.g. 'departmentHead' | 'hr' | 'manager'
	className?: string
}

/** @deprecated use OffsiteTableItem */
export type LeaveTableItem = OffsiteTableItem

type TabValue = 'all' | 'pending' | 'inprogress' | 'rejected'

const TABS: { value: TabValue; label: string }[] = [
	{ value: 'all',        label: 'ທັງໝົດ' },
	{ value: 'pending',    label: 'ລໍຖ້າ' },
	{ value: 'inprogress', label: 'ດຳເນີນການ' },
	{ value: 'rejected',   label: 'ປະຕິເສດ' },
]

function computeRowMeta(item: OffsiteTableItem, currentUserRole?: string) {
	// Bug #3 fixed: correct fallback is [] not [item.approvals].filter(Boolean)
	const approvals = Array.isArray(item.approvals) ? item.approvals : []

	const isFinal =
		item.status === 'approved' ||
		item.status === 'rejected' ||
		item.status === 'cancelled'

	// Bug #1 fixed: restore canApprove logic (was fully commented out → always false)
	let canApprove = false
	if (!isFinal) {
		if (currentUserRole) {
			// Hide button the moment THIS user's slot is no longer 'pending'
			// (approve → 'approved', reject → 'rejected' → button gone instantly)
			const mySlot = approvals.find(a => a.role === currentUserRole)
			canApprove = mySlot?.decision === 'pending'
		} else {
			// No role context: show button while the first slot is still pending
			canApprove = approvals[0]?.decision === 'pending'
		}
	}

	// Bug #2 fixed: pass normalised `approvals` instead of raw item.approvals
	const whoPending  = getWhoPending(approvals)
	const whoRejected = getWhoRejected(approvals)
	return { canApprove, whoPending, whoRejected }
}

function tabMatch(item: OffsiteTableItem, tab: TabValue): boolean {
	const approvals = item.approvals ?? []
	if (tab === 'pending') {
		// Waiting for the very first decision — all approvers still pending
		return approvals.length > 0 && approvals.every(a => a.decision === 'pending')
	}
	if (tab === 'inprogress') {
		// Bug #4 fixed: at least one approved AND at least one still pending (not rejected/done)
		return (
			item.status !== 'rejected' &&
			item.status !== 'approved' &&
			item.status !== 'cancelled' &&
			approvals.some(a => a.decision === 'approved') &&
			approvals.some(a => a.decision === 'pending')
		)
	}
	if (tab === 'rejected') return item.status === 'rejected'
	return true
}

function MemberPills({ value }: { value?: string }) {
	if (!value || value === '-') return <span className="text-sm text-muted-foreground">-</span>

	const names = value.split(', ').filter(Boolean)
	const shown = names.slice(0, 2)
	const extra = names.length - shown.length

	return (
		<div className="flex flex-wrap gap-1">
			{shown.map((name) => (
				<span
					key={name}
					className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground max-w-[100px] truncate"
					title={name}
				>
					{name}
				</span>
			))}
			{extra > 0 && (
				<span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
					+{extra}
				</span>
			)}
		</div>
	)
}

export default function OffsiteTable({
	data,
	onViewDetail,
	onApprove,
	onReject,
	canApproveBranch = false,
	currentUserRole,
	className,
}: OffsiteTableProps) {
	const [activeTab, setActiveTab] = useState<TabValue>('all')
	const [deptFilter, setDeptFilter] = useState('all')

	const departments = useMemo(() => {
		const set = new Set<string>()
		data.forEach(item => { if (item.department) set.add(item.department) })
		return Array.from(set).sort()
	}, [data])

	const counts = useMemo(() => {
		const base = canApproveBranch && deptFilter !== 'all'
			? data.filter(i => i.department === deptFilter)
			: data
		return {
			all:        base.length,
			pending:    base.filter(i => tabMatch(i, 'pending')).length,
			inprogress: base.filter(i => tabMatch(i, 'inprogress')).length,
			rejected:   base.filter(i => tabMatch(i, 'rejected')).length,
		}
	}, [data, deptFilter, canApproveBranch])

	const filtered = useMemo(() => {
		let result = data
		if (canApproveBranch && deptFilter !== 'all') result = result.filter(i => i.department === deptFilter)
		if (activeTab !== 'all') result = result.filter(i => tabMatch(i, activeTab))
		return result
	}, [data, activeTab, deptFilter, canApproveBranch])

	return (
		<Card className={className}>
			{/* Filter bar */}
			<div className="border-b px-4 pt-3 pb-0 space-y-3">
				{/* Dept filter — branch approvers only */}
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

				{/* Status tabs */}
				<div className="flex gap-0 overflow-x-auto">
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

			<CardContent className="p-0">
				{filtered.length === 0 ? (
					<div className="py-12 text-center text-sm text-muted-foreground">
						ບໍ່ມີລາຍການ
					</div>
				) : (
					<>
						{/* Mobile cards */}
						<div className="space-y-3 p-3 md:hidden">
							{filtered.map((item, index) => {
								const { canApprove, whoPending, whoRejected } = computeRowMeta(item, currentUserRole)

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
													{item.status === 'rejected' && whoRejected && (
														<span className="text-[10px] text-destructive">{whoRejected}</span>
													)}
												</div>
											</div>

											{item.reason && (
												<p className="text-sm text-foreground leading-5 line-clamp-2">{item.reason}</p>
											)}

											<div className="flex items-center gap-2 text-xs text-muted-foreground">
												<CalendarRange className="h-3.5 w-3.5 shrink-0" />
												<span>{item.startDate} – {item.endDate}</span>
											</div>

											{item.successor && item.successor !== '-' && (
												<div className="flex items-start gap-1.5">
													<Users className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
													<MemberPills value={item.successor} />
												</div>
											)}

											<div className="flex gap-2 pt-1">
												<Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => onViewDetail?.(item)}>
													<Eye className="h-3.5 w-3.5 mr-1" />
													ລາຍລະອຽດ
												</Button>
												{canApprove && (
													<>
														<Button type="button" size="sm" className="flex-1" onClick={() => onApprove?.(item)}>
															<Check className="h-3.5 w-3.5 mr-1" />
															ອະນຸມັດ
														</Button>
														<Button type="button" variant="destructive" size="sm" className="flex-1" onClick={() => onReject?.(item)}>
															<X className="h-3.5 w-3.5 mr-1" />
															ປະຕິເສດ
														</Button>
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
										<TableHead className="px-4 min-w-[120px]">ວັນທີ</TableHead>
										<TableHead className="px-4 min-w-[140px]">ສະມາຊິກ</TableHead>
										<TableHead className="px-4 w-28">ສະຖານະ</TableHead>
										<TableHead className="px-4 w-12 text-right">...</TableHead>
									</TableRow>
								</TableHeader>

								<TableBody>
									{filtered.map((item, index) => {
										const { canApprove, whoPending, whoRejected } = computeRowMeta(item, currentUserRole)
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
												</TableCell>

												<TableCell className="px-4 py-3 whitespace-nowrap">
													<div className="flex items-center gap-1 text-xs text-muted-foreground">
														<CalendarRange className="h-3 w-3 shrink-0" />
														<span>{item.startDate} – {item.endDate}</span>
													</div>
												</TableCell>

												<TableCell className="px-4 py-3">
													<MemberPills value={item.successor} />
												</TableCell>

												<TableCell className="px-4 py-3">
													<div className="flex flex-col gap-0.5">
														<StatusBadge status={item.status ?? 'pending'} />
														{item.status === 'pending' && whoPending && (
															<span className="text-[10px] text-muted-foreground">{whoPending}</span>
														)}
														{item.status === 'rejected' && whoRejected && (
															<span className="text-[10px] text-destructive">{whoRejected}</span>
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
															<DropdownMenuItem onClick={() => onViewDetail?.(item)}>
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
																	<DropdownMenuItem
																		onClick={() => onReject?.(item)}
																		className="text-destructive focus:text-destructive"
																	>
																		<X className="h-4 w-4 mr-2" />
																		ປະຕິເສດ
																	</DropdownMenuItem>
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
