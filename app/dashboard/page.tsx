'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useHRM } from '@/lib/hrm-context'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import HomeSkeleton from '@/components/skeletons/homeSkeleton'
import { fetchPoliciesForGender } from '@/services/policies'
import type { LeaveData } from '@/types/employee'
import {
  Calendar,
  Clock,
  AlertTriangle,
  DollarSign,
  Briefcase,
  HeartPulse,
  MapPinX,
  ChevronDown,
} from 'lucide-react'
import { format } from 'date-fns'
import { lo } from 'date-fns/locale'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { CheckInToday, ToDay } from '@/components/leaveLists'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import type { PolicyRecord } from '@/lib/types'

const VISIBLE_COUNT = 3

function PolicyRow({ policy, used }: { policy: PolicyRecord; used: number }) {
  const total = policy.days ?? 0
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-chart-2" />
          {policy.name || policy.requestType}
        </span>
        <span className="text-muted-foreground">{used} / {total} ວັນ</span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  )
}

function PolicyList({
  policies,
  usedByPolicy,
}: {
  policies: PolicyRecord[]
  usedByPolicy: Map<string, number>
}) {
  const [open, setOpen] = useState(false)
  const visible = policies.slice(0, VISIBLE_COUNT)
  const hidden  = policies.slice(VISIBLE_COUNT)
  const hasMore = hidden.length > 0

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-4">
      {visible.map(policy => (
        <PolicyRow
          key={policy.uuid ?? policy.id}
          policy={policy}
          used={usedByPolicy.get(policy.uuid ?? '') ?? usedByPolicy.get(policy.id) ?? 0}
        />
      ))}

      {hasMore && (
        <>
          <CollapsibleContent className="space-y-4">
            {hidden.map(policy => (
              <PolicyRow
                key={policy.uuid ?? policy.id}
                policy={policy}
                used={usedByPolicy.get(policy.uuid ?? '') ?? usedByPolicy.get(policy.id) ?? 0}
              />
            ))}
          </CollapsibleContent>

          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full gap-1 text-xs text-muted-foreground">
              <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
              {open ? 'ຫຍໍ້ລົງ' : `ເບິ່ງທັງໝົດ (${hidden.length} ລາຍການ)`}
            </Button>
          </CollapsibleTrigger>
        </>
      )}
    </Collapsible>
  )
}

export default function DashboardPage() {
  const { user, isLoading } = useAuth()
  const { leaveBalance, lateRecords, totalFines, leaveRequests, todayAttendance } = useHRM()
  const router = useRouter()
  console.log('gender:', user?.gender)

  const { data: policies = [] } = useQuery({
    queryKey: ['policies', 'gender', user?.gender ?? null],
    queryFn: () => fetchPoliciesForGender(user?.gender),
    enabled: !!user,
  })

  // used days per policy UUID or ID (approved leaves only)
  const usedByPolicy = useMemo(() => {
    const map = new Map<string, number>()
    leaveRequests.forEach(req => {
      if (req.status !== 'approved') return
      const key = req.policyUuid || req.policyId
      if (!key) return
      map.set(key, (map.get(key) ?? 0) + (req.duration ?? 1))
    })
    return map
  }, [leaveRequests])

  if (isLoading) {
    return <HomeSkeleton />
  }

  // Keep stat cards working: derive totals from the matching policy types
  const annualPolicy = policies.find(p => p.requestType === 'annual')
  const sickPolicy   = policies.find(p => p.requestType === 'sick')

  const effectiveLeaveBalance = {
    ...leaveBalance,
    annual:   annualPolicy?.days ?? leaveBalance.annual,
    sick:     sickPolicy?.days   ?? leaveBalance.sick,
    personal: leaveBalance.personal,
  }

  const sickRemaining = effectiveLeaveBalance.sick - leaveBalance.sickUsed

  const recentLeaves = leaveRequests.slice(0, 3)
  const leaveData: LeaveData[] = [
    { "name": "Alice Johnson", "department": "Engineering", "successor": "Bob Smith", "startDate": "2026-02-01", "endDate": "2026-02-01", "reason": "Personal errands", "position": "Senior Dev", "note": "Reachable via Slack", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Mark Davis", "department": "Marketing", "successor": "Sarah Lee", "startDate": "2026-02-02", "endDate": "2026-02-05", "reason": "Family vacation", "position": "Manager", "note": "Overseeing campaign launch", "type": { "id": "02", "name": "Sick Leave" } },
    { "name": "Chloe Chen", "department": "HR", "successor": "James Wilson", "startDate": "2026-02-03", "endDate": "2026-02-03", "reason": "Doctor appointment", "position": "Generalist", "note": "Half day morning", "type": { "id": "03", "name": "Maternity Leave" } },
    { "name": "David Miller", "department": "Sales", "successor": "Emma Brown", "startDate": "2026-02-04", "endDate": "2026-02-08", "reason": "Rest and recovery", "position": "Executive", "note": "Handed over current leads", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Elena Rodriguez", "department": "Design", "successor": "Tom Hardy", "startDate": "2026-02-05", "endDate": "2026-02-05", "reason": "Home maintenance", "position": "UI Designer", "note": "Emergency plumbing", "type": { "id": "04", "name": "Paternity Leave" } },
    { "name": "Frank Wright", "department": "Support", "successor": "Grace Hopper", "startDate": "2026-02-06", "endDate": "2026-02-09", "reason": "Travel", "position": "Support Lead", "note": "Back on Friday", "type": { "id": "05", "name": "Unpaid Leave" } },
    { "name": "Gina Kim", "department": "Finance", "successor": "Harry Potter", "startDate": "2026-02-07", "endDate": "2026-02-07", "reason": "Wedding attendance", "position": "Accountant", "note": "Approved by CFO", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Ian Somer", "department": "Engineering", "successor": "Alice Johnson", "startDate": "2026-02-08", "endDate": "2026-02-11", "reason": "Fever", "position": "Junior Dev", "note": "Medical certificate attached", "type": { "id": "02", "name": "Sick Leave" } },
    { "name": "Julia Roberts", "department": "Legal", "successor": "Kevin Hart", "startDate": "2026-02-09", "endDate": "2026-02-09", "reason": "Renewal of ID", "position": "Counsel", "note": "Away for 4 hours", "type": { "id": "05", "name": "Unpaid Leave" } },
    { "name": "Leo Messi", "department": "Sports Ops", "successor": "Neymar Jr", "startDate": "2026-02-10", "endDate": "2026-02-14", "reason": "Tournament travel", "position": "Captain", "note": "National duty", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Monica Geller", "department": "Operations", "successor": "Rachel Green", "startDate": "2026-02-11", "endDate": "2026-02-11", "reason": "Catering event", "position": "Chef", "note": "Kitchen managed by Rachel", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Nathan Drake", "department": "IT", "successor": "Elena Fisher", "startDate": "2026-02-12", "endDate": "2026-02-16", "reason": "Hiking trip", "position": "SysAdmin", "note": "No signal area", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Olivia Pope", "department": "PR", "successor": "Quinn Perkins", "startDate": "2026-02-13", "endDate": "2026-02-13", "reason": "Client meeting", "position": "Director", "note": "Will return by EOD", "type": { "id": "05", "name": "Unpaid Leave" } },
    { "name": "Peter Parker", "department": "Photography", "successor": "Mary Jane", "startDate": "2026-02-14", "endDate": "2026-02-16", "reason": "Family emergency", "position": "Staff Photographer", "note": "Urgent leave", "type": { "id": "02", "name": "Sick Leave" } },
    { "name": "Quentin Tarantino", "department": "Production", "successor": "Uma Thurman", "startDate": "2026-02-15", "endDate": "2026-02-15", "reason": "Script review", "position": "Director", "note": "Offsite work", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Riley Reid", "department": "Social Media", "successor": "Chris Evans", "startDate": "2026-02-16", "endDate": "2026-02-20", "reason": "Short break", "position": "Influencer", "note": "Scheduling posts ahead", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Steve Rogers", "department": "Security", "successor": "Bucky Barnes", "startDate": "2026-02-17", "endDate": "2026-02-17", "reason": "Volunteer work", "position": "Chief", "note": "Bucky is in charge", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Tina Fey", "department": "Content", "successor": "Amy Poehler", "startDate": "2026-02-18", "endDate": "2026-02-22", "reason": "Writing retreat", "position": "Writer", "note": "Developing new sketches", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Ursula Corbero", "department": "Sales", "successor": "Alvaro Morte", "startDate": "2026-02-19", "endDate": "2026-02-19", "reason": "Dental checkup", "position": "Sales Manager", "note": "Back in 2 hours", "type": { "id": "02", "name": "Sick Leave" } },
    { "name": "Victor Stone", "department": "IT", "successor": "Barry Allen", "startDate": "2026-02-20", "endDate": "2026-02-24", "reason": "Tech conference", "position": "DevOps", "note": "Attending AWS Summit", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Wanda Maximoff", "department": "R&D", "successor": "Vision", "startDate": "2026-02-21", "endDate": "2026-02-21", "reason": "Mental health day", "position": "Researcher", "note": "Switching off", "type": { "id": "02", "name": "Sick Leave" } },
    { "name": "Xavier Renegade", "department": "Philosophy", "successor": "Socrates", "startDate": "2026-02-22", "endDate": "2026-02-26", "reason": "Soul searching", "position": "Lead Thinker", "note": "Not reachable", "type": { "id": "05", "name": "Unpaid Leave" } },
    { "name": "Yara Greyjoy", "department": "Logistics", "successor": "Theon Greyjoy", "startDate": "2026-02-23", "endDate": "2026-02-23", "reason": "Family gathering", "position": "Fleet Manager", "note": "Back tomorrow", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Zane Gray", "department": "Engineering", "successor": "Yuri Boyka", "startDate": "2026-02-24", "endDate": "2026-02-28", "reason": "Exhaustion", "position": "Lead Dev", "note": "Needs rest", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Arthur Curry", "department": "Environment", "successor": "Mera", "startDate": "2026-02-25", "endDate": "2026-02-25", "reason": "Ocean cleanup", "position": "Advocate", "note": "Field work", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Bruce Wayne", "department": "Executive", "successor": "Alfred", "startDate": "2026-02-26", "endDate": "2026-03-02", "reason": "Charity gala", "position": "CEO", "note": "Contact Alfred", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Clark Kent", "department": "Editorial", "successor": "Lois Lane", "startDate": "2026-02-27", "endDate": "2026-02-27", "reason": "Interview", "position": "Reporter", "note": "Filing story remotely", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Diana Prince", "department": "Museum", "successor": "Steve Trevor", "startDate": "2026-02-28", "endDate": "2026-03-04", "reason": "Artifact research", "position": "Curator", "note": "In the archives", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Edward Stark", "department": "Admin", "successor": "Robb Stark", "startDate": "2026-03-01", "endDate": "2026-03-01", "reason": "Winter prep", "position": "Head of House", "note": "Short leave", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Fiona Gallagher", "department": "Operations", "successor": "Lip", "startDate": "2026-03-02", "endDate": "2026-03-05", "reason": "Family issues", "position": "Supervisor", "note": "Urgent", "type": { "id": "05", "name": "Unpaid Leave" } },
    { "name": "George Weasley", "department": "Sales", "successor": "Fred", "startDate": "2026-03-03", "endDate": "2026-03-03", "reason": "Product testing", "position": "Co-owner", "note": "Joke shop duties", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Hermione Granger", "department": "Education", "successor": "Ron", "startDate": "2026-03-04", "endDate": "2026-03-05", "reason": "Library visit", "position": "Librarian", "note": "Studying hard", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Iris West", "department": "Media", "successor": "Barry", "startDate": "2026-03-05", "endDate": "2026-03-05", "reason": "Photography gig", "position": "Journalist", "note": "Freelance day", "type": { "id": "05", "name": "Unpaid Leave" } },
    { "name": "Jack Sparrow", "department": "Logistics", "successor": "Will", "startDate": "2026-03-09", "endDate": "2026-03-10", "reason": "Ship repair", "position": "Captain", "note": "At the docks", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Katniss Everdeen", "department": "Security", "successor": "Peeta", "startDate": "2026-03-07", "endDate": "2026-03-07", "reason": "Hunting trip", "position": "Specialist", "note": "District 12 trip", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Luke Skywalker", "department": "Training", "successor": "Rey", "startDate": "2026-03-08", "endDate": "2026-03-12", "reason": "Meditation", "position": "Master", "note": "On Ahch-To", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Marty McFly", "department": "Engineering", "successor": "Doc Brown", "startDate": "2026-03-09", "endDate": "2026-03-09", "reason": "Time conflict", "position": "Tester", "note": "Back to the future", "type": { "id": "05", "name": "Unpaid Leave" } },
    { "name": "Neo", "department": "IT", "successor": "Trinity", "startDate": "2026-03-10", "endDate": "2026-03-14", "reason": "System reboot", "position": "The One", "note": "Unplugging", "type": { "id": "02", "name": "Sick Leave" } },
    { "name": "Optimus Prime", "department": "Transport", "successor": "Bumblebee", "startDate": "2026-03-11", "endDate": "2026-03-11", "reason": "Maintenance", "position": "Leader", "note": "Oil change", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Peggy Carter", "department": "HR", "successor": "Howard Stark", "startDate": "2026-03-12", "endDate": "2026-03-16", "reason": "Strategic travel", "position": "Director", "note": "Founding S.H.I.E.L.D.", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Quinn Fabray", "department": "Arts", "successor": "Rachel", "startDate": "2026-03-13", "endDate": "2026-03-13", "reason": "Choir practice", "position": "Singer", "note": "Glee club", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Robin Hood", "department": "Finance", "successor": "Little John", "startDate": "2026-03-14", "endDate": "2026-03-18", "reason": "Redistribution", "position": "Analyst", "note": "Helping the poor", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Sherlock Holmes", "department": "Legal", "successor": "Watson", "startDate": "2026-03-15", "endDate": "2026-03-15", "reason": "Investigation", "position": "Consultant", "note": "Game is afoot", "type": { "id": "05", "name": "Unpaid Leave" } },
    { "name": "Tony Stark", "department": "R&D", "successor": "Pepper", "startDate": "2026-03-16", "endDate": "2026-03-20", "reason": "Workshop upgrade", "position": "Innovator", "note": "Jarvis is online", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Ultron", "department": "IT", "successor": "Vision", "startDate": "2026-03-17", "endDate": "2026-03-17", "reason": "Update", "position": "AI", "note": "Upgrading servers", "type": { "id": "02", "name": "Sick Leave" } },
    { "name": "V", "department": "Cyber", "successor": "Johnny", "startDate": "2026-03-18", "endDate": "2026-03-22", "reason": "Neural chip", "position": "Mercenary", "note": "Cyberware shop", "type": { "id": "02", "name": "Sick Leave" } },
    { "name": "Wade Wilson", "department": "Security", "successor": "Cable", "startDate": "2026-03-19", "endDate": "2026-03-19", "reason": "Chimichanga", "position": "Contractor", "note": "Maximum effort", "type": { "id": "05", "name": "Unpaid Leave" } },
    { "name": "Xena", "department": "Operations", "successor": "Gabrielle", "startDate": "2026-03-20", "endDate": "2026-03-24", "reason": "Warrior training", "position": "Manager", "note": "Traveling offsite", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Yoda", "department": "Training", "successor": "Windu", "startDate": "2026-03-21", "endDate": "2026-03-21", "reason": "Quiet time", "position": "Master", "note": "Meditate I must", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Zorro", "department": "Legal", "successor": "Bernardo", "startDate": "2026-03-22", "endDate": "2026-03-26", "reason": "Night patrol", "position": "Advocate", "note": "Mark of the Z", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Anna Scott", "department": "PR", "successor": "William", "startDate": "2026-03-23", "endDate": "2026-03-23", "reason": "Press junket", "position": "Actress", "note": "London trip", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Billy Butcher", "department": "Compliance", "successor": "Hughie", "startDate": "2026-03-24", "endDate": "2026-03-28", "reason": "Audit", "position": "Inspector", "note": "Diabolical", "type": { "id": "05", "name": "Unpaid Leave" } },
    { "name": "Ciri", "department": "Logistics", "successor": "Geralt", "startDate": "2026-03-25", "endDate": "2026-03-25", "reason": "Portal travel", "position": "Specialist", "note": "Back in a flash", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Darth Vader", "department": "Executive", "successor": "Piett", "startDate": "2026-03-26", "endDate": "2026-03-30", "reason": "Maintenance", "position": "VP", "note": "Meditation chamber", "type": { "id": "02", "name": "Sick Leave" } },
    { "name": "Ellie Williams", "department": "Field Ops", "successor": "Joel", "startDate": "2026-03-27", "endDate": "2026-03-27", "reason": "Supply run", "position": "Scout", "note": "Watch out for clickers", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Frodo Baggins", "department": "Logistics", "successor": "Samwise", "startDate": "2026-03-28", "endDate": "2026-03-31", "reason": "Long walk", "position": "Courier", "note": "Going to Mordor", "type": { "id": "05", "name": "Unpaid Leave" } },
    { "name": "Geralt of Rivia", "department": "Security", "successor": "Yennefer", "startDate": "2026-03-29", "endDate": "2026-03-29", "reason": "Contract", "position": "Contractor", "note": "Toss a coin", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Holly Golightly", "department": "Marketing", "successor": "Paul", "startDate": "2026-03-30", "endDate": "2026-03-31", "reason": "Socializing", "position": "Socialite", "note": "Tiffany's visit", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "Indiana Jones", "department": "Research", "successor": "Marcus", "startDate": "2026-03-31", "endDate": "2026-03-31", "reason": "Field trip", "position": "Professor", "note": "Museum duty", "type": { "id": "01", "name": "Annual Leave" } },
    { "name": "John McClane", "department": "Security", "successor": "Al Powell", "startDate": "2026-03-31", "endDate": "2026-03-31", "reason": "Visit family", "position": "Consultant", "note": "Yippee-ki-yay", "type": { "id": "01", "name": "Annual Leave" } }
  ]
  const leaveDataToday = leaveData.filter((leave) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Ensure midnight
    const startDate = new Date(leave.startDate);
    const endDate = new Date(leave.endDate);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    return startDate.getTime() <= today.getTime() && endDate.getTime() >= today.getTime();
  });


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">
          ຍີນດີຕ້ອນຮັບ, {user?.firstNameLo}
        </h1>
        <p className="text-muted-foreground">
          {format(new Date(), "EEEE, d MMMM yyyy", { locale: lo })}
        </p>
      </div>

      {/* Today's Status */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Today&apos;s Status</p>
                <p className="text-lg font-semibold text-foreground">
                  {todayAttendance?.checkIn
                    ? `ກົດເຊັກ-ອິນ ຕອນ ${todayAttendance.checkIn}`
                    : 'ຍັງບໍ່ໄດ້ເຊັກ-ອິນ'
                  }
                </p>
              </div>
            </div>
            <Badge variant={todayAttendance?.checkIn ? 'default' : 'secondary'}>
              {todayAttendance?.checkOut
                ? 'ກັບບ້ານແລ້ວ'
                : todayAttendance?.checkIn
                  ? 'ເຂົ້າເຮັດວຽກແລ້ວ'
                  : 'ຍັງບໍ່ໄດ້ເຊັກ-ອິນ'
              }
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Late Balance */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-chart-3/10">
                <AlertTriangle className="w-5 h-5 text-chart-3" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ມາຊ້າ</p>
                <p className="text-xl font-bold text-foreground">{lateRecords.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Fines */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-destructive/10">
                <DollarSign className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ຄ່າປັນ</p>
                <p className="text-xl font-bold text-foreground">${totalFines}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Annual Leave */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-chart-2/10">
                <MapPinX  className="w-5 h-5 text-chart-2" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ລືມກົດເຂົ້າວຽກ</p>
                <p className="text-xl font-bold text-foreground">3</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sick Leave */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-chart-1/10">
                <HeartPulse className="w-5 h-5 text-chart-1" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sick Leave</p>
                <p className="text-xl font-bold text-foreground">{sickRemaining}/{effectiveLeaveBalance.sick}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leave Balance Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            ປະເພດມື້ພັກ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {policies.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">ບໍ່ມີຂໍ້ມູນນະໂຍບາຍ</p>
          ) : (
            <PolicyList policies={policies} usedByPolicy={usedByPolicy} />
          )}
        </CardContent>
      </Card>

      {/* leave      */}

      <Tabs defaultValue="checkIn" className="w-full ">
        <TabsList>
          <TabsTrigger value="checkIn">ເຂົ້າວຽກ</TabsTrigger>
          <TabsTrigger value="leave">ລາພັກ</TabsTrigger>
          <TabsTrigger value="off_site">ອອກວຽກນອກ</TabsTrigger>
          <TabsTrigger value="topLeave">ມາຊ້າ (Top)</TabsTrigger>
        </TabsList>
        <TabsContent value="checkIn">
         
            <Card>

            <div  >

              <CardContent className="text-muted-foreground text-sm h-auto max-h-[500px] overflow-auto">
                <div className="flex items-center justify-between mb-4">
                                 <p className="mb-2 font-semibold text-lg">ລາຍການມາວຽກມື້ນີ້ </p>
                <Button variant="link" onClick={() => {
                  const today = new Date();
                  const formattedToday = today.toISOString().split('T')[0];
                  const url = `/dashboard/check-in?date=${formattedToday}`;
                  router.push(url);
                }}>
                  ທັງໝົດ
                </Button>
                </div>
                <CheckInToday />
              </CardContent>

            </div>
          </Card>
        </TabsContent>
        <TabsContent value="leave">
          <Card >

            <div  >

              <CardContent className="text-muted-foreground text-sm h-auto max-h-[500px] overflow-auto">
                <p className="mb-2 font-semibold text-lg">ລາຍການລາພັກມື້ນີ້ </p>
                <ToDay data={leaveDataToday} />
              </CardContent>

            </div>
          </Card>
        </TabsContent>
        <TabsContent value="off_site">
          <Card>
            <CardHeader>
              <CardTitle>Reports</CardTitle>
              <CardDescription>
                Generate and download your detailed reports. Export data in
                multiple formats for analysis.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              You have 5 reports ready and available to export.
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="topLeave">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
              <CardDescription>
                Manage your account preferences and options. Customize your
                experience to fit your needs.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Configure notifications, security, and themes.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>



      {/* Recent Leaves */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Recent Leave Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentLeaves.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No leave requests yet
            </p>
          ) : (
            <div className="space-y-3">
              {recentLeaves.map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {leave.policyName || leave.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(leave.startDate), 'MMM d')} - {format(new Date(leave.endDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <Badge
                    variant={
                      leave.status === 'approved' ? 'default' :
                        leave.status === 'rejected' ? 'destructive' :
                          'secondary'
                    }
                  >
                    {leave.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card> */}
    </div>
  )
}
