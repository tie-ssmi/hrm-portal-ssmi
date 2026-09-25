'use client'

// Device identity used server-side (functions/src/index.ts recordCheckIn/recordCheckOut)
// to stop one physical device being used to check in/out for more than one employee
// account per day ("buddy punching").
//
// localId is the ONLY signal that blocks a punch. fingerprint and model are sent and
// stored for review but never deny a request — free-tier visitorIds collide between
// different handsets of the same model, which blocked innocent employees. See the
// comment above assertDeviceNotUsedByOtherAccount for the full reasoning.

const DEVICE_ID_KEY = 'device_id'

export type DeviceInfo = {
  localId: string
  fingerprint: string
  model: string
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

// device_id identifies the physical device, not the logged-in account — a blanket
// localStorage.clear() on logout (lib/auth-context.tsx) must not wipe it, or the very
// next login on that device looks "new" and buddy-punch detection silently stops
// working (worst on iOS, which has no fingerprint fallback — see isIOSUserAgent in
// functions/src/index.ts). Call snapshotDeviceId() before clearing storage and
// restoreDeviceId() with its result right after.
export function snapshotDeviceId(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(DEVICE_ID_KEY)
}

export function restoreDeviceId(id: string | null): void {
  if (typeof window === 'undefined' || !id) return
  window.localStorage.setItem(DEVICE_ID_KEY, id)
}

// Chrome's User-Agent Reduction freezes the device model to a literal "K" on
// Android, so every handset looks identical in the UA string — one of the reasons
// FingerprintJS visitorIds collide between different phones of the same model.
// The real model is still available through the high-entropy Client Hints API,
// which is async and Chromium-only (Safari/Firefox return "").
//
// Stored for diagnostics only (scripts/check-device-conflict.js reads it to tell a
// collision from real device sharing); it does not take part in any block.
type UserAgentDataLike = {
  getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string }>
}

let modelPromise: Promise<string> | null = null

function loadDeviceModel(): Promise<string> {
  if (!modelPromise) {
    const uaData = (navigator as Navigator & { userAgentData?: UserAgentDataLike })
      .userAgentData
    modelPromise = uaData?.getHighEntropyValues
      ? uaData
          .getHighEntropyValues(['model'])
          .then((values) => values.model ?? '')
          .catch(() => '')
      : Promise.resolve('')
  }
  return modelPromise
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
  if (typeof window === 'undefined') {
    return { localId: '', fingerprint: '', model: '' }
  }
  const [localId, fingerprint, model] = await Promise.all([
    getLocalDeviceId(),
    loadFingerprint(),
    loadDeviceModel(),
  ])
  return { localId, fingerprint, model }
}
