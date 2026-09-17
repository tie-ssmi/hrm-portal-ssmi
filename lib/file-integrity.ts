// Android WebView sometimes hands back a truncated File when it reads a
// content:// URI — the picker reports a size, but the bytes stop early. A scan
// of the whole Storage bucket (scripts/check-storage-integrity.js) found 92
// truncated objects, all written by this app from picked files, across both
// uploadBytes and uploadBytesResumable; many re-uploads were cut at the exact
// same byte as the previous attempt. The File is already short before any SDK
// sees it, so retrying can't help — the only fix is to refuse the file.

export type IntegrityResult = 'ok' | 'truncated' | 'unsupported'

export const FILE_TRUNCATED_MESSAGE = 'ໄຟລ໌ເສຍຫາຍ ກະລຸນາເລືອກໃໝ່'

// Thrown by upload paths that check integrity themselves (uploadImageFile), so
// callers can show the "pick again" message instead of a generic failure.
export class FileTruncatedError extends Error {
  constructor() {
    super(FILE_TRUNCATED_MESSAGE)
    this.name = 'FileTruncatedError'
  }
}

// Longest signature we match: RIFF (4) + size (4) + WEBP (4).
const HEAD_BYTES = 12

// End markers aren't always the last bytes: PDFs allow whitespace after %%EOF
// and incremental updates append revisions, and some cameras append data after
// the JPEG EOI. Searching a generous tail tolerates all of these.
const TAIL_BYTES = 2048

// FileReader rather than Blob.arrayBuffer()/Blob.text(): the old Android
// WebView builds this guards against don't all implement those.
// Raw bytes, not readAsText(blob, 'iso-8859-1'): browsers decode that label as
// windows-1252, which remaps 0x80–0x9F — the PNG signature starts with 0x89
// and WebP size bytes can fall in that range, so text matching misses them.
function readSliceBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error ?? new Error('ອ່ານໄຟລ໌ບໍ່ໄດ້'))
    reader.readAsArrayBuffer(blob)
  })
}

const ascii = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0))

const PDF_HEADER = ascii('%PDF-')
const PDF_EOF = ascii('%%EOF')
const JPEG_SOI = [0xff, 0xd8, 0xff]
const JPEG_EOI = [0xff, 0xd9]
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const PNG_IEND = ascii('IEND')
const RIFF = ascii('RIFF')
const WEBP = ascii('WEBP')

function matchesAt(bytes: Uint8Array, offset: number, sig: number[]): boolean {
  if (offset + sig.length > bytes.length) return false
  return sig.every((b, i) => bytes[offset + i] === b)
}

// Linear scan is fine: the haystack is at most TAIL_BYTES long.
function containsBytes(bytes: Uint8Array, needle: number[]): boolean {
  for (let i = 0; i + needle.length <= bytes.length; i++) {
    if (matchesAt(bytes, i, needle)) return true
  }
  return false
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  )
}

export type IntegrityReport = {
  result: IntegrityResult
  format: 'pdf' | 'jpeg' | 'png' | 'webp' | 'unknown'
  // Short technical note on why the verdict was reached — shown under the
  // toast so a failure on a phone (no devtools) can still be diagnosed.
  detail: string
}

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ')

// The format is decided from the header bytes, never from the extension or
// file.type: Android often reports an empty type, and names can lie about the
// content. Rejects only files we can positively identify as cut short —
// unknown formats (HEIC, GIF, …) pass as 'unsupported' so they aren't blocked.
export async function inspectFileIntegrity(file: File): Promise<IntegrityReport> {
  // Every format we accept is far larger than its own signature, so a file
  // too short to hold one can only be a cut-off read.
  if (file.size < HEAD_BYTES) {
    return { result: 'truncated', format: 'unknown', detail: `size=${file.size}` }
  }

  const [head, tail] = await Promise.all([
    readSliceBytes(file.slice(0, HEAD_BYTES)),
    readSliceBytes(file.slice(Math.max(0, file.size - TAIL_BYTES))),
  ])
  const base = `size=${file.size} read=${head.length}+${tail.length} tail=…${hex(tail.subarray(-8))}`

  if (matchesAt(head, 0, PDF_HEADER)) {
    const ok = containsBytes(tail, PDF_EOF)
    return { result: ok ? 'ok' : 'truncated', format: 'pdf', detail: `${base}${ok ? '' : ' no %%EOF'}` }
  }

  if (matchesAt(head, 0, JPEG_SOI)) {
    const ok = containsBytes(tail, JPEG_EOI)
    return { result: ok ? 'ok' : 'truncated', format: 'jpeg', detail: `${base}${ok ? '' : ' no FFD9'}` }
  }

  if (matchesAt(head, 0, PNG_SIGNATURE)) {
    const ok = containsBytes(tail, PNG_IEND)
    return { result: ok ? 'ok' : 'truncated', format: 'png', detail: `${base}${ok ? '' : ' no IEND'}` }
  }

  if (matchesAt(head, 0, RIFF) && matchesAt(head, 8, WEBP)) {
    // RIFF stores (file size - 8) at offset 4, so a short read disagrees with it.
    const declared = readUint32LE(head, 4) + 8
    const ok = declared === file.size
    return { result: ok ? 'ok' : 'truncated', format: 'webp', detail: `${base}${ok ? '' : ` riff=${declared}`}` }
  }

  return { result: 'unsupported', format: 'unknown', detail: `${base} head=${hex(head)}` }
}

export async function checkFileIntegrity(file: File): Promise<IntegrityResult> {
  return (await inspectFileIntegrity(file)).result
}
