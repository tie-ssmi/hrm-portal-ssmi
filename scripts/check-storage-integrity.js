/**
 * Audit EVERY object in the Storage bucket for truncation, not just the PDFs
 * reachable from a `docLink` (that was scripts/check-leave-docs.js).
 *
 * Why the wider net: the Android WebView truncation that produced ~9% broken
 * PDFs also affects images, and images are uploaded from more places than the
 * leave/offsite attachment form — check-in photos (services/attendance.ts,
 * components/cameraUpload.tsx) and the admin app's own uploads
 * (profile-images/, doc/, movements/ — written by the separate HRM-System-SSMI
 * repo) never pass through components/fileUpload.tsx at all.
 *
 * Grouping by top-level prefix shows which uploader is producing bad bytes, so
 * the guard only gets added where it is actually needed.
 *
 * Format checks (header + end-of-file marker — a truncated file keeps its
 * header and loses its trailer):
 *   pdf   %PDF-            .. %%EOF
 *   jpeg  FF D8 FF         .. FF D9
 *   png   89 50 4E 47 ..   .. IEND + CRC
 *   webp  RIFF....WEBP     .. RIFF chunk size matches the object size
 *
 * Usage:
 *   NODE_PATH=functions/node_modules node scripts/check-storage-integrity.js <service-account.json>
 *
 * Add --verbose to list every OK file too.
 */

const admin = require('firebase-admin')
const serviceAccount = require(process.argv[2] || './service-account.json')

const VERBOSE = process.argv.includes('--verbose')
const BUCKET = 'hrm-ssmi.firebasestorage.app'
const TAIL_BYTES = 2048

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: BUCKET,
})
const bucket = admin.storage().bucket()

const has = (buf, marker) => buf.includes(Buffer.from(marker, 'latin1'))

// What the bytes actually are, regardless of the extension/contentType. A file
// stored as .webp that really holds JPEG bytes is mislabelled, not truncated —
// two very different problems, so never report one as the other.
function sniff(head) {
  if (head.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf'
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg'
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp'
  if (head.subarray(0, 4).toString('latin1') === 'GIF8') return 'gif'
  return 'unknown'
}

function kindOf(name, contentType) {
  const ext = (name.split('.').pop() ?? '').toLowerCase()
  const ct = (contentType ?? '').toLowerCase()
  if (ext === 'pdf' || ct === 'application/pdf') return 'pdf'
  if (['jpg', 'jpeg'].includes(ext) || ct === 'image/jpeg') return 'jpeg'
  if (ext === 'png' || ct === 'image/png') return 'png'
  if (ext === 'webp' || ct === 'image/webp') return 'webp'
  return null
}

/** null = looks intact, string = why it is broken */
function verdictFor(kind, head, tail, size) {
  switch (kind) {
    case 'pdf':
      if (head.subarray(0, 5).toString('latin1') !== '%PDF-') return 'no %PDF- header'
      return has(tail, '%%EOF') ? null : 'truncated — no %%EOF'

    case 'jpeg':
      // SOI is FF D8 FF; EOI is FF D9. Some cameras append EXIF/thumbnail junk
      // after EOI, so search the tail rather than demanding the last two bytes.
      if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) return 'no JPEG SOI header'
      return tail.includes(Buffer.from([0xff, 0xd9])) ? null : 'truncated — no JPEG EOI (FFD9)'

    case 'png': {
      const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      if (!head.subarray(0, 8).equals(sig)) return 'no PNG signature'
      // A complete PNG always ends with the 12-byte IEND chunk.
      return has(tail, 'IEND') ? null : 'truncated — no PNG IEND chunk'
    }

    case 'webp': {
      if (head.subarray(0, 4).toString('latin1') !== 'RIFF') return 'no RIFF header'
      if (head.subarray(8, 12).toString('latin1') !== 'WEBP') return 'not a WEBP RIFF'
      // RIFF stores (file size - 8) at offset 4, little endian — a short upload
      // leaves the declared size larger than what is stored.
      const declared = head.readUInt32LE(4) + 8
      return declared === size ? null : `truncated — RIFF declares ${declared} bytes, stored ${size}`
    }

    default:
      return null
  }
}

async function inspect(file) {
  const size = Number(file.metadata.size)
  const kind = kindOf(file.name, file.metadata.contentType)
  if (!kind) return { verdict: 'SKIP', kind: 'other' }
  if (size === 0) return { verdict: 'BROKEN', kind, detail: 'empty object (0 bytes)', size }

  const head = (await file.download({ start: 0, end: Math.min(15, size - 1) }))[0]
  const tail = (await file.download({ start: Math.max(0, size - TAIL_BYTES), end: size - 1 }))[0]

  // Judge the file by what it really is. If that disagrees with the extension
  // the file is merely mislabelled — still openable, so report it separately
  // instead of raising a false truncation alarm.
  const actual = sniff(head)
  if (actual === 'unknown') {
    return { verdict: 'BROKEN', kind, detail: `unrecognised content (${size} bytes)`, size }
  }
  const why = verdictFor(actual, head, tail, size)
  if (why) return { verdict: 'BROKEN', kind: actual, detail: `${why} (${size} bytes)`, size }
  return actual === kind
    ? { verdict: 'OK', kind, size }
    : { verdict: 'MISLABELLED', kind, detail: `stored as .${kind} but bytes are ${actual} — intact`, size }
}

// leaves/<uid>/<ts>-<rand>.pdf and leaves/<uid>/<ts>.pdf come from different
// call sites, so keep them apart; everything else groups by top-level folder.
function groupOf(name) {
  const top = name.split('/')[0]
  if (top === 'leaves') {
    return /^\d+-/.test(name.split('/').pop() ?? '')
      ? 'leaves/<uid>/<ts>-<rand>   portal  services/leaves.ts (attach later)'
      : 'leaves/<uid>/<ts>          portal  leave-request-form'
  }
  if (top === 'images') {
    const sub = name.split('/')[1] ?? ''
    const owner = {
      combinedDocs: 'portal  profile/edit -> cameraUpload',
      photo3x4: 'portal  profile/edit -> cameraUpload',
      photos3x4: 'admin   register.tsx -> uploadImageWithUUID',
    }[sub]
    return `images/${sub}/`.padEnd(26) + (owner ?? '')
  }
  const labels = {
    workOutside: 'workOutside/              portal  offsite-request-form',
    attendance: 'attendance/               portal  attendance / cameraUpload',
    'profile-images': 'profile-images/           admin   firebaseStorage.ts',
    doc: 'doc/                      admin   uploadEmployeeDocument',
    movements: 'movements/                admin   uploadMovementAttachment',
  }
  return labels[top] ?? `${top}/`
}

async function run() {
  console.log(`Scanning gs://${BUCKET} ...\n`)
  const [files] = await bucket.getFiles()

  const byGroup = new Map()
  const broken = []
  const mislabelled = []
  let checked = 0

  for (const file of files) {
    if (file.name.endsWith('/')) continue // folder placeholder
    const result = await inspect(file)
    const group = groupOf(file.name)
    const stats = byGroup.get(group) ?? { OK: 0, BROKEN: 0, MISLABELLED: 0, SKIP: 0 }
    stats[result.verdict] += 1
    byGroup.set(group, stats)
    checked += 1
    if (result.verdict === 'BROKEN') broken.push({ name: file.name, ...result })
    if (result.verdict === 'MISLABELLED') mislabelled.push({ name: file.name, ...result })
    if (VERBOSE && result.verdict === 'OK') console.log(`[OK] ${file.name}`)
  }

  console.log(`Inspected ${checked} object(s)\n`)
  console.log('=== By upload site ===')
  for (const [group, s] of [...byGroup.entries()].sort()) {
    const validated = s.OK + s.BROKEN + s.MISLABELLED
    const rate = validated ? ` — ${((s.BROKEN / validated) * 100).toFixed(1)}% broken` : ''
    console.log(
      `${group}\n    ok=${s.OK}  BROKEN=${s.BROKEN}  mislabelled=${s.MISLABELLED}  skipped=${s.SKIP}${rate}`,
    )
  }

  if (mislabelled.length) {
    console.log(`\n=== ${mislabelled.length} mislabelled but INTACT (wrong extension only, still opens) ===`)
    const byReason = new Map()
    for (const m of mislabelled) byReason.set(m.detail, (byReason.get(m.detail) ?? 0) + 1)
    for (const [reason, n] of byReason) console.log(`  ${n} x ${reason}`)
  }

  if (!broken.length) {
    console.log('\nNo truncated files found.')
    return
  }

  console.log(`\n=== ${broken.length} broken file(s) ===`)
  for (const b of broken) console.log(`[${b.kind}] ${b.name}\n    ${b.detail}`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
