// next.config.mjs sets trailingSlash: true (required for static export hosting),
// so usePathname() returns paths like "/dashboard/" while nav hrefs are defined
// without one ("/dashboard") — normalize both sides before comparing. Without
// this, the exact-equality check for the "/dashboard" home item never matched
// pathname's trailing slash, so handleNavClick's 2s stuck-navigation fallback
// always concluded the nav to "/dashboard" had failed and force-reloaded via
// window.location.href on every single navigation back to the home page.
function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function isNavItemActive(pathname: string, href: string): boolean {
  const p = stripTrailingSlash(pathname);
  const h = stripTrailingSlash(href);
  return p === h || (h !== "/dashboard" && p.startsWith(h));
}

// How long handleNavClick/handleMenuClick wait before assuming a router.push()
// is stuck and force-reloading via window.location.href. Measured repeatedly
// against /dashboard/request (heaviest route — several lazy-loaded chunks +
// LeaveRequestForm's own query set): ~1.5s in steady state, but one sample
// hit 5.6s under nothing more than ordinary dev-server/HMR load — with real
// mobile networks and several parallel Firestore reads on top, that spread
// is easily wider. A false positive here is actively harmful, not neutral:
// it forces a full reload that re-runs the entire Firebase Auth/App Check
// bootstrap, which is itself slow and was seen throttling/failing in this
// project — so a merely-slow-but-working navigation ends up looking *more*
// broken, not less. This is a last-resort dead-man's switch for a genuinely
// hung navigation, not a snappy-UX mechanism, so it's set generously.
export const NAV_STUCK_FALLBACK_MS = 10000;
