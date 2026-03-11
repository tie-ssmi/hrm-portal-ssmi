'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth-context'
import { useHRM } from '@/lib/hrm-context'
import ProfileSkeleton from '@/components/skeletons/profileSkeleton'
import { fetchEmployeeByUid } from '@/lib/employees'
import type { Employee } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { 
  User, 
  Mail, 
  Phone, 
  Building, 
  Briefcase, 
  Calendar,
  Edit3,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  MapPin,
  Heart,
  GraduationCap,
  Users,
  IdCard
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function ProfilePage() {
  const { user, firebaseUser } = useAuth()
  const { profileUpdateRequests, submitProfileUpdate } = useHRM()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editField, setEditField] = useState('')
  const [editValue, setEditValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: employeeData, isLoading: isEmployeeLoading } = useQuery({
    queryKey: ['employee', firebaseUser?.uid],
    queryFn: () => fetchEmployeeByUid(firebaseUser!.uid),
    enabled: !!firebaseUser?.uid,
  })

  const profileUser: Employee | null = user
    ? {
        ...user,
        ...(employeeData ?? {}),
        firstName: employeeData?.firstNameEn || user.firstName,
        lastName: employeeData?.lastNameEn || user.lastName,
        phone: employeeData?.tel || user.phone,
        position: employeeData?.jobTitle || user.position,
        department: employeeData?.workLocation || user.department,
      }
    : null

  const initials = profileUser
    ? `${(profileUser.firstNameEn || profileUser.firstName)[0]}${(profileUser.lastNameEn || profileUser.lastName)[0]}`.toUpperCase()
    : 'U'

  const handleEditClick = (field: string, currentValue: string) => {
    setEditField(field)
    setEditValue(currentValue)
    setIsDialogOpen(true)
  }

  const handleSubmitUpdate = async () => {
    if (!editValue.trim()) {
      toast.error('Please enter a value')
      return
    }

    setIsSubmitting(true)
    try {
      const currentValue = editField === 'phone' ? profileUser?.phone || '' : profileUser?.email || ''
      await submitProfileUpdate({
        field: editField,
        oldValue: currentValue,
        newValue: editValue
      })
      toast.success('Update request submitted for approval')
      setIsDialogOpen(false)
      setEditField('')
      setEditValue('')
    } catch {
      toast.error('Failed to submit update request')
    } finally {
      setIsSubmitting(false)
    }
  }

  const avatarSrc = employeeData?.profileImage
    || employeeData?.photo3x4Url
    || profileUser?.avatar
    || ((profileUser?.gender || '').toLowerCase() === 'male' ? '/info/ma.jpg' : '/info/woman.jpg')

  const profileFields = [
    { label: 'ລະຫັດພະນັກງານ', value: profileUser?.employeeId, icon: User, editable: false },
    { label: 'ອີເມວ', value: profileUser?.email, icon: Mail, editable: true, field: 'email' },
    { label: 'ເບີໂທ', value: profileUser?.tel || profileUser?.phone, icon: Phone, editable: true, field: 'phone' },
    { label: 'ຕຳແໜ່ງວຽກ', value: profileUser?.jobTitle || profileUser?.position, icon: Briefcase, editable: false },
    { label: 'ສະຖານທີ່ທຳວຽກ', value: profileUser?.workLocation || profileUser?.department, icon: Building, editable: false },
    { label: 'ປະເພດພະນັກງານ', value: profileUser?.employeeType, icon: IdCard, editable: false },
    { label: 'ວັນເຂົ້າຮ່ວມ', value: profileUser?.joinDate ? format(new Date(profileUser.joinDate), 'MMM d, yyyy') : '-', icon: Calendar, editable: false },
  ]

  const personalFields = [
    { label: 'ຊື່ (ພາສາອັງກິດ)', value: `${profileUser?.firstNameEn || profileUser?.firstName} ${profileUser?.lastNameEn || profileUser?.lastName}`, icon: User },
    { label: 'ຊື່ (ພາສາລາວ)', value: profileUser?.firstNameLo && profileUser?.lastNameLo ? `${profileUser.firstNameLo} ${profileUser.lastNameLo}` : '-', icon: User },
    { label: 'ວັນເກີດ', value: profileUser?.dateOfBirth ? format(new Date(profileUser.dateOfBirth), 'MMM d, yyyy') : '-', icon: Calendar },
    { label: 'ເພດ', value: profileUser?.gender, icon: User },
    { label: 'ກຸ່ມເລືອດ', value: profileUser?.bloodType, icon: Heart },
    { label: 'ສະຖານະຄົນຄອບຄົວ', value: profileUser?.maritalStatus, icon: Users },
    { label: 'ສາສະໜາ', value: profileUser?.religion, icon: User },
    { label: 'ຊາດ', value: profileUser?.ethnicity, icon: User },
    { label: 'ແຂວງເກີດ', value: profileUser?.provinceOfBirth, icon: MapPin },
    { label: 'ເມືອງເກີດ', value: profileUser?.cityOfBirth, icon: MapPin },
    { label: 'ສະຖານທີ່ເກີດ', value: profileUser?.placeOfBirth, icon: MapPin },
    { label: 'ຈຳນວນສະມາຊິກຄອບຄົວ', value: profileUser?.numberOfFamilyMembers, icon: Users },
    { label: 'ຕິດຕໍ່ສຸດທ້າຍ', value: profileUser?.emergencyContactNumber, icon: Phone },
  ]

  const educationFields = [
    { label: 'ລະດັບການສຶກສາ', value: profileUser?.education, icon: GraduationCap },
    { label: 'ສະຖາບັນທີ່ຈົບການສຶກສາ', value: profileUser?.graduatedFrom, icon: GraduationCap },
    { label: 'ສາຂາວິຊາ', value: profileUser?.major, icon: GraduationCap },
    { label: 'ໃບຂັບຂີ່', value: profileUser?.drivingLicenseType, icon: IdCard },
  ]

  if (!profileUser || isEmployeeLoading) {
    return <ProfileSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">ຂໍ້ມູນສ່ວນຕົວ</h1>
        <p className="text-muted-foreground">ເບິ່ງແລະຮ້ອງຂໍການອັບເດດຂໍ້ມູນສ່ວນຕົວຂອງທ່ານ</p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <Avatar className="w-24 h-24">
              <AvatarImage src={avatarSrc} alt={`${profileUser?.firstNameEn || profileUser?.firstName} ${profileUser?.lastNameEn || profileUser?.lastName}`} className='object-scale-down ' />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left">
              <h2 className="text-xl font-semibold text-foreground">
                {profileUser?.firstNameEn || profileUser?.firstName} {profileUser?.lastNameEn || profileUser?.lastName}
              </h2>
              {profileUser?.firstNameLo && profileUser?.lastNameLo && (
                <p className="text-lg text-foreground/80 font-[family-name:var(--font-noto-sans-lao)]">
                  {profileUser.firstNameLo} {profileUser.lastNameLo}
                </p>
              )}
              <p className="text-muted-foreground">{profileUser?.jobTitle || profileUser?.position}</p>
              <p className="text-sm text-muted-foreground mt-1">{profileUser?.workLocation || profileUser?.department}</p>
              <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                <Badge variant="secondary">{profileUser?.employeeId}</Badge>
                <Badge variant="outline">Active</Badge>
                {profileUser?.employeeType && <Badge variant="outline">{profileUser.employeeType}</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ຂໍ້ມູນສ່ວນຕົວ</CardTitle>
          <CardDescription>
            ບາງຟິວລິດຈຳເປັນຕ້ອງຮັບການອະນຸມັດຈາກ HR ເພື່ອອັບເດດ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {profileFields.map((field, index) => (
              <div key={index}>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted">
                      <field.icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{field.label}</p>
                      <p className="text-sm font-medium text-foreground">{field.value || '-'}</p>
                    </div>
                  </div>
                  {field.editable && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleEditClick(field.field!, field.value || '')}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {index < profileFields.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ຂໍ້ມູນສ່ວນຕົວ</CardTitle>
          <CardDescription>
            ລາຍລະອຽດສ່ວນຕົວແລະຂໍ້ມູນຕິດຕໍ່ຂອງທ່ານ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {personalFields.map((field, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-background">
                  <field.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{field.label}</p>
                  <p className="text-sm font-medium text-foreground">{field.value || '-'}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Education & Qualifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ການສຶກສາ & ວິຊາການ</CardTitle>
          <CardDescription>
            ພາບພື້ນຖານການສຶກສາແລະໃບຮັບຮອງວິຊາການຂອງທ່ານ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {educationFields.map((field, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-background">
                  <field.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{field.label}</p>
                  <p className="text-sm font-medium text-foreground">{field.value || '-'}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Update Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            ຄໍາຮ້ອງຂໍອັບເດດ
          </CardTitle>
        </CardHeader>
        <CardContent>
          {profileUpdateRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              ບໍ່ມີຄໍາຮ້ອງຂໍອັບເດດທີ່ກຳລັງລໍຖ້າ
            </p>
          ) : (
            <div className="space-y-3">
              {profileUpdateRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize">
                      {request.field} Update
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {request.oldValue} → {request.newValue}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Submitted: {format(new Date(request.createdAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <Badge
                    variant={
                      request.status === 'approved' ? 'default' :
                      request.status === 'rejected' ? 'destructive' :
                      'secondary'
                    }
                    className="flex items-center gap-1"
                  >
                    {request.status === 'approved' && <CheckCircle className="w-3 h-3" />}
                    {request.status === 'rejected' && <XCircle className="w-3 h-3" />}
                    {request.status === 'pending' && <Clock className="w-3 h-3" />}
                    {request.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">ແກ້ໄຂ {editField}</DialogTitle>
            <DialogDescription>
              ການປ່ຽນແປງນີ້ຈະຖືກສົ່ງເພື່ອຮັບການອະນຸມັດຈາກ HR
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel className="capitalize">{editField}</FieldLabel>
              <Input
                type={editField === 'email' ? 'email' : 'text'}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={`Enter new ${editField}`}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              ຍົກເລີກ 
            </Button>
            <Button onClick={handleSubmitUpdate} disabled={isSubmitting}>
              {isSubmitting ? <Spinner className="mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              ສົ່ງຄໍາຮ້ອງ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
