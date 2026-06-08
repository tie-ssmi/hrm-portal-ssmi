/**
 * Backfill `participantUids` for workOutside docs that were created before the form fix.
 * Docs with object-format `participantIds` but no `participantUids` won't appear in
 * participant queries — this script adds the flat UID array so they become queryable.
 *
 * Usage:
 *   node scripts/backfill-participant-uids.js <path-to-service-account.json>
 *
 * Get service account: Firebase Console → Project Settings → Service Accounts → Generate new private key
 */

const admin = require('firebase-admin')
const serviceAccount = require(process.argv[2] || './service-account.json')

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

async function run() {
  const snap = await db.collection('workOutside').get()

  let checked = 0
  let skipped = 0
  let updated = 0
  let failed = 0

  const batch = db.batch()
  let batchSize = 0

  for (const docSnap of snap.docs) {
    checked++
    const data = docSnap.data()

    // Already has the flat array — skip
    if (Array.isArray(data.participantUids) && data.participantUids.length > 0) {
      skipped++
      continue
    }

    const participantIds = data.participantIds
    if (!Array.isArray(participantIds)) {
      skipped++
      continue
    }

    const uids = participantIds
      .map((p) => (typeof p === 'string' ? p : p?.uid))
      .filter(Boolean)

    if (uids.length === 0) {
      skipped++
      continue
    }

    batch.update(docSnap.ref, { participantUids: uids })
    batchSize++
    updated++

    // Firestore batch limit is 500 writes
    if (batchSize === 500) {
      await batch.commit()
      batchSize = 0
      console.log(`  committed 500 writes...`)
    }
  }

  if (batchSize > 0) {
    await batch.commit()
  }

  console.log(`\nDone — checked: ${checked}, updated: ${updated}, skipped: ${skipped}, failed: ${failed}`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
