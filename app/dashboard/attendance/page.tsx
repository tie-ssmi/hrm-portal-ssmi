'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { AttendanceRecord } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'
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
  MapPinOff,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { addDays, format, startOfWeek } from 'date-fns'
import { CameraCapture } from '@/components/camera-capture'
type LocationState = {
  lat: number
  lng: number
  accuracy: number
  error?: string
}
import {formatDateLao, formatDayDateLao} from '@/components/laoDate'
// const LAO_DAYS   = ['ວັນອາທິດ','ວັນຈັນ','ວັນອັງຄານ','ວັນພຸດ','ວັນພະຫັດ','ວັນສຸກ','ວັນເສົາ']
// const LAO_MONTHS = ['ມັງກອນ (1)','ກຸມພາ (2)','ມີນາ (3)','ເມສາ (4)','ພຶດສະພາ (5)','ມິຖຸນາ (6)','ກໍລະກົດ (7)','ສິງຫາ (8)','ກັນຍາ (9)','ຕຸລາ (10)','ພະຈິກ (11)','ທັນວາ (12)']
// function formatDateLao(date: Date): string {
//   return `${LAO_DAYS[date.getDay()]}, ${date.getDate()} ${LAO_MONTHS[date.getMonth()]} ${date.getFullYear()}`
// }
// Isolated component — 1s interval only re-renders this, not the whole page
const LiveClock = memo(function LiveClock() {
  const [time, setTime] = useState<Date | null>(null)

  useEffect(() => {
    setTime(new Date())
    const id = window.setInterval(() => setTime(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <Card className="bg-primary text-primary-foreground">
      <CardContent className="pt-6">
        <div className="text-center">
          <p className="text-sm opacity-80">ເວລາປະຈຸບັນ</p>
          <p className="mt-1 text-4xl font-bold">
            {time ? format(time, 'HH:mm:ss') : '--:--:--'}
          </p>
          <p className="mt-2 text-sm opacity-80">
            {time ? formatDayDateLao(new Date()) : ''}
          </p>
        </div>
      </CardContent>
    </Card>
  )
})

export default function AttendancePage() {
  const { user } = useAuth()
  const { distanceToOffice, geoFenceStatus } = useHRM()

  const { data: todayAttendance, isLoading: isLoadingHistory } = useTodayAttendance(user?.uuid)
  const { data: attendanceHistory = [] } = useAttendanceHistory(user?.uuid)
  const checkInMutation = useCheckIn()
  const checkOutMutation = useCheckOut()

  const [location, setLocation] = useState<LocationState | null>(null)
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
  const [isOffsite, setIsOffsite] = useState(false)
  const [offsiteDetail, setOffsiteDetail] = useState<AttendanceRecord | null>(null)

  // Camera dialog state
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraType, setCameraType] = useState<'checkIn' | 'checkOut'>('checkIn')
  const pendingResolveRef = useRef<((file: File | null) => void) | null>(null)

  function captureImage(type: 'checkIn' | 'checkOut'): Promise<File | null> {
    return new Promise((resolve) => {
      pendingResolveRef.current = resolve
      setCameraType(type)
      setCameraOpen(true)
    })
  }

  const handleCameraCapture = useCallback((file: File) => {
    pendingResolveRef.current?.(file)
    pendingResolveRef.current = null
  }, [])

  const handleCameraClose = useCallback((open: boolean) => {
    setCameraOpen(open)
    if (!open) {
      // User closed without capturing — resolve with null
      pendingResolveRef.current?.(null)
      pendingResolveRef.current = null
    }
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

  const getValidatedLocation = useCallback(async (): Promise<LocationState | null> => {
    const loc = await getLocation()
    if (!loc) {
      toast.error('ບໍ່ສາມາດຮັບຂໍ້ມູນສະຖານທີ່. ກະລຸນາເປີດ GPS ແລະອະນຸຍາດການເຂົ້າເຖິງສະຖານທີ່.')
      return null
    }
    // Skip distance check if office has no coordinates configured
    if (geoFenceStatus === 'no_coordinates') return loc

    const dist = distanceToOffice(loc.lat, loc.lng)
    if (dist === null) {
      toast.error('ບໍ່ສາມາດໂຫຼດຂໍ້ມູນສະຖານທີ່ຫ້ອງການໄດ້. ກະລຸນາລອງໃໝ່.')
      return null
    }
    if (dist > 50) {
      toast.error(`ທ່ານຢູ່ຫ່າງຈາກຫ້ອງການ ${dist} ແມັດ. ຕ້ອງຢູ່ພາຍໃນ 50 ແມັດ.`)
      return null
    }
    return loc
  }, [getLocation, distanceToOffice])

  // Merged handler — eliminates duplicate logic between checkIn / checkOut
  const handleAttendance = useCallback(async (type: 'checkIn' | 'checkOut') => {
    if (!user) {
      toast.error('ບໍ່ເຫັນຂໍ້ມູນຜູ້ໃຊ້. ກະລຸນາເຂົ້າລະບົບອີກຄັ້ງ.')
      return
    }
    try {
      if (isOffsite) {
        const imageFile = await captureImage(type)
        if (!imageFile) {
          toast.error('ກະລຸນາຖ່າຍຮູບກ່ອນ.')
          return
        }
        const loc = await getLocation()
        const payload = {
          user,
          location: loc ? { lat: loc.lat, lng: loc.lng } : undefined,
          imageFile,
          isOffsite: true,
        }
        if (type === 'checkIn') {
          await checkInMutation.mutateAsync(payload)
          toast.success('ເຂົ້າວຽກນອກສຳເລັດ')
        } else {
          await checkOutMutation.mutateAsync(payload)
          toast.success('ອອກວຽກນອກສຳເລັດ')
        }
      } else {
        const loc = await getValidatedLocation()
        if (!loc) return
        const payload = { user, location: { lat: loc.lat, lng: loc.lng } }
        if (type === 'checkIn') {
          await checkInMutation.mutateAsync(payload)
          toast.success('ເຂົ້າການສຳເລັດແລ້ວ')
        } else {
          await checkOutMutation.mutateAsync(payload)
          toast.success('ອອກຈາກການສຳເລັດແລ້ວ')
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ເກີດຂໍ້ຜິດພາດ. ກະລຸນາລອງໃໝ່.')
    }
  }, [user, isOffsite, getLocation, getValidatedLocation, checkInMutation, checkOutMutation, handleCameraCapture])

  const officeDistance = useMemo(() => {
    if (!location || location.error) return null
    return distanceToOffice(location.lat, location.lng)
  }, [distanceToOffice, location])

  // Memoized — only recalculates when location or officeDistance changes, not every 1s
  const isWithinOffice = useMemo(() => {
    if (!location || !!location.error) return true
    if (geoFenceStatus === 'no_coordinates') return true  // no fence configured → allow
    return officeDistance !== null && officeDistance <= 50
  }, [location, officeDistance, geoFenceStatus])

  // todayIso in deps prevents stale week boundary if app stays open across midnight
  const todayIso = format(new Date(), 'yyyy-MM-dd')
  const weeklyHistory = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    const weekStartIso = format(weekStart, 'yyyy-MM-dd')
    const weekEndIso = format(addDays(weekStart, 6), 'yyyy-MM-dd')
    return attendanceHistory
      .filter((r) => {
        const d = r.date.slice(0, 10)
        return d >= weekStartIso && d <= weekEndIso
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [attendanceHistory, todayIso])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Check-In / Check-Out</h1>
        <p className="text-muted-foreground">ບັນທຶກການເຂົ້າຮ່ວມຂອງທ່ານດ້ວຍການຢັ້ງຢືນ GPS</p>
      </div>

      <LiveClock />

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
              {isLoadingLocation ? <Spinner className="mr-2" /> : <Navigation className="mr-2 h-4 w-4" />}
              ດຶງຂໍ້ມູນຕຳແໜ່ງໃໝ່
            </Button>

            {location && !location.error && (
              <Badge variant={isWithinOffice ? 'default' : 'destructive'} className="flex items-center gap-1">
                {isWithinOffice ? (
                  <><Shield className="h-3 w-3" /> ຢູ່ໃນພື້ນທີ່ຫ້ອງການ</>
                ) : (
                  <><ShieldX className="h-3 w-3" /> ຢູ່ນອກພື້ນທີ່ຫ້ອງການ</>
                )}
              </Badge>
            )}
          </div>

          {location && !location.error && (
            <div className="mt-3 space-y-2">
              {geoFenceStatus === 'loading' && (
                <p className="text-xs text-muted-foreground">ກຳລັງໂຫຼດຂໍ້ມູນສະຖານທີ່ຫ້ອງການ...</p>
              )}

              {geoFenceStatus === 'no_coordinates' && (
                <p className="text-xs text-amber-600">ຫ້ອງການຍັງບໍ່ໄດ້ຕັ້ງຄ່າພິກັດ GPS — ການກວດສອບໄລຍະຖືກຂ້າມ</p>
              )}

              {geoFenceStatus === 'not_found' && (
                <p className="text-xs text-destructive">ບໍ່ພົບຂໍ້ມູນສະຖານທີ່ຫ້ອງການ</p>
              )}

              {geoFenceStatus === 'found' && officeDistance !== null && (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">ໄກຈາກຫ້ອງການ</span>
                    <span className={`font-semibold tabular-nums ${officeDistance > 50 ? 'text-destructive' : 'text-emerald-600'}`}>
                      {officeDistance} / 50 ແມັດ
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${officeDistance > 50 ? 'bg-destructive' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.max(Math.min((officeDistance / 50) * 100, 100), 4)}%` }}
                    />
                  </div>
                </>
              )}

              <p className="text-xs text-muted-foreground">
                ຄວາມແມ່ນຍໍາ GPS: {Math.round(location.accuracy)} ແມັດ
              </p>
            </div>
          )}

          {location?.error && (
            <p className="mt-2 text-xs text-destructive">{location.error}</p>
          )}
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
              {isLoadingHistory ? (
                <Skeleton className="h-7 w-16 mx-auto mt-1" />
              ) : (
                <p className="text-xl font-bold text-foreground">{todayAttendance?.checkIn || '--:--'}</p>
              )}
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="mb-1 text-xs text-muted-foreground">ອອກວຽກ</p>
              {isLoadingHistory ? (
                <Skeleton className="h-7 w-16 mx-auto mt-1" />
              ) : (
                <p className="text-xl font-bold text-foreground">{todayAttendance?.checkOut || '--:--'}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center">
            {isLoadingHistory ? (
              <Skeleton className="h-8 w-36 rounded-full" />
            ) : (
              <Badge
                variant={
                  todayAttendance?.status === 'present' ? 'default'
                    : todayAttendance?.status === 'late' ? 'secondary'
                    : todayAttendance?.status === 'not_check_in' ? 'destructive'
                    : 'outline'
                }
                className="px-4 py-1 text-sm"
              >
                {todayAttendance?.checkOut ? (
                  <><CheckCircle className="mr-2 h-4 w-4" /> ກັບແລ້ວ</>
                ) : todayAttendance?.status === 'not_check_in' ? (
                  <><AlertTriangle className="mr-2 h-4 w-4" /> ລືມກົດເຂົ້າວຽກ</>
                ) : todayAttendance?.checkIn ? (
                  <><Clock className="mr-2 h-4 w-4" /> {todayAttendance.status === 'late' ? 'ເຂົ້າວຽກ (ຊ້າ)' : 'ເຂົ້າວຽກ'}</>
                ) : (
                  <><AlertTriangle className="mr-2 h-4 w-4" /> ຍັງບໍ່ເຂົ້າວຽກ</>
                )}
              </Badge>
            )}
          </div>

          {/* Offsite checkbox — mobile only */}
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2.5 ">
            <Checkbox
              id="offsite-mode"
              checked={isOffsite}
              onCheckedChange={(v) => setIsOffsite(v === true)}
            />
            <Label htmlFor="offsite-mode" className="flex items-center gap-1.5 cursor-pointer text-sm select-none">
              <MapPinOff className="h-3.5 w-3.5 text-muted-foreground" />
              ອອກວຽກນອກ
            </Label>
            {isOffsite && (
              <span className="ml-auto text-[10px] text-amber-600 font-medium">ບໍ່ກວດໄລຍະ · ຕ້ອງຖ່າຍຮູບ</span>
            )}
          </div>

          {/* Camera capture dialog — replaces broken <input capture> */}
          <CameraCapture
            open={cameraOpen}
            onOpenChange={handleCameraClose}
            onCapture={handleCameraCapture}
            title={cameraType === 'checkIn' ? 'ຖ່າຍຮູບເຂົ້າວຽກ' : 'ຖ່າຍຮູບອອກວຽກ'}
          />
        </CardContent>
      </Card>

      {isLoadingHistory ? (
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Button
            size="lg"
            className="h-16 text-lg"
            onClick={() => handleAttendance('checkIn')}
            disabled={checkInMutation.isPending || !!todayAttendance?.checkIn || (!isOffsite && !isWithinOffice)}
          >
            {checkInMutation.isPending ? <Spinner className="mr-2" /> : <LogIn className="mr-2 h-5 w-5" />}
            Check In
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="h-16 text-lg"
            onClick={() => handleAttendance('checkOut')}
            disabled={checkOutMutation.isPending || !todayAttendance?.checkIn || !!todayAttendance?.checkOut || (!isOffsite && !isWithinOffice)}
          >
            {checkOutMutation.isPending ? <Spinner className="mr-2" /> : <LogOut className="mr-2 h-5 w-5" />}
            Check Out
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ສະຫຼຸບປະຈຳອາທິດ</CardTitle>
          <CardDescription>ບັນທຶກ ການມາວຽກໃນອາທິດນີ້</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-14 rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {weeklyHistory.map((record) => (
                <div
                  key={record.id}
                  className={[
                    'flex items-center justify-between rounded-lg bg-muted/50 p-3',
                    record.isOffsite ? 'cursor-pointer hover:bg-muted/80 transition-colors' : '',
                  ].join(' ')}
                  onClick={() => record.isOffsite && setOffsiteDetail(record)}
                >
                  <div>
                    <p className="text-sm font-medium">
                      {formatDateLao(new Date(record.date))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {record.checkIn || '--:--'} - {record.checkOut || '--:--'}
                    </p>
                  </div>
                  <Badge
                    variant={
                      record.status === 'present' ? 'default'
                        : record.status === 'late' ? 'secondary'
                        : record.status === 'leave' ? 'outline'
                        : 'destructive'
                    }
                  >
                    {record.isOffsite && record.status === 'present' ? 'ອອກວຽກນອກ'
                      : record.isOffsite && record.status === 'late' ? 'ອອກວຽກນອກ (ຊ້າ)'
                      : record.status === 'present' ? 'ມາວຽກ'
                      : record.status === 'late' ? 'ມາວຽກ (ຊ້າ)'
                      : record.status === 'leave' ? 'ພັກ'
                      : 'ບໍ່ມາວຽກ'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Offsite detail dialog */}
      <Dialog open={!!offsiteDetail} onOpenChange={(open) => { if (!open) setOffsiteDetail(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ລາຍລະອຽດອອກວຽກນອກ</DialogTitle>
          </DialogHeader>
          {offsiteDetail && (
            <div className="space-y-4">
              {/* Check-in */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ເຂົ້າວຽກ</p>
                <p className="text-sm font-semibold">{offsiteDetail.checkIn || '--:--'}</p>
                {offsiteDetail.checkInImageURL ? (
                  <img
                    src={offsiteDetail.checkInImageURL}
                    alt="ຮູບເຂົ້າວຽກ"
                    className="w-full rounded-lg object-cover max-h-48 bg-muted"
                  />
                ) : (
                  <div className="flex h-24 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                    ບໍ່ມີຮູບ
                  </div>
                )}
              </div>

              <div className="border-t" />

              {/* Check-out */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ອອກວຽກ</p>
                <p className="text-sm font-semibold">{offsiteDetail.checkOut || '--:--'}</p>
                {offsiteDetail.checkOutImageURL ? (
                  <img
                    src={offsiteDetail.checkOutImageURL}
                    alt="ຮູບອອກວຽກ"
                    className="w-full rounded-lg object-cover max-h-48 bg-muted"
                  />
                ) : (
                  <div className="flex h-24 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                    ບໍ່ມີຮູບ
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
