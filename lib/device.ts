'use client'

// Device identity used server-side (functions/src/index.ts recordCheckIn/recordCheckOut)
// to stop one physical device being used to check in/out for more than one employee
// account per day ("buddy punching"). localId is the primary signal; fingerprint is a
// backup that survives localStorage being cleared or incognito mode.

const DEVICE_ID_KEY = 'device_id'

export type DeviceInfo = {
  localId: string
  fingerprint: string
}

function getLocalDeviceId(): string {
  if (typeof window === 'undefined') return ''

  let id = window.localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    window.localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

let fingerprintPromise: Promise<string> | null = null

// Cached for the lifetime of the tab — FingerprintJS agent load is not free,
// and the visitorId doesn't change between check-in and check-out calls.
function loadFingerprint(): Promise<string> {
  if (!fingerprintPromise) {
    fingerprintPromise = import('@fingerprintjs/fingerprintjs')
      .then((FingerprintJS) => FingerprintJS.load())
      .then((agent) => agent.get())
      .then((result) => result.visitorId)
      .catch(() => '')
  }
  return fingerprintPromise
}

export async function getDeviceInfo(): Promise<DeviceInfo> {
  const [localId, fingerprint] = await Promise.all([
    getLocalDeviceId(),
    loadFingerprint(),
  ])
  return { localId, fingerprint }
}
