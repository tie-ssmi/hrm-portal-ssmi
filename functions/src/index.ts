import * as admin from 'firebase-admin'
import { onCall } from 'firebase-functions/v2/https'

admin.initializeApp()

const TIMEZONE = 'Asia/Vientiane'

type ServerTimeResult = {
  date: string      // DD-MM-YYYY
  isoDate: string   // YYYY-MM-DD
  checkTime: string // HH:mm
  isLate: boolean
  timestamp: number
}

function getVientianeParts(): Omit<ServerTimeResult, 'isLate' | 'timestamp'> {
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
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00'

  const day = get('day')
  const month = get('month')
  const year = get('year')
  const hour = get('hour')
  const minute = get('minute')

  return {
    date: `${day}-${month}-${year}`,       // DD-MM-YYYY
    isoDate: `${year}-${month}-${day}`,    // YYYY-MM-DD
    checkTime: `${hour}:${minute}`,        // HH:mm
  }
}

export const getServerTime = onCall(
  { region: 'asia-southeast1', cors: true },
  async (): Promise<ServerTimeResult> => {
    const { date, checkTime, isoDate } = getVientianeParts()
    const [hourStr, minuteStr] = checkTime.split(':')
    const hour = parseInt(hourStr, 10)
    const minute = parseInt(minuteStr, 10)
    const isLate = hour > 8 || (hour === 8 && minute > 15)

    return {
      date,
      isoDate,
      checkTime,
      isLate,
      timestamp: Date.now(),
    }
  }
)
