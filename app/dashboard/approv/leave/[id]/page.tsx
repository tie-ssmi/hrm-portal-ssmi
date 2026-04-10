import LeaveDetailClient from './leave-detail-client'

const leaveIds = ['L-001', 'L-002', 'L-003', 'L-004', 'L-005', 'L-006', 'L-007', 'L-008', 'L-009', 'L-010']

export function generateStaticParams() {
	return leaveIds.map((id) => ({ id }))
}

export default async function LeaveDetailPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params

	return <LeaveDetailClient leaveId={id} />
}