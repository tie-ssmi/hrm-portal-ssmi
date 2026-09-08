// pdfjs-dist v6 no longer inlines its decoders/fonts — it fetches them at
// runtime from the URLs given to getDocument() (wasmUrl, standardFontDataUrl,
// cMapUrl, iccUrl). Without them, any scanned PDF (CCITTFax/JBIG2/JPX images)
// throws "JBig2 failed to initialize" while rendering.
// Static export has no way to reference node_modules at runtime, so mirror the
// asset folders into public/pdfjs/ before every dev run and build.
const { cpSync, existsSync, mkdirSync } = require('fs')
const { join } = require('path')

const root = join(__dirname, '..')
const src = join(root, 'node_modules', 'pdfjs-dist')
const dest = join(root, 'public', 'pdfjs')

if (!existsSync(src)) {
  console.warn('[pdfjs-assets] pdfjs-dist not installed — skipping')
  process.exit(0)
}

mkdirSync(dest, { recursive: true })
for (const dir of ['wasm', 'standard_fonts', 'cmaps', 'iccs']) {
  const from = join(src, dir)
  if (!existsSync(from)) continue
  cpSync(from, join(dest, dir), { recursive: true })
}
console.log('[pdfjs-assets] copied to public/pdfjs/')
