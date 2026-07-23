const TIMEZONE = 'Asia/Vientiane'

type CheckInStatus = 'present' | 'late' | 'not_check_in'

type ServerTimeResult = {
  date: string      // DD-MM-YYYY
  isoDate: string   // YYYY-MM-DD
  checkTime: string // HH:mm
  status: CheckInStatus
  isLate: boolean
  timestamp: number
}

function computeStatus(hour: number, minute: number): CheckInStatus {
  const nowMin = hour * 60 + minute
  if (nowMin <= 8 * 60 + 15) return 'present'
  if (nowMin < 10 * 60) return 'late'    // < not <=: exactly 10:00 is not_check_in
  return 'not_check_in'
}

// Synchronous "today" in Vientiane time — use this instead of `new Date()` /
// date-fns `format()` for any isoDate comparison against leave/attendance data,
// since those are all anchored to Asia/Vientiane regardless of the viewer's device timezone.
export function getVientianeIsoDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date())
}

export function fetchServerTime(_userUuid?: string): Promise<ServerTimeResult> {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'

  const day = get('day')
  const month = get('month')
  const year = get('year')
  const hour = get('hour')
  const minute = get('minute')

  const status = computeStatus(parseInt(hour, 10), parseInt(minute, 10))

  return Promise.resolve({
    date: `${day}-${month}-${year}`,
    isoDate: `${year}-${month}-${day}`,
    checkTime: `${hour}:${minute}`,
    status,
    isLate: status === 'late',
    timestamp: now.getTime(),
  })
}
