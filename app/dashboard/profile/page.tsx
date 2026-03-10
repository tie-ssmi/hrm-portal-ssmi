'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useHRM } from '@/lib/hrm-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
  XCircle
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
  DialogTrigger,
} from "@/components/ui/dialog"

export default function ProfilePage() {
  const { user } = useAuth()
  const { profileUpdateRequests, submitProfileUpdate } = useHRM()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editField, setEditField] = useState('')
  const [editValue, setEditValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const initials = user 
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
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
      const currentValue = editField === 'phone' ? user?.phone || '' : user?.email || ''
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

  const profileFields = [
    { label: 'Employee ID', value: user?.employeeId, icon: User, editable: false },
    { label: 'Email', value: user?.email, icon: Mail, editable: true, field: 'email' },
    { label: 'Phone', value: user?.phone, icon: Phone, editable: true, field: 'phone' },
    { label: 'Department', value: user?.department, icon: Building, editable: false },
    { label: 'Position', value: user?.position, icon: Briefcase, editable: false },
    { label: 'Join Date', value: user?.joinDate ? format(new Date(user.joinDate), 'MMM d, yyyy') : '-', icon: Calendar, editable: false },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="text-muted-foreground">View and request updates to your profile</p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <Avatar className="w-24 h-24">
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left">
              <h2 className="text-xl font-semibold text-foreground">
                {user?.firstName} {user?.lastName}
              </h2>
              <p className="text-muted-foreground">{user?.position}</p>
              <p className="text-sm text-muted-foreground mt-1">{user?.department}</p>
              <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                <Badge variant="secondary">{user?.employeeId}</Badge>
                <Badge variant="outline">Active</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profile Information</CardTitle>
          <CardDescription>
            Some fields require approval from HR to update
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

      {/* Update Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Update Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {profileUpdateRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No pending update requests
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
            <DialogTitle className="capitalize">Update {editField}</DialogTitle>
            <DialogDescription>
              This change will be submitted for HR approval
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
              Cancel
            </Button>
            <Button onClick={handleSubmitUpdate} disabled={isSubmitting}>
              {isSubmitting ? <Spinner className="mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
