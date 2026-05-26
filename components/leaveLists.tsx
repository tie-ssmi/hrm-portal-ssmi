import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { LeaveData } from "@/types/employee"
import { Label } from "@/components/ui/label"
import { useTodayCheckInAttendance } from '@/lib/use-attendance-queries'
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
  const { data: attendanceRecords, isLoading, error } = useTodayCheckInAttendance()

  return (
    <div>
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-full">
          <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
        </div>
      ) : attendanceRecords?.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full">
          <UserCheck className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">ບໍ່ມີພະນັກງານເຂົ້າວຽກ</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 ">
          {attendanceRecords?.map((record) => (
            <Card key={record.id} className="w-full lg:w-[300px] group py-0 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 ">
              {/* hover:-translate-y-0.5 */}
              <CardContent className="flex items-center gap-3 p-4">
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