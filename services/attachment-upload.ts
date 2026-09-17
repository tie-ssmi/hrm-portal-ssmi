// ** third party
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
  type UploadMetadata,
} from 'firebase/storage'

// ** config / utils / types / hooks
import { storage } from '@/lib/firebase'

// Last line of defence behind the selection-time check in lib/file-integrity.ts:
// if Storage ended up with fewer bytes than the File claimed, the object is
// truncated. Leaving it in the bucket would hand out a download URL that no
// viewer can open (admin renders PDFs in a plain <iframe>), so delete it and
// fail instead of returning the URL.
export const UPLOAD_TRUNCATED_MESSAGE =
  'ອັບໂຫຼດໄຟລ໌ບໍ່ຄົບ ກະລຸນາລອງໃໝ່ ຫຼື ເລືອກໄຟລ໌ອື່ນ'

// Carries the Lao message so call sites that only surface `error.message`
// (app/dashboard/request/leave-doc/page.tsx) still read correctly.
export class UploadTruncatedError extends Error {
  constructor(
    readonly expectedBytes: number,
    readonly storedBytes: number,
  ) {
    super(UPLOAD_TRUNCATED_MESSAGE)
    this.name = 'UploadTruncatedError'
  }
}

// Uploads to `path` and returns the download URL. Passing onProgress switches
// to the resumable uploader, which is the only one that reports progress.
export async function uploadAttachment(
  path: string,
  file: File,
  onProgress?: (percent: number) => void,
  metadata?: UploadMetadata,
): Promise<string> {
  const fileRef = storageRef(storage, path)

  const snapshot = onProgress
    ? await new Promise<Awaited<ReturnType<typeof uploadBytes>>>((resolve, reject) => {
        const task = uploadBytesResumable(fileRef, file, metadata)
        task.on(
          'state_changed',
          (snap) => onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          () => resolve(task.snapshot),
        )
      })
    : await uploadBytes(fileRef, file, metadata)

  const storedBytes = Number(snapshot.metadata.size)
  if (storedBytes !== file.size) {
    // Best-effort: a failed cleanup must not mask the real error.
    await deleteObject(fileRef).catch(() => {})
    throw new UploadTruncatedError(file.size, storedBytes)
  }

  return getDownloadURL(snapshot.ref)
}
