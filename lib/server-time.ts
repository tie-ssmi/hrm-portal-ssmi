import { getFunctions, httpsCallable } from 'firebase/functions'
import app from './firebase'

type ServerTimeResult = {
  date: string      // DD-MM-YYYY
  isoDate: string   // YYYY-MM-DD
  checkTime: string // HH:mm
  isLate: boolean
  timestamp: number
}

let functionsInstance: ReturnType<typeof getFunctions> | null = null

function getFunctionsInstance() {
  if (!functionsInstance) {
    functionsInstance = getFunctions(app, 'asia-southeast1')
  }
  return functionsInstance
}

export async function fetchServerTime(): Promise<ServerTimeResult> {
  const functions = getFunctionsInstance()
  const fn = httpsCallable<void, ServerTimeResult>(functions, 'getServerTime')
  const result = await fn()
  return result.data
}
