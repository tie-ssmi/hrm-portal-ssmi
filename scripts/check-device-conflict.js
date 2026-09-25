/**
 * Find which accounts shared a device on a given day, and why the server would
 * have blocked one of them in assertDeviceNotUsedByOtherAccount
 * (functions/src/index.ts) — i.e. answer "who is the other account?".
 *
 * The guard blocks on either signal, but they mean very different things:
 *
 *   deviceLocalId   random UUID in localStorage (lib/device.ts) — a match means
 *                   the same browser profile on the same phone. Real sharing.
 *   deviceFingerprint  FingerprintJS visitorId — a match with DIFFERENT localIds
 *                   is most likely a collision between two physical phones of the
 *                   same model/OS/browser, not sharing. Known to be bad on iOS
 *                   (hence isIOSUserAgent skips it there) but it happens on
 *                   identical Android handsets too.
 *
 * Nothing is written to auditLogs when a block fires, so this reconstructs it
 * from the attendance docs that did get written.
 *
 * Usage:
 *   node scripts/check-device-conflict.js <path-to-service-account.json> <YYYY-MM-DD> [userUuid|uid]
 *
 * Get service account: Firebase Console → Project Settings → Service Accounts → Generate new private key
 */

// firebase-admin is only installed under functions/ in this repo, not at the root.
const admin = (() => {
  try {
    return require('firebase-admin')
  } catch {
    return require('../functions/node_modules/firebase-admin')
  }
})()
const serviceAccount = require(process.argv[2] || './service-account.json')

const DATE_KEY = process.argv[3]
// Accepts either the employee userUuid or the Firebase Auth uid — attendance docs
// carry both (`uid` defaults to userUuid when the client omits it).
const ONLY_ID = process.argv[4] || null

if (!DATE_KEY || !/^\d{4}-\d{2}-\d{2}$/.test(DATE_KEY)) {
  console.error('Usage: node scripts/check-device-conflict.js <service-account.json> <YYYY-MM-DD> [userUuid|uid]')
  process.exit(1)
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

const nameOf = (d) => d.fullNameLo || d.fullNameEn || d.userUuid || '(no name)'
const short = (v) => (v ? String(v).slice(0, 12) + '…' : '—')

// Chrome/131.0.0.0 Mobile Safari + SM-A546E → "Android · SM-A546E · Chrome 131"
function platformOf(ua) {
  if (!ua) return '—'
  const os = /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Android/i.test(ua) ? 'Android' : 'desktop/other'
  const model = /Android[^;]*;\s*([^;)]+)/i.exec(ua)?.[1]?.trim()
  const browser = /(Chrome|CriOS|Firefox|Edg)\/(\d+)/i.exec(ua)
  return [os, model, browser && `${browser[1]} ${browser[2]}`].filter(Boolean).join(' · ')
}

// Two check-ins hundreds of metres apart cannot be the same handset, whatever
// the fingerprint says. checkInLocation is already on every doc that has GPS.
function metresBetween(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null
  const R = 6371000
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(h)))
}

// Group by one device signal; keep only groups that more than one account touched.
function conflictsBy(docs, field) {
  const groups = new Map()
  for (const d of docs) {
    const key = d[field]
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(d)
  }
  return [...groups.entries()].filter(
    ([, rows]) => new Set(rows.map((r) => r.userUuid)).size > 1,
  )
}

function printGroup(field, key, rows) {
  console.log(`\n  ${field} = ${key}`)
  for (const r of rows.sort((a, b) => (a.checkInTime || '').localeCompare(b.checkInTime || ''))) {
    console.log(`    ${nameOf(r).padEnd(28)} uuid=${short(r.userUuid)}`)
    console.log(`      in ${(r.checkInTime || '—').padEnd(6)} out ${(r.checkOutTime || '—').padEnd(6)} dept=${r.department?.nameLo || r.department?.name || r.department || '—'}`)
    console.log(`      localId=${short(r.deviceLocalId)}  fp=${short(r.deviceFingerprint)}  model=${r.deviceModel || '(not reported)'}`)
    console.log(`      in : ip=${r.checkInIp || '—'}  ${platformOf(r.checkInUserAgent)}`)
    console.log(`      out: ip=${r.checkOutIp || '—'}  ${platformOf(r.checkOutUserAgent)}`)
  }

  // The verdict the guard itself can't make: same fingerprint but different
  // localIds is the collision signature, not the buddy-punch signature.
  if (field === 'deviceFingerprint') {
    const localIds = new Set(rows.map((r) => r.deviceLocalId).filter(Boolean))
    const ips = new Set(rows.map((r) => r.checkInIp).filter(Boolean))
    const evidence = []
    if (localIds.size > 1) evidence.push(`${localIds.size} different deviceLocalIds`)
    const models = new Set(rows.map((r) => r.deviceModel).filter(Boolean))
    if (models.size > 1) evidence.push(`different handset models (${[...models].join(', ')})`)
    if (ips.size > 1) evidence.push(`${ips.size} different check-in IPs`)

    for (let i = 0; i < rows.length; i += 1) {
      for (let j = i + 1; j < rows.length; j += 1) {
        const d = metresBetween(rows[i].checkInLocation, rows[j].checkInLocation)
        if (d == null) continue
        console.log(`      GPS ${nameOf(rows[i])} <-> ${nameOf(rows[j])}: ${d} m apart at check-in`)
        if (d > 300) evidence.push(`check-ins ${d} m apart`)
      }
    }

    if (evidence.length > 0) {
      console.log(`      !! FINGERPRINT COLLISION likely: ${evidence.join(', ')}`)
      console.log('         two separate phones of the same model/OS/browser, not device sharing')
    } else {
      console.log('      -> every other signal agrees too: same physical device')
    }
  }
}

async function main() {
  const snap = await db.collection('attendance').where('dateKey', '==', DATE_KEY).get()
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  console.log(`attendance docs on ${DATE_KEY}: ${docs.length}`)

  const isTarget = (r) => r.userUuid === ONLY_ID || r.uid === ONLY_ID
  const scope = ONLY_ID ? docs.filter(isTarget) : docs
  if (ONLY_ID && scope.length === 0) {
    console.log(`
No attendance doc for ${ONLY_ID} on ${DATE_KEY}`)
    console.log('(checked both the userUuid and uid fields)')
    return
  }
  for (const r of scope.filter(() => ONLY_ID)) {
    console.log(`
target: ${nameOf(r)}  userUuid=${r.userUuid}  uid=${r.uid}`)
    console.log(`  in ${r.checkInTime || '-'}  out ${r.checkOutTime || '-'}`)
    console.log(`  localId=${r.deviceLocalId || '-'}`)
    console.log(`  model  =${r.deviceModel || '(not reported - pre-fix record or non-Chromium)'}`)
    console.log(`  fp     =${r.deviceFingerprint || '-'}`)
  }

  // With an id given, only report groups that account is actually part of.
  const keep = ONLY_ID ? ([, rows]) => rows.some(isTarget) : () => true

  let found = 0
  for (const field of ['deviceLocalId', 'deviceFingerprint']) {
    const groups = conflictsBy(docs, field).filter(keep)
    if (groups.length === 0) continue
    console.log(`\n=== shared ${field} (${groups.length}) ===`)
    for (const [key, rows] of groups) {
      printGroup(field, key, rows)
      found += 1
    }
  }

  if (found === 0) {
    console.log(ONLY_ID
      ? `\nNo other account shares a device signal with ${ONLY_ID} on ${DATE_KEY}.`
      : `\nNo shared device signals on ${DATE_KEY}.`)
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err)
  process.exit(1)
})
