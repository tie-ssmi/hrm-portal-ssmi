'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import FormsSkeleton from '@/components/skeletons/formsSkeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Palmtree, MapPin } from 'lucide-react'
import LeaveTable from '@/components/leaveTable'
import OffsiteTable from '@/components/offSiteTable'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
const demoLeaveData = [{
  "id": "L-001",
  "name": "SINA AI",
  "department": "IT",
  "successor": "Admin",
  "startDate": "2026-04-01",
  "endDate": "2026-04-01",
  "reason": "System Optimization",
  "position": "Virtual Assistant",
  "note": "Official rebranding from Nong Khai complete",
  "type": { "id": "01", "name": "Annual Leave" }
},
{
  "id": "L-002",
  "name": "Marcus Holloway",
  "department": "IT",
  "successor": "Victor Stone",
  "startDate": "2026-04-05",
  "endDate": "2026-04-07",
  "reason": "Security Conference",
  "position": "Network Sec",
  "note": "Available on SINA chat for emergencies",
  "type": { "id": "01", "name": "Annual Leave" }
},
{
  "id": "L-003",
  "name": "Lara Croft",
  "department": "Research",
  "successor": "Indiana Jones",
  "startDate": "2026-04-10",
  "endDate": "2026-04-15",
  "reason": "Expedition",
  "position": "Lead Researcher",
  "note": "Satellite phone only",
  "type": { "id": "05", "name": "Unpaid Leave" }
},
{
  "id": "L-004",
  "name": "Barry Allen",
  "department": "IT",
  "successor": "Iris West",
  "startDate": "2026-04-12",
  "endDate": "2026-04-12",
  "reason": "Personal errand",
  "position": "Forensics",
  "note": "Back in a flash (literally)",
  "type": { "id": "02", "name": "Sick Leave" }
},
{
  "id": "L-005",
  "name": "Walter White",
  "department": "R&D",
  "successor": "Jesse Pinkman",
  "startDate": "2026-04-14",
  "endDate": "2026-04-16",
  "reason": "Health checkup",
  "position": "Chemist",
  "note": "Jesse knows the protocol",
  "type": { "id": "02", "name": "Sick Leave" }
},
{
  "id": "L-006",
  "name": "Natasha Romanoff",
  "department": "Security",
  "successor": "Clint Barton",
  "startDate": "2026-04-18",
  "endDate": "2026-04-18",
  "reason": "Offsite training",
  "position": "Specialist",
  "note": "Budapest assignment",
  "type": { "id": "01", "name": "Annual Leave" }
},
{
  "id": "L-007",
  "name": "Jim Halpert",
  "department": "Sales",
  "successor": "Dwight Schrute",
  "startDate": "2026-04-20",
  "endDate": "2026-04-24",
  "reason": "Family trip",
  "position": "Sales Rep",
  "note": "Please don't let Dwight touch my desk",
  "type": { "id": "01", "name": "Annual Leave" }
},
{
  "id": "L-008",
  "name": "Din Djarin",
  "department": "Logistics",
  "successor": "Bo-Katan",
  "startDate": "2026-04-25",
  "endDate": "2026-04-26",
  "reason": "Vehicle maintenance",
  "position": "Fleet Driver",
  "note": "Razor Crest in the shop",
  "type": { "id": "01", "name": "Annual Leave" }
},
{
  "id": "L-009",
  "name": "Ted Lasso",
  "department": "HR",
  "successor": "Beard",
  "startDate": "2026-04-28",
  "endDate": "2026-04-28",
  "reason": "Mental health",
  "position": "Coach",
  "note": "Believe!",
  "type": { "id": "02", "name": "Sick Leave" }
},
{
  "id": "L-010",
  "name": "Master Chief",
  "department": "Security",
  "successor": "Cortana",
  "startDate": "2026-04-29",
  "endDate": "2026-05-02",
  "reason": "System Update",
  "position": "Chief",
  "note": "Finishing the fight",
  "type": { "id": "01", "name": "Annual Leave" }
}]

const demoOffsiteData = [
  {
    id: 'OS-001',
    name: 'ນາງ ຈັນສະໝອນ ອິນທະວົງ',
    position: 'Sales Executive',
    department: 'Sales',
    reason: 'ເຂົ້າພົບລູກຄ້າປະຈໍາເດືອນ',
    successor: 'ທ້າວ ຄໍາແພງ ແກ້ວສະຫວັດ',
    startDate: '2026-04-14',
    endDate: '2026-04-14',
    status: 'pending' as const,
  },
  {
    id: 'OS-002',
    name: 'ທ້າວ ວິຊານ ສຸວັນນະວົງ',
    position: 'HR Officer',
    department: 'HR',
    reason: 'ອອກໄປສໍາພາດພະນັກງານໃໝ່',
    successor: 'ນາງ ກິດສະດາ ອິນທະລາ',
    startDate: '2026-04-16',
    endDate: '2026-04-16',
    status: 'approved' as const,
  },
]

export default function ApprovePage() {
  const router = useRouter()
  const { isLoading } = useAuth()
  const leave = demoLeaveData.length
  const workOutSide = demoOffsiteData.length
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const handleConfirmLeaveChange = (checked: boolean | 'indeterminate') => {
    setConfirmLeave(checked === true)
  }

  const handleDialogOpenChange = (open: boolean) => {
    setOpenConfirmDialog(open)
    if (!open) {
      setConfirmLeave(false)
    }
  }


  if (isLoading) {
    return <FormsSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Request Forms</h1>
        <p className="text-muted-foreground">Submit leave and off-site work requests</p>
      </div>

      {/* Leave Balance Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-chart-2/20 bg-chart-2/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Palmtree className="h-3.5 w-3.5 text-chart-2" />
              leave
            </p>
            <p className="text-lg font-bold text-foreground">{leave} list</p>
          </CardContent>
        </Card>
        <Card className="border-chart-1/20 bg-chart-1/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-chart-1" />
              offsite
            </p>
            <p className="text-lg font-bold text-foreground">{workOutSide} list</p>
          </CardContent>
        </Card>

      </div>

      {/* Forms Tabs */}
      <Tabs defaultValue="leave" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="leave" className="gap-2">
            <Palmtree className="w-4 h-4" />
            ລາຍການຂໍລາພັກ
          </TabsTrigger>
          <TabsTrigger value="offsite" className="gap-2">
            <MapPin className="w-4 h-4" />
            ລາຍການອອກວຽກນອກ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leave" className="mt-4">
          <div className='w-full flex justify-end mb-4'>
           <Button onClick={() => router.push('/dashboard/approv/leave/instead')}>ລາພັກແທນ</Button>
          
          
          
          
          </div>
          <LeaveTable data={demoLeaveData} />
        </TabsContent>

        <TabsContent value="offsite" className="mt-4">
          
          <OffsiteTable data={demoOffsiteData} />
        </TabsContent>
      </Tabs>
    </div>
  )
}