'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useHRM } from '@/lib/hrm-context'
import {
  useAttendanceHistory,
  useTodayAttendance,
  useCheckIn,
  useCheckOut,
} from '@/lib/use-attendance-queries'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
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
  ShieldX,
} from 'lucide-react'
import { toast } from 'sonner'
import { addDays, format, startOfWeek } from 'date-fns'

type LocationState = {
  lat: number
  lng: number
  accuracy: number
  error?: string
}

export default function AttendancePage() {
  const { user } = useAuth()
  const { isWithinGeofence } = useHRM()

  const { data: attendanceHistory = [], isLoading: isLoadingHistory } =
    useAttendanceHistory(user?.uuid)
  const { data: todayAttendance } = useTodayAttendance(user?.uuid)
  const checkInMutation = useCheckIn()
  const checkOutMutation = useCheckOut()

  const [location, setLocation] = useState<LocationState | null>(null)
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => window.clearInterval(interval)
  }, [])

  const getLocation = useCallback(async (): Promise<LocationState | null> => {
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
          const loc: LocationState = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
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
  }, [])

  const handleCheckIn = useCallback(async () => {
    if (!user) {
      toast.error('ບໍ່ເຫັນຂໍ້ມູນຜູ້ໃຊ້. ກະລຸນາເຂົ້າລະບົບອີກຄັ້ງ.')
      return
    }

    try {
      const loc = await getLocation()
      if (!loc) {
        toast.error('ບໍ່ສາມາດຮັບຂໍ້ມູນສະຖານທີ່. ກະລຸນາເປີດ GPS ແລະອະນຸຍາດການເຂົ້າເຖິງສະຖານທີ່.')
        return
      }

      const withinFence = isWithinGeofence(loc.lat, loc.lng)
      if (!withinFence) {
        toast.error('ທ່ານຢູ່ນອກພື້ນທີ່ຫ້ອງການ. ບໍ່ສາມາດກົດເຂົ້າການໄດ້.')
        return
      }

      await checkInMutation.mutateAsync({
        user,
        location: { lat: loc.lat, lng: loc.lng },
      })

      toast.success('ເຂົ້າການສຳເລັດແລ້ວ')
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'ບໍ່ສາມາດດໍາເນີນການເຂົ້າການ. ກະລຸນາລອງໃໝ່.'
      )
    }
  }, [user, getLocation, isWithinGeofence, checkInMutation])

  const handleCheckOut = useCallback(async () => {
    if (!user) {
      toast.error('ບໍ່ເຫັນຂໍ້ມູນຜູ້ໃຊ້. ກະລຸນາເຂົ້າລະບົບອີກຄັ້ງ.')
      return
    }

    try {
      const loc = await getLocation()
      if (!loc) {
        toast.error('ບໍ່ສາມາດຮັບຂໍ້ມູນສະຖານທີ່. ກະລຸນາເປີດ GPS ແລະອະນຸຍາດການເຂົ້າເຖິງສະຖານທີ່.')
        return
      }

      const withinFence = isWithinGeofence(loc.lat, loc.lng)
      if (!withinFence) {
        toast.error('ທ່ານຢູ່ນອກພື້ນທີ່ຫ້ອງການ. ບໍ່ສາມາດກົດເຂົ້າການໄດ້.')
        return
      }

      await checkOutMutation.mutateAsync({
        user,
        location: { lat: loc.lat, lng: loc.lng },
      })

      toast.success('ອອກຈາກການສຳເລັດແລ້ວ')
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'ບໍ່ສາມາດດໍາເນີນການອອກ. ກະລຸນາລອງໃໝ່.'
      )
    }
  }, [user, getLocation, isWithinGeofence, checkOutMutation])

  const isWithinOffice = useMemo(() => {
    if (!location || location.error) {
      return false
    }
    return isWithinGeofence(location.lat, location.lng)
  }, [isWithinGeofence, location])

  const weeklyHistory = useMemo(() => {
    const weekStart = startOfWeek(currentTime, { weekStartsOn: 1 })
    const weekEnd = addDays(weekStart, 6)
    const weekStartIso = format(weekStart, 'yyyy-MM-dd')
    const weekEndIso = format(weekEnd, 'yyyy-MM-dd')

    return attendanceHistory
      .filter((record) => {
        const normalizedDate = record.date.slice(0, 10)
        return normalizedDate >= weekStartIso && normalizedDate <= weekEndIso
      })
      .sort((left, right) => left.date.localeCompare(right.date))
  }, [attendanceHistory, currentTime])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Check-In / Check-Out</h1>
        <p className="text-muted-foreground">
ບັນທຶກການເຂົ້າຮ່ວມຂອງທ່ານດ້ວຍການຢັ້ງຢືນ GPS</p>
      </div>

      <Card className="bg-primary text-primary-foreground">
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-sm opacity-80">
ເວລາປະຈຸບັນ</p>
            <p className="mt-1 text-4xl font-bold">{format(currentTime, 'HH:mm:ss')}</p>
            <p className="mt-2 text-sm opacity-80">{format(currentTime, 'EEEE, MMMM d, yyyy')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" />
            ສະຖານທີ່ຂອງທ່ານ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={getLocation} disabled={isLoadingLocation}>
              {isLoadingLocation ? (
                <Spinner className="mr-2" />
              ) : (
                <Navigation className="mr-2 h-4 w-4" />
              )}
ດຶງຂໍ້ມູນຕຳແໜ່ງໃໝ່            </Button>

            {location && !location.error ? (
              <Badge variant={isWithinOffice ? 'default' : 'destructive'} className="flex items-center gap-1">
                {isWithinOffice ? (
                  <>
                    <Shield className="h-3 w-3" />
                    ຢູ່ໃນພື້ນທີ່ຫ້ອງການ
                  </>
                ) : (
                  <>
                    <ShieldX className="h-3 w-3" />
                    ຢູ່ນອກພື້ນທີ່ຫ້ອງການ
                  </>
                )}
              </Badge>
            ) : null}
          </div>

          {location && !location.error ? (
            <p className="mt-2 text-xs text-muted-foreground">
              ນອກຫ້ອງການ: {Math.round(location.accuracy)} ແມັດ
            </p>
          ) : null}

          {location?.error ? <p className="mt-2 text-xs text-destructive">{location.error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ສະຫຼຸບປະຈຳວັນ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="mb-1 text-xs text-muted-foreground">ເຂົ້າວຽກ</p>
              <p className="text-xl font-bold text-foreground">{todayAttendance?.checkIn || '--:--'}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="mb-1 text-xs text-muted-foreground">ອອກວຽກ</p>
              <p className="text-xl font-bold text-foreground">{todayAttendance?.checkOut || '--:--'}</p>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <Badge
              variant={
                todayAttendance?.status === 'present'
                  ? 'default'
                  : todayAttendance?.status === 'late'
                    ? 'secondary'
                    : 'outline'
              }
              className="px-4 py-1 text-sm"
            >
              {todayAttendance?.checkOut ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  ກັບແລ້ວ 
                </>
              ) : todayAttendance?.checkIn ? (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  {todayAttendance.status === 'late' ? 'ເຂົ້າວຽກ (ຊ້າ)' : 'ເຂົ້າວຽກ'}
                </>
              ) : (
                <>
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  ຍັງບໍ່ເຂົ້າວຽກ
                </>
              )}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Button
          size="lg"
          className="h-16 text-lg"
          onClick={handleCheckIn}
          disabled={checkInMutation.isPending || !!todayAttendance?.checkIn || isLoadingHistory}
        >
          {checkInMutation.isPending ? (
            <Spinner className="mr-2" />
          ) : (
            <LogIn className="mr-2 h-5 w-5" />
          )}
          Check In
        </Button>

        <Button
          size="lg"
          variant="outline"
          className="h-16 text-lg"
          onClick={handleCheckOut}
          disabled={checkOutMutation.isPending || !todayAttendance?.checkIn || !!todayAttendance?.checkOut}
        >
          {checkOutMutation.isPending ? (
            <Spinner className="mr-2" />
          ) : (
            <LogOut className="mr-2 h-5 w-5" />
          )}
          Check Out
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ສະຫຼຸບປະຈຳອາທິດ</CardTitle>
          <CardDescription>ບັນທຶກ ການມາວຽກໃນອາທິດນີ້</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              ກຳລັງໂຫຼດປະຫວັດການມາວຽກ...
            </div>
          ) : (
            <div className="space-y-2">
              {weeklyHistory.map((record) => (
                <div key={record.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <div>
                    <p className="text-sm font-medium">{format(new Date(record.date), 'EEE, MMM d')}</p>
                    <p className="text-xs text-muted-foreground">
                      {record.checkIn || '--:--'} - {record.checkOut || '--:--'}
                    </p>
                  </div>
                  <Badge
                    variant={
                      record.status === 'present'
                        ? 'default'
                        : record.status === 'late'
                          ? 'secondary'
                          : record.status === 'leave'
                            ? 'outline'
                            : 'destructive'
                    }
                  >
                    {record.status === 'present'
                      ? 'ມາວຽກ'
                      : record.status === 'late'
                        ? 'ມາວຽກ (ຊ້າ)'
                        : record.status === 'leave'
                          ? 'ພັກ'
                          : 'ບໍ່ມາວຽກ'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
