'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useHRM } from '@/lib/hrm-context'
import AttendanceSkeleton from '@/components/skeletons/attendanceSkeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { 
  MapPin, 
  LogIn, 
  LogOut, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Navigation,
  Shield,
  ShieldX
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface LocationState {
  lat: number
  lng: number
  accuracy: number
  error?: string
}

export default function AttendancePage() {
  const { isLoading } = useAuth()
  const { todayAttendance, checkIn, checkOut, isWithinGeofence, attendanceHistory } = useHRM()
  const [location, setLocation] = useState<LocationState | null>(null)
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const getLocation = async (): Promise<LocationState | null> => {
    setIsLoadingLocation(true)
    
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        toast.error('Geolocation is not supported by your browser')
        setIsLoadingLocation(false)
        resolve(null)
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          }
          setLocation(loc)
          setIsLoadingLocation(false)
          resolve(loc)
        },
        (error) => {
          setLocation({ lat: 0, lng: 0, accuracy: 0, error: error.message })
          setIsLoadingLocation(false)
          toast.error('Unable to get your location. Please enable location services.')
          resolve(null)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    })
  }

  const handleCheckIn = async () => {
    setIsChecking(true)
    
    const loc = await getLocation()
    
    if (loc) {
      const withinFence = isWithinGeofence(loc.lat, loc.lng)
      if (!withinFence) {
        toast.error('You are outside the office area. Check-in not allowed.')
        setIsChecking(false)
        return
      }
    }
    
    const result = await checkIn(loc ? { lat: loc.lat, lng: loc.lng } : undefined)
    
    if (result.success) {
      toast.success(result.message)
    } else {
      toast.error(result.message)
    }
    
    setIsChecking(false)
  }

  const handleCheckOut = async () => {
    setIsChecking(true)
    
    const loc = await getLocation()
    const result = await checkOut(loc ? { lat: loc.lat, lng: loc.lng } : undefined)
    
    if (result.success) {
      toast.success(result.message)
    } else {
      toast.error(result.message)
    }
    
    setIsChecking(false)
  }

  const isWithinOffice = location && !location.error 
    ? isWithinGeofence(location.lat, location.lng)
    : null

  const recentHistory = attendanceHistory.slice(0, 5)

  if (isLoading) {
    return <AttendanceSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Check-In / Check-Out</h1>
        <p className="text-muted-foreground">Record your attendance with GPS verification</p>
      </div>

      {/* Current Time Card */}
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-sm opacity-80">Current Time</p>
            <p className="text-4xl font-bold mt-1">
              {format(currentTime, 'HH:mm:ss')}
            </p>
            <p className="text-sm opacity-80 mt-2">
              {format(currentTime, 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Location Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Location Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => getLocation()}
                disabled={isLoadingLocation}
              >
                {isLoadingLocation ? (
                  <Spinner className="mr-2" />
                ) : (
                  <Navigation className="w-4 h-4 mr-2" />
                )}
                Get Location
              </Button>
            </div>
            {location && !location.error && (
              <Badge 
                variant={isWithinOffice ? 'default' : 'destructive'}
                className="flex items-center gap-1"
              >
                {isWithinOffice ? (
                  <>
                    <Shield className="w-3 h-3" />
                    Within Office
                  </>
                ) : (
                  <>
                    <ShieldX className="w-3 h-3" />
                    Outside Office
                  </>
                )}
              </Badge>
            )}
          </div>
          {location && !location.error && (
            <p className="text-xs text-muted-foreground mt-2">
              Accuracy: {Math.round(location.accuracy)}m
            </p>
          )}
          {location?.error && (
            <p className="text-xs text-destructive mt-2">
              {location.error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Today's Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today&apos;s Attendance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground mb-1">Check-In</p>
              <p className="text-xl font-bold text-foreground">
                {todayAttendance?.checkIn || '--:--'}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground mb-1">Check-Out</p>
              <p className="text-xl font-bold text-foreground">
                {todayAttendance?.checkOut || '--:--'}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center justify-center">
            <Badge
              variant={
                todayAttendance?.status === 'present' ? 'default' :
                todayAttendance?.status === 'late' ? 'secondary' :
                'outline'
              }
              className="text-sm px-4 py-1"
            >
              {todayAttendance?.checkOut ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Day Completed
                </>
              ) : todayAttendance?.checkIn ? (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  Working {todayAttendance.status === 'late' && '(Late)'}
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Not Checked In
                </>
              )}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Check-In/Out Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <Button
          size="lg"
          className="h-16 text-lg"
          onClick={handleCheckIn}
          disabled={isChecking || !!todayAttendance?.checkIn}
        >
          {isChecking && !todayAttendance?.checkIn ? (
            <Spinner className="mr-2" />
          ) : (
            <LogIn className="w-5 h-5 mr-2" />
          )}
          Check In
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-16 text-lg"
          onClick={handleCheckOut}
          disabled={isChecking || !todayAttendance?.checkIn || !!todayAttendance?.checkOut}
        >
          {isChecking && todayAttendance?.checkIn ? (
            <Spinner className="mr-2" />
          ) : (
            <LogOut className="w-5 h-5 mr-2" />
          )}
          Check Out
        </Button>
      </div>

      {/* Recent History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Attendance</CardTitle>
          <CardDescription>Your attendance records this week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentHistory.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div>
                  <p className="text-sm font-medium">
                    {format(new Date(record.date), 'EEE, MMM d')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {record.checkIn || '--:--'} - {record.checkOut || '--:--'}
                  </p>
                </div>
                <Badge
                  variant={
                    record.status === 'present' ? 'default' :
                    record.status === 'late' ? 'secondary' :
                    record.status === 'leave' ? 'outline' :
                    'destructive'
                  }
                >
                  {record.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Demo Mode: GPS geofencing simulates office location verification
      </p>
    </div>
  )
}
