// This [id] route is superseded by /wrok-off-site?id= (query param).
// Kept as a shell so output: export doesn't error — no real content rendered here.
export async function generateStaticParams() {
  return [{ id: '_' }]
}

export default function OffsiteDetailFallback() {
  return null
}
