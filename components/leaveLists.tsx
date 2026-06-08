import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { LeaveData } from "@/types/employee"
import { Label } from "@/components/ui/label"
import { useTodayCheckInAttendance } from '@/lib/use-attendance-queries'
import { useAuth } from '@/lib/auth-context'
import { useTodayLeavesByWorkLocation } from '@/lib/use-leave-queries'
import { useTodayOffsiteByWorkLocation } from '@/lib/use-work-outside-queries'
import { useRouter } from 'next/navigation'
import { MapPin, MapPinX } from 'lucide-react'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { translateJobTitle } from "./translater"
import { useState } from "react"
import {
  CalendarDays,
  User,
  Building2,
  Briefcase,
  UserCheck,
  FileText,
  Tag,
  StickyNote,
  Loader2,
} from "lucide-react"
// countWorkDays
import { countWorkDays } from "./theWorkingDays"
// Reusable Sheet Detail Component
function LeaveDetailSheet({
  leave,
  trigger,
}: {
  leave: LeaveData
  trigger: React.ReactNode
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 ring-2 ring-primary/20">
              <AvatarImage
                src="https://github.com/shadcn.png"
                alt={leave.name}
              />
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                {leave.name?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle className="text-lg">ຂໍ້ມູນການລາພັກ</SheetTitle>
              <SheetDescription className="text-sm">
                ລາຍລະອຽດການລາພັກຂອງ {leave.name}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <div className="space-y-3">
            <DetailRow icon={<User className="h-4 w-4" />} label="ຊື່ ແລະ ນາມສະກຸນ" value={leave?.name} />
            <DetailRow icon={<Building2 className="h-4 w-4" />} label="ພາກແນກ" value={leave?.department} />
            <DetailRow icon={<Briefcase className="h-4 w-4" />} label="ຕຳແໜ່ງ" value={translateJobTitle(leave?.position)} />
            <DetailRow icon={<UserCheck className="h-4 w-4" />} label="ຜູ້ຮັບວຽກຕໍ່" value={leave?.successor} />
          </div>

          <Separator />

          <div className="space-y-3">
            <DetailRow icon={<CalendarDays className="h-4 w-4" />} label="ວັນທີເລີ່ມຕົ້ນ" value={leave?.startDate} />
            <DetailRow icon={<CalendarDays className="h-4 w-4" />} label="ວັນທີສິ້ນສຸດ" value={leave?.endDate} />
            <DetailRow icon={<FileText className="h-4 w-4" />} label="ເຫດຜົນການລາ" value={leave?.reason} />
            <DetailRow icon={<Tag className="h-4 w-4" />} label="ປະເພດການລາ" value={leave?.type?.name} badge />
            <DetailRow icon={<StickyNote className="h-4 w-4" />} label="ໝາຍເຫດ" value={leave?.note} />
          </div>
        </div>

        <SheetFooter className="mt-6">
          <SheetClose asChild>
            <Button className="w-full">ປິດ</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function DetailRow({
  icon,
  label,
  value,
  badge = false,
}: {
  icon: React.ReactNode
  label: string
  value?: string
  badge?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {badge && value ? (
          <Badge variant="secondary" className="mt-0.5">
            {value}
          </Badge>
        ) : (
          <p className="font-semibold text-sm truncate">{value || "-"}</p>
        )}
      </div>
    </div>
  )
}

// ToDay Component
export function ToDay({ data }: { data: LeaveData[] }) {


  return (
    <div className="flex flex-wrap gap-3">
      {data.map((leave, index) => (
        <div key={index} className="w-full lg:w-[250px] ">
          <LeaveDetailSheet
            leave={leave}
            trigger={
              <Card className="group py-0 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5">
                <CardContent className="flex items-center gap-3 p-4">
                  <Avatar className="h-11 w-11 shrink-0 ring-2 ring-background shadow-sm">
                    <AvatarImage
                      src="https://github.com/shadcn.png"
                      alt={leave.name}
                      className="lg:grayscale group-hover:grayscale-0 transition-all"
                    />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                      {leave.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate" >ສາຂາ ຫຼວງພະບາງ </p>
                    <p className="text-xs text-muted-foreground">{leave.department}</p>
                    <p className="font-semibold text-sm text-foreground truncate" title={leave.name}>
                      {leave.name} 
                    </p>
                    <p className="text-xs text-muted-foreground truncate" title={leave.successor}>
                      ແທນ: {leave.successor}
                    </p>
                  </div>

                  <div className="flex flex-col items-center shrink-0">
                    <span className="text-2xl font-bold text-primary">
                      {countWorkDays(leave.endDate)}
                    </span>
                    <span className="text-[10px] text-muted-foreground leading-none">ມື້</span>
                  </div>
                </CardContent>
              </Card>
            }
          />
        </div>
      ))}
    </div>
  )
}


export function CheckInToday() {
  const { user } = useAuth()
  const { data: attendanceRecords, isLoading, error } = useTodayCheckInAttendance()

  const myWorkLocationUid =
    typeof user?.workLocation === 'object' && user.workLocation !== null
      ? ((user.workLocation as { uuid?: string; uid?: string }).uuid ?? (user.workLocation as { uid?: string }).uid)
      : undefined

  const filteredRecords = attendanceRecords?.filter(
    (r) => r.workLocation?.uid === myWorkLocationUid,
  )

  return (
    <div>
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-full">
          <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
        </div>
      ) : filteredRecords?.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full">
          <UserCheck className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">ບໍ່ມີພະນັກງານເຂົ້າວຽກ</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 ">
          {filteredRecords?.map((record) => (
            <Card key={record.id} className="w-full lg:w-[300px] group py-0 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 ">
              {/* hover:-translate-y-0.5 */}
              <CardContent className="flex items-center gap-3 p-4">
                {/* click avatar to Dialog the image */}
               <Dialog>
                  <DialogTrigger asChild>
                     <Avatar className="h-11 w-11 shrink-0 ring-2 ring-background shadow-sm">
                  <AvatarImage
                    src={record.employeeImage || "https://github.com/shadcn.png"}
                    alt={record.fullNameEn || record.fullNameLo}
                    className="object-cover"
                   

                  />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                    {record.fullNameLo?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>{record?.fullNameLo}</DialogTitle>
                      <DialogDescription>
                        {record?.workLocation?.name}
                      </DialogDescription>
                      <img src={record.employeeImage || "https://github.com/shadcn.png"}
                    alt={record.fullNameEn || record.fullNameLo}
                    className="object-cover"/>
                    </DialogHeader>
                  </DialogContent>
                </Dialog>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate" >{record?.workLocation?.name}</p>
                  <p className="text-xs text-muted-foreground">{record?.department?.name}</p>
                  <p className="font-semibold text-sm text-foreground truncate" title={record?.fullNameEn || record?.fullNameLo}>
                    {record?.fullNameLo}
                  </p>

                </div>

                <div className="flex flex-col items-center shrink-0">
                  <span className="text-2xl font-bold text-primary">
                    {record.checkInTime}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function TodayLeaveSection() {
  const { user } = useAuth()
  const router = useRouter()

  const workLocationUuid =
    typeof user?.workLocation === 'object' && user.workLocation !== null
      ? ((user.workLocation as { uuid?: string; uid?: string }).uuid ?? (user.workLocation as { uid?: string }).uid)
      : undefined

  const { data: todayLeaveRequests = [], isLoading } = useTodayLeavesByWorkLocation(workLocationUuid)

  const leaveDataToday: LeaveData[] = todayLeaveRequests.map(r => ({
    name: r.leaveUserName ?? '',
    department: r.departmentNameLo ?? r.departmentNameEn ?? '',
    successor: r.successorNameLo ?? r.successorNameEn ?? '',
    startDate: r.startDate,
    endDate: r.endDate,
    reason: r.reason,
    position: r.jobTitle ?? '',
    note: r.doc ?? '',
    type: { id: r.policyId ?? '', name: r.policyName ?? r.type },
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-lg">ລາຍການລາພັກມື້ນີ້</p>
        <Button variant="link" onClick={() => router.push('/dashboard/leave')}>
          ທັງໝົດ
        </Button>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ToDay data={leaveDataToday} />
      )}
    </div>
  )
}

export function TodayOffsiteSection() {
  const { user } = useAuth()
  const router = useRouter()

  const workLocationUuid =
    typeof user?.workLocation === 'object' && user.workLocation !== null
      ? ((user.workLocation as { uuid?: string; uid?: string }).uuid ?? (user.workLocation as { uid?: string }).uid)
      : undefined

  const { data: todayOffsiteRecords = [], isLoading } = useTodayOffsiteByWorkLocation(workLocationUuid)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="font-semibold text-lg text-foreground">ລາຍການອອກວຽກນອກສະຖານທີ່ມື້ນີ້</p>
        <Button variant="link" onClick={() => router.push('/dashboard/off-site')}>
          ທັງໝົດ
        </Button>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : todayOffsiteRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <MapPinX className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">ບໍ່ມີລາຍການອອກວຽກນອກ</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {todayOffsiteRecords.flatMap((record) => {
            const members = record.teammate?.length
              ? record.teammate
              : [{
                  uid: record.createdByUid,
                  fullNameLo: record.requester?.fullNameLo,
                  fullNameEn: record.requester?.fullNameEn,
                  photoUrl: undefined as string | undefined,
                  department: { department: record.requester?.department?.department ?? '', title: '', uuid: '' },
                  jobTitle: record.requester?.jobTitle ?? '',
                  roleInTrip: 'Support' as const,
                  email: '',
                }]

            return members.map((member) => (
              <Card key={`${record.id}-${member.uid}`} className="w-full lg:w-[300px] py-0 overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/30">
                <CardContent className="p-0">
                  {/* Person header */}
                  <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Avatar className="h-10 w-10 shrink-0 ring-2 ring-background shadow-sm cursor-pointer hover:ring-primary/40 transition-all">
                          <AvatarImage src={member.photoUrl || ''} alt={member.fullNameLo} className="object-cover" />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                            {member.fullNameLo?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-sm">
                        <DialogHeader>
                          <DialogTitle>{member.fullNameLo}</DialogTitle>
                          <DialogDescription>{member.department?.department}</DialogDescription>
                        </DialogHeader>
                        {member.photoUrl && (
                          <img src={member.photoUrl} alt={member.fullNameLo} className="w-full rounded-lg object-cover" />
                        )}
                      </DialogContent>
                    </Dialog>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{member.fullNameLo}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.department?.department}</p>
                    </div>

                    <Badge variant="outline" className="shrink-0 text-xs font-normal">
                      {record.activityType?.name}
                    </Badge>
                  </div>

                  <Separator />

                  {/* Trip details */}
                  <div className="px-4 py-3 space-y-1.5 bg-muted/30">
                    <p className="text-sm font-medium text-foreground truncate" title={record.subject}>
                      {record.subject}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0 text-primary" />
                      <span className="truncate">{record.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="h-3 w-3 shrink-0" />
                      <span>{record.startDate}</span>
                      <span className="text-muted-foreground/40">–</span>
                      <span>{record.endDate}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          })}
        </div>
      )}
    </div>
  )
}