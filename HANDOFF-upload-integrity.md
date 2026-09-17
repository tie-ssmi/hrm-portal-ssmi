# Handoff: stop truncated uploads reaching Firebase Storage

You are working in `hrm-portal-ssmi` (Next.js staff portal, also shipped as an Android WebView APK).
Goal: every place this app uploads a user-picked file must reject a truncated file **before** it
is stored, and verify the stored size **after** upload. Read this whole file before editing.

## 1. Evidence (already measured — do not re-derive)

`scripts/check-storage-integrity.js` scanned all 1,951 objects in `gs://hrm-ssmi.firebasestorage.app`
on 2026-09-17, checking header + end-of-file marker per real format (PDF `%%EOF`, JPEG `FF D9`,
PNG `IEND`, WebP RIFF size).

**92 truncated files. Every one of them was written by this repo.** Files written by the separate
admin repo (`HRM-System-SSMI`, filenames are a bare UUID) had zero truncations.

| Storage prefix | Uploader in this repo | Checked | Truncated | Users | Dates |
|---|---|---|---|---|---|
| `images/combinedDocs/` (PDF) | `uploadImageFile` via `DocUploadSlot` | 256 | **63 (24.6%)** | 19 | 2026-08-25 → 09-16 |
| `images/idCards/` | `uploadImageFile` via `DocUploadSlot` | 225 | 9 | 4 | 07-30 → 09-08 |
| `images/photo3x4/` | `uploadImageFile` via `DocUploadSlot` | 183 | 7 | 3 | 07-30 → 08-25 |
| `images/docs/` | `uploadImageFile` via `DocUploadSlot` | 73 | 6 | 1 | 09-08 |
| `images/declarations/` | `uploadImageFile` (slot now commented out) | 45 | 1 | 1 | 07-30 |
| `profile-images/<uid>/` | `uploadImageFile` via `CameraUpload` | 206 | 3 | 3 | 03-25 → 07-30 |
| `leaves/` (PDF) | `services/leaves.ts`, `leave-request-form.tsx` | 71 | 3 | 3 | 07-09 → 09-16 |
| `workOutside/` | `offsite-request-form.tsx` | 24 | 0 | – | – |
| `attendance/` | `services/attendance.ts` | 701 | **0** | – | – |

What this tells you about the cause:
- **36 of the 63 `combinedDocs` failures are re-uploads truncated to the exact same byte count** as
  the user's previous attempt. The network does not cut at the same byte twice — the `File` the
  WebView hands to JS is already short. Retrying cannot fix it; only rejecting it can.
- Truncation happens with both `uploadBytes` and `uploadBytesResumable`, so the Storage SDK call is
  **not** the cause. Do not "fix" it by switching upload methods.
- `attendance/` (701 photos, 0 broken) comes from the camera capture flow, not from picking an
  existing file, which fits the Android `content://` read truncation. Leave it alone (see §4).

## 2. What is already done (uncommitted in the working tree — build on it, don't redo it)

- `lib/file-integrity.ts` — `isPdf(file)` and `isCompletePdf(file)`. Reads head/tail slices with
  `FileReader.readAsText(blob, 'iso-8859-1')` (deliberately **not** `Blob.arrayBuffer()`, which old
  Android WebViews lack). Tested against a real truncated PDF from Storage: rejects it, accepts
  valid PDFs including ones with trailing whitespace after `%%EOF`.
- `components/fileUpload.tsx` — `validate` is async and rejects incomplete **PDFs** with
  `toast.error('ໄຟລ໌ເສຍຫາຍ ກະລຸນາເລືອກໃໝ່')`. Images are not checked yet.
- `services/attachment-upload.ts` — `uploadAttachment(path, file, onProgress?)`: uploads, compares
  `snapshot.metadata.size` to `file.size`, on mismatch `deleteObject` + throw `UploadTruncatedError`
  (Lao message inside) before any URL is returned. Used by `services/leaves.ts`,
  `leave-request-form.tsx`, `offsite-request-form.tsx`.
- `scripts/check-storage-integrity.js` — the scanner above (supersedes `scripts/check-leave-docs.js`).

`tsc --noEmit` and `pnpm build` both pass on this state.

## 3. Tasks

### Task A — image checks in `lib/file-integrity.ts`
Add format-aware checks next to the PDF one, same `FileReader` + `iso-8859-1` approach, same
2 KB tail window:
- JPEG: head starts `FF D8 FF`; tail contains `FF D9` (search the tail, don't demand the last two
  bytes — some cameras append data after EOI).
- PNG: 8-byte signature `89 50 4E 47 0D 0A 1A 0A`; tail contains `IEND`.
- WebP: head `RIFF` + bytes 8–11 `WEBP`; little-endian uint32 at offset 4, plus 8, must equal `file.size`.

Detect the format **from the header bytes**, not the extension or `file.type` — Android often gives
an empty `type`, and the bucket already holds 28 intact files whose extension lies about their
content. Expose one entry point, e.g.:

```ts
export type IntegrityResult = 'ok' | 'truncated' | 'unsupported'
export async function checkFileIntegrity(file: File): Promise<IntegrityResult>
```

`unsupported` (HEIC, GIF, unknown) must **not** block the upload — only `truncated` blocks.
Keep `isPdf` / `isCompletePdf` exported or migrate their one caller; don't leave dead exports.

### Task B — `components/fileUpload.tsx`
Replace the PDF-only branch with `checkFileIntegrity` so JPG/PNG attachments are checked too.
Keep the existing toasts (`'ໄຟລ໌ເສຍຫາຍ ກະລຸນາເລືອກໃໝ່'`, `'ອ່ານໄຟລ໌ບໍ່ໄດ້ ກະລຸນາເລືອກໄຟລ໌ໃໝ່'`).

### Task C — `uploadImageFile` in `components/cameraUpload.tsx` (highest impact: 89 of 92 failures)
Both `CameraUpload.handleSelect` and `DocUploadSlot.handleSelect`
(`app/dashboard/profile/edit/page.tsx:267`) go through `uploadImageFile`, so guard it there once:
1. Before uploading, run `checkFileIntegrity`; on `truncated` throw a typed error carrying the Lao
   message `'ໄຟລ໌ເສຍຫາຍ ກະລຸນາເລືອກໃໝ່'`.
2. After uploading, apply the same stored-size check as `uploadAttachment`. Preferred: route
   `uploadImageFile` through `uploadAttachment` — that requires adding an optional
   `metadata` argument (`contentType`, `cacheControl`) to `uploadAttachment`, because
   `uploadImageFile` sets both and must keep doing so (`resolveContentType` exists because Android
   pickers return an empty `type`). Keep `onProgress` working — both callers show a percentage.
3. Callers currently swallow the reason: `CameraUpload` toasts `'Upload failed'`, `DocUploadSlot`
   toasts `'ອັບໂຫຼດບໍ່ສໍາເລັດ'`. When the error is the integrity/truncation error, show its Lao
   message instead so the user knows to pick the file again rather than retry.

### Out of scope — do not change
- `services/attendance.ts` — 701 uploads, 0 truncated. Optional at most: the post-upload size check.
- The admin repo `HRM-System-SSMI` — no truncations in its uploads.
- The 28 mislabelled-but-intact files (`.webp` holding PNG, `.png` holding WebP). They open fine;
  they come from the admin repo's `uploadImageWithUUID`.
- Switching `uploadBytesResumable` ↔ `uploadBytes` (see §1).

## 4. Conventions in this repo
- Import groups use this repo's existing header style, e.g. `// ** third party`,
  `// ** config / utils / types / hooks`, `// ** services`, `// ** components` — match the file you edit.
- User-facing strings are Lao; code comments are English and explain *why*.
- No `Blob.arrayBuffer()` / `Blob.text()` in the integrity path (old WebView support).

## 5. Verify before reporting done
1. `npx tsc --noEmit` and `pnpm build` pass.
2. Exercise `checkFileIntegrity` in Node against real files. Node has `File`/`Blob` but no
   `FileReader`, so polyfill `readAsText` over `blob.arrayBuffer()` + `TextDecoder('latin1')` in the
   test harness only. Cases: valid PDF/JPEG/PNG → `ok`; each cut with `head -c <half>` → `truncated`;
   0-byte and 3-byte files → `truncated`; valid PDF + trailing whitespace → `ok`; an unknown/HEIC
   file → `unsupported`. Report the output.
3. Say plainly what you could not test (the real Android WebView picker).

## 6. After deploy (tell the user, don't do it)
- Re-run the scan a few days after release; new truncated objects should stop appearing:
  `NODE_PATH=functions/node_modules node scripts/check-storage-integrity.js <service-account.json>`
- The 92 existing truncated files cannot be repaired. Their owners must re-upload; 19 users are
  affected in `combinedDocs` alone.

When finished, you may delete this handoff file.
