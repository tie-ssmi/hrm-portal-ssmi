import { getFunctions, httpsCallable } from 'firebase/functions'
import app from './firebase'

type CheckInStatus = 'present' | 'late' | 'not_check_in'

type ServerTimeResult = {
  date: string      // DD-MM-YYYY
  isoDate: string   // YYYY-MM-DD
  checkTime: string // HH:mm
  status: CheckInStatus
  isLate: boolean
  timestamp: number
}

type GetServerTimePayload = {
  userUuid?: string
}

let functionsInstance: ReturnType<typeof getFunctions> | null = null

function getFunctionsInstance() {
  if (!functionsInstance) {
    functionsInstance = getFunctions(app, 'asia-southeast1')
  }
  return functionsInstance
}

export async function fetchServerTime(userUuid?: string): Promise<ServerTimeResult> {
  const functions = getFunctionsInstance()
  const fn = httpsCallable<GetServerTimePayload, ServerTimeResult>(functions, 'getServerTime')
  const result = await fn({ userUuid })
  return result.data
}
