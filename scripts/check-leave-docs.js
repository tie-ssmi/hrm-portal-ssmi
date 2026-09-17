/**
 * Audit every uploaded attachment in `leaves` and `workOutside`, reporting which
 * stored objects are not valid PDFs (missing %PDF- header or %%EOF trailer) and
 * which docLinks point at an object that no longer exists.
 *
 * The three upload sites write three distinguishable paths, so the report groups
 * by them — if the broken files cluster in one group, the bug is in that call
 * site rather than in the files users picked:
 *
 *   leaves/<uuid>/<ts>-<random>.<ext>  services/leaves.ts        uploadBytesResumable
 *   leaves/<uuid>/<ts>.<ext>           leave-request-form.tsx    uploadBytes
 *   workOutside/<uid>/<ts>.<ext>       offsite-request-form.tsx  uploadBytes
 *
 * Usage:
 *   node scripts/check-leave-docs.js <path-to-service-account.json>
 *
 * Get service account: Firebase Console → Project Settings → Service Accounts → Generate new private key
 */

const admin = require('firebase-admin')
const serviceAccount = require(process.argv[2] || './service-account.json')

const BUCKET = 'hrm-ssmi.firebasestorage.app'

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: BUCKET,
})
const db = admin.firestore()
const bucket = admin.storage().bucket()

// Download URLs look like
//   https://firebasestorage.googleapis.com/v0/b/<bucket>/o/leaves%2Fuid%2F123.pdf?alt=media&token=...
// so the object path is the percent-decoded segment between /o/ and the query.
function storagePathFromLink(link) {
  const m = /\/o\/([^?]+)/.exec(link)
  return m ? decodeURIComponent(m[1]) : null
}

function groupOf(path) {
  if (path.startsWith('workOutside/')) return 'workOutside/<uid>/<ts>          (offsite-request-form, uploadBytes)'
  // Second segment carries the random suffix only for the attach-later service.
  const name = path.split('/').pop() ?? ''
  return /^\d+-/.test(name)
    ? 'leaves/<uuid>/<ts>-<random>    (services/leaves.ts, uploadBytesResumable)'
    : 'leaves/<uuid>/<ts>             (leave-request-form, uploadBytes)'
}

async function inspect(path) {
  const file = bucket.file(path)

  let metadata
  try {
    ;[metadata] = await file.getMetadata()
  } catch (err) {
    if (err.code === 404) return { verdict: 'MISSING', detail: 'object not found in bucket' }
    return { verdict: 'ERROR', detail: err.message }
  }

  const size = Number(metadata.size)
  const contentType = metadata.contentType ?? '(none)'

  // Only PDFs have a structure worth validating; images either decode or don't.
  if (!path.toLowerCase().endsWith('.pdf')) {
    return { verdict: 'SKIP', detail: `not a pdf (${contentType}, ${size} bytes)`, size, contentType }
  }

  const head = (await file.download({ start: 0, end: 7 }))[0]
  // %%EOF sits within the last few bytes, but trailing whitespace is legal, so
  // read a generous tail rather than the exact last 5 bytes.
  const tailStart = Math.max(0, size - 2048)
  const tail = (await file.download({ start: tailStart, end: size - 1 }))[0]

  const hasHeader = head.subarray(0, 5).toString('latin1') === '%PDF-'
  const hasEof = tail.includes(Buffer.from('%%EOF', 'latin1'))

  if (!hasHeader) return { verdict: 'BROKEN', detail: `no %PDF- header (${contentType}, ${size} bytes)`, size, contentType }
  if (!hasEof) return { verdict: 'BROKEN', detail: `truncated — no %%EOF (${contentType}, ${size} bytes)`, size, contentType }
  return { verdict: 'OK', detail: `${size} bytes, ${contentType}`, size, contentType }
}

async function collect(collectionName, linkField) {
  const snap = await db.collection(collectionName).get()
  const rows = []
  for (const docSnap of snap.docs) {
    const link = docSnap.get(linkField)
    if (typeof link !== 'string' || !link) continue
    rows.push({ collection: collectionName, id: docSnap.id, link })
  }
  return rows
}

async function run() {
  const rows = [
    ...(await collect('leaves', 'docLink')),
    ...(await collect('workOutside', 'docLink')),
  ]

  console.log(`Found ${rows.length} document(s) with a docLink\n`)

  const byGroup = new Map()
  const broken = []

  for (const row of rows) {
    const path = storagePathFromLink(row.link)
    if (!path) {
      broken.push({ ...row, path: row.link, verdict: 'UNPARSEABLE', detail: 'docLink is not a Storage download URL' })
      continue
    }

    const result = await inspect(path)
    const group = groupOf(path)
    const stats = byGroup.get(group) ?? { OK: 0, BROKEN: 0, MISSING: 0, SKIP: 0, ERROR: 0 }
    stats[result.verdict] = (stats[result.verdict] ?? 0) + 1
    byGroup.set(group, stats)

    if (result.verdict === 'BROKEN' || result.verdict === 'MISSING' || result.verdict === 'ERROR') {
      broken.push({ ...row, path, ...result })
    }
  }

  console.log('=== By upload path ===')
  for (const [group, stats] of byGroup) {
    console.log(
      `${group}\n    ok=${stats.OK}  broken=${stats.BROKEN}  missing=${stats.MISSING}  skipped=${stats.SKIP}  error=${stats.ERROR}`,
    )
  }

  if (broken.length === 0) {
    console.log('\nNo broken attachments found.')
    return
  }

  console.log(`\n=== ${broken.length} problem file(s) ===`)
  for (const b of broken) {
    console.log(`[${b.verdict}] ${b.collection}/${b.id}`)
    console.log(`    ${b.path}`)
    console.log(`    ${b.detail}`)
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
