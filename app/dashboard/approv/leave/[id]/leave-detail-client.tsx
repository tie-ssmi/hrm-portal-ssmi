'use client'

import { useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
	ArrowLeft,
	Briefcase,
	Building2,
	CalendarRange,
	CirclePlus,
	FileText,
	NotebookPen,
	ShieldUser,
	Tag,
	UserRound,
} from 'lucide-react'

type LeaveType = {
	id: string
	name: string
}

type LeaveDetail = {
	id: string
	name: string
	department: string
	successor: string
	startDate: string
	endDate: string
	reason: string
	position: string
	note: string
	type: LeaveType
}

const leaveDetails: LeaveDetail[] = [
	{
		id: 'L-001',
		name: 'SINA AI',
		department: 'IT',
		successor: 'Admin',
		startDate: '2026-04-01',
		endDate: '2026-04-01',
		reason: 'System Optimization',
		position: 'Virtual Assistant',
		note: 'Official rebranding from Nong Khai complete',
		type: { id: '01', name: 'Annual Leave' },
	},
	{
		id: 'L-002',
		name: 'Marcus Holloway',
		department: 'IT',
		successor: 'Victor Stone',
		startDate: '2026-04-05',
		endDate: '2026-04-07',
		reason: 'Security Conference',
		position: 'Network Sec',
		note: 'Available on SINA chat for emergencies',
		type: { id: '01', name: 'Annual Leave' },
	},
	{
		id: 'L-003',
		name: 'Lara Croft',
		department: 'Research',
		successor: 'Indiana Jones',
		startDate: '2026-04-10',
		endDate: '2026-04-15',
		reason: 'Expedition',
		position: 'Lead Researcher',
		note: 'Satellite phone only',
		type: { id: '05', name: 'Unpaid Leave' },
	},
	{
		id: 'L-004',
		name: 'Barry Allen',
		department: 'IT',
		successor: 'Iris West',
		startDate: '2026-04-12',
		endDate: '2026-04-12',
		reason: 'Personal errand',
		position: 'Forensics',
		note: 'Back in a flash (literally)',
		type: { id: '02', name: 'Sick Leave' },
	},
	{
		id: 'L-005',
		name: 'Walter White',
		department: 'R&D',
		successor: 'Jesse Pinkman',
		startDate: '2026-04-14',
		endDate: '2026-04-16',
		reason: 'Health checkup',
		position: 'Chemist',
		note: 'Jesse knows the protocol',
		type: { id: '02', name: 'Sick Leave' },
	},
	{
		id: 'L-006',
		name: 'Natasha Romanoff',
		department: 'Security',
		successor: 'Clint Barton',
		startDate: '2026-04-18',
		endDate: '2026-04-18',
		reason: 'Offsite training',
		position: 'Specialist',
		note: 'Budapest assignment',
		type: { id: '01', name: 'Annual Leave' },
	},
	{
		id: 'L-007',
		name: 'Jim Halpert',
		department: 'Sales',
		successor: 'Dwight Schrute',
		startDate: '2026-04-20',
		endDate: '2026-04-24',
		reason: 'Family trip',
		position: 'Sales Rep',
		note: "Please don't let Dwight touch my desk",
		type: { id: '01', name: 'Annual Leave' },
	},
	{
		id: 'L-008',
		name: 'Din Djarin',
		department: 'Logistics',
		successor: 'Bo-Katan',
		startDate: '2026-04-25',
		endDate: '2026-04-26',
		reason: 'Vehicle maintenance',
		position: 'Fleet Driver',
		note: 'Razor Crest in the shop',
		type: { id: '01', name: 'Annual Leave' },
	},
	{
		id: 'L-009',
		name: 'Ted Lasso',
		department: 'HR',
		successor: 'Beard',
		startDate: '2026-04-28',
		endDate: '2026-04-28',
		reason: 'Mental health',
		position: 'Coach',
		note: 'Believe!',
		type: { id: '02', name: 'Sick Leave' },
	},
	{
		id: 'L-010',
		name: 'Master Chief',
		department: 'Security',
		successor: 'Cortana',
		startDate: '2026-04-29',
		endDate: '2026-05-02',
		reason: 'System Update',
		position: 'Chief',
		note: 'Finishing the fight',
		type: { id: '01', name: 'Annual Leave' },
	},
]

function Field({
	label,
	value,
	icon,
}: {
	label: string
	value: string
	icon: React.ReactNode
}) {
	return (
		<div className="rounded-lg border bg-card p-3">
			<div className="mb-1.5 inline-flex items-center gap-2 text-xs text-muted-foreground">
				{icon}
				<span>{label}</span>
			</div>
			<p className="text-sm font-medium text-foreground">{value}</p>
		</div>
	)
}

export default function LeaveDetailClient({ leaveId }: { leaveId?: string }) {
	const router = useRouter()
	const searchParams = useSearchParams()
	const id = leaveId || searchParams.get('id') || ''

	const detail = useMemo(() => {
		const queryName = searchParams.get('name')

		if (queryName) {
			return {
				id,
				name: queryName,
				department: searchParams.get('department') || '-',
				successor: searchParams.get('successor') || '-',
				startDate: searchParams.get('startDate') || '-',
				endDate: searchParams.get('endDate') || '-',
				reason: searchParams.get('reason') || '-',
				position: searchParams.get('position') || '-',
				note: searchParams.get('note') || '-',
				type: {
					id: searchParams.get('typeId') || '-',
					name: searchParams.get('typeName') || 'Leave',
				},
			}
		}

		return leaveDetails.find((item) => item.id.toLowerCase() === id.toLowerCase())
	}, [leaveId, searchParams])

	if (!detail) {
		return (
			<div className="space-y-4">
				<Button type="button" variant="outline" size="sm" onClick={() => router.back()}>
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back
				</Button>
				<Card>
					<CardContent className="py-12 text-center">
						<p className="text-lg font-semibold">Leave not found</p>
						<p className="mt-1 text-sm text-muted-foreground">Try one of: L-001 to L-010</p>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="space-y-6 pb-8">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p className="text-sm text-muted-foreground">Leave Request Detail</p>
					<h1 className="text-2xl font-bold leading-tight">{detail.name}</h1>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<Badge variant="secondary" className="px-2.5 py-1">
						Type {detail.type.id}
					</Badge>
					<Badge variant="outline" className="px-2.5 py-1">
						{detail.type.name}
					</Badge>
					<Button type="button" size="sm" onClick={() => router.push('/dashboard/request')}>
						<CirclePlus className="mr-2 h-4 w-4" />
						Add New
					</Button>
				</div>
			</div>

			<Card className="border-primary/20 bg-gradient-to-b from-primary/5 via-background to-background">
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between gap-3">
						<div>
							<CardTitle className="text-lg">{detail.position}</CardTitle>
							<CardDescription>{detail.department}</CardDescription>
						</div>
						<div className="flex items-center gap-2">
							<Button type="button" variant="outline" size="sm" onClick={() => router.back()}>
								<ArrowLeft className="mr-2 h-4 w-4" />
								Back
							</Button>
							<Button type="button" size="sm" onClick={() => router.push('/dashboard/request')}>
								<CirclePlus className="mr-2 h-4 w-4" />
								Add New
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						<Field label="Employee" value={detail.name} icon={<UserRound className="h-3.5 w-3.5" />} />
						<Field label="Department" value={detail.department} icon={<Building2 className="h-3.5 w-3.5" />} />
						<Field label="Position" value={detail.position} icon={<Briefcase className="h-3.5 w-3.5" />} />
						<Field label="Successor" value={detail.successor} icon={<ShieldUser className="h-3.5 w-3.5" />} />
						<Field label="Start Date" value={detail.startDate} icon={<CalendarRange className="h-3.5 w-3.5" />} />
						<Field label="End Date" value={detail.endDate} icon={<CalendarRange className="h-3.5 w-3.5" />} />
					</div>

					<Separator />

					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						<div className="rounded-lg border p-4">
							<p className="mb-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
								<FileText className="h-3.5 w-3.5" />
								Reason
							</p>
							<p className="text-sm leading-6">{detail.reason}</p>
						</div>

						<div className="rounded-lg border p-4">
							<p className="mb-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
								<NotebookPen className="h-3.5 w-3.5" />
								Note
							</p>
							<p className="text-sm leading-6">{detail.note}</p>
						</div>
					</div>

					<div className="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
						<Tag className="mr-1 inline h-3.5 w-3.5" />
						ID: {detail.id}
					</div>
				</CardContent>
			</Card>
		</div>
	)
}