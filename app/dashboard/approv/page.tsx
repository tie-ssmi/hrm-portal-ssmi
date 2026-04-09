'use client'

import { useAuth } from '@/lib/auth-context'
import FormsSkeleton from '@/components/skeletons/formsSkeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Palmtree, MapPin } from 'lucide-react'
import LeaveTable from '@/components/leaveTable'
import OffsiteTable from '@/components/offSiteTable'

const demoLeaveData = [
  {
    id: 'LV-001',
    name: 'ທ້າວ ສົມພອນ ພັນດາລາ',
    position: 'IT Support',
    department: 'IT',
    reason: 'ພັກຜ່ອນກັບຄອບຄົວ',
    successor: 'ນາງ ມະລີ ຈັນທະວົງ',
    startDate: '2026-04-18',
    endDate: '2026-04-20',
    status: 'pending' as const,
  },
  {
    id: 'LV-002',
    name: 'ນາງ ພອນພິມ ສີຫາລາດ',
    position: 'Accountant',
    department: 'Finance',
    reason: 'ຕິດຕໍ່ເອກະສານສ່ວນຕົວ',
    successor: 'ທ້າວ ອານຸພົງ ສີວົງ',
    startDate: '2026-04-22',
    endDate: '2026-04-22',
    status: 'approved' as const,
  },
  {
    id: 'LV-003',
    name: 'ທ້າວ ອາລຸນ ໄຊຍະລາດ',
    position: 'Store Officer',
    department: 'Operation',
    reason: 'ໄປຮັກສາສຸຂະພາບ',
    successor: 'ນາງ ນິດດາ ວິໄລ',
    startDate: '2026-04-25',
    endDate: '2026-04-26',
    status: 'rejected' as const,
  },
]

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
  const { isLoading } = useAuth()
  const leave = demoLeaveData.length
  const workOutSide = demoOffsiteData.length

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
          <LeaveTable data={demoLeaveData} />
        </TabsContent>

        <TabsContent value="offsite" className="mt-4">
          <OffsiteTable data={demoOffsiteData} />
        </TabsContent>
      </Tabs>
    </div>
  )
}