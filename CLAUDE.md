# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
pnpm dev              # Start Next.js dev server (localhost:3000, Turbopack)
pnpm build            # Production build (outputs to out/)
pnpm start            # Start production server
pnpm lint             # ESLint

# Deployment
pnpm deploy           # Build + deploy to Firebase Hosting (production: hrm-portal-ssmi)
pnpm deploy_dev       # Build + deploy to Firebase Hosting (staging: ssmi-hrm-demo)

# Cloud Functions (run inside functions/)
npm run build         # Compile TypeScript → lib/
npm run serve         # Build + start Firebase emulator
npm run deploy        # Deploy Cloud Functions to Firebase

# Mobile (Capacitor)
pnpm build && npx cap sync android && npx cap open android
pnpm build && npx cap sync ios && npx cap open ios
```

## Architecture

**Stack:** Next.js (App Router, static export) + React 19 + TypeScript + Tailwind CSS v4 + Firebase + Capacitor

The app is a multi-platform HRM portal (web PWA + Android/iOS). Next.js builds to static files in `out/` which are served via Firebase Hosting. Server-side logic lives entirely in Firebase Cloud Functions (`functions/`), not Next.js API routes.

### Layer Structure

| Layer | Location | Purpose |
|---|---|---|
| Pages / Routes | `app/dashboard/*/page.tsx` | Next.js App Router pages |
| Components | `components/` | Shared UI; `components/ui/` is shadcn/ui |
| Services | `services/*.ts` | All Firestore CRUD operations |
| Hooks / Queries | `lib/use-*-queries.ts`, `hooks/` | TanStack Query hooks wrapping services |
| State | `lib/auth-context.tsx`, `lib/hrm-context.tsx` | React Context for auth & HRM state |
| Types | `lib/types.ts`, `types/` | TypeScript type definitions |
| Cloud Functions | `functions/src/index.ts` | Push notifications, scheduled jobs |

### Data Flow

```
Page → TanStack Query hook → Service (Firestore) → Firebase
Page → React Context (auth state, HRM state)
Cloud Functions → Firebase Admin SDK → Firestore + web-push
```

TanStack Query (`lib/query-client.ts`) is the primary data-fetching and caching mechanism. All Firestore reads/writes go through `services/`. React Context (`lib/auth-context.tsx`, `lib/hrm-context.tsx`) holds session-scoped state.

### Key Conventions

- **Path alias:** `@/*` maps to the repo root (`./`). Use `@/components/...`, `@/lib/...`, etc.
- **Static export:** `next.config.mjs` uses `output: 'export'` and `images: { unoptimized: true }`. No server-side rendering — avoid `getServerSideProps` patterns.
- **TypeScript errors ignored at build:** `typescript.ignoreBuildErrors: true` in next.config.mjs. Do not rely on build-time type checking; run `tsc --noEmit` manually.
- **Timezone:** All date/time logic uses `Asia/Vientiane` (UTC+7). Cloud Functions explicitly set this timezone for schedulers.
- **UI components:** shadcn/ui (new-york style, Radix UI primitives). Add new components via `npx shadcn@latest add <component>`.
- **Forms:** React Hook Form + Zod validation. See `components/dashboard/leave-request-form.tsx` for the established pattern.
- **Navigation:** Use `router.push(href)` inside `<button onClick>` — do NOT use `<Link>` for nav items in `nav.tsx` and `mobile-nav.tsx`. This is an explicit project preference.
- **No `loading.tsx` at dashboard segment level:** `app/dashboard/loading.tsx` was removed to prevent Chrome navigation flash. Do not recreate it. Per-page loading states are handled via TanStack Query `isLoading` skeletons inside each page.
- **Shared nav utils:** `lib/nav-utils.ts` exports `isNavItemActive(pathname, href)` — use this in both nav components instead of inlining the logic.
- **`useSearchParams()` in static export:** causes hydration mismatch. Use `window.location.search` / `new URLSearchParams(window.location.search)` inside `useEffect` instead.

### Role Permissions (`RolePermissions` in `lib/types.ts`)

Each employee has a `rolePermissions` object fetched from the `roles` Firestore collection via `rolesUid`. Key fields that gate UI and data access:

| Permission | Effect |
|---|---|
| `approveDepartment` | Can approve leave/offsite for own department only; approves at `departmentHead` slot |
| `approveBranch` | Can approve leave/offsite for all departments in same `workLocation`; also approves at `departmentHead` slot |
| `LPB` | Offsite requests use 3-step approval chain (departmentHead → hr → manager) instead of 2-step (departmentHead → hr) |
| `manageLeave` / `manageOffsite` | Manage (CRUD) leave/offsite records |
| `loginAdmin` | Access to admin panel |
| `dashboard` / `highDashboard` | Dashboard visibility tiers |

Both `approveDepartment` and `approveBranch` approve at the `departmentHead` slot — they differ only in data scope (department vs whole branch).

### Check-in Status Thresholds

Status is computed **server-side** in `functions/src/index.ts` (`recordCheckIn` Cloud Function) — the client's submitted `status` field is ignored. Client-side mirror is `lib/server-time.ts`.

| Condition | present | late | not_check_in |
|---|---|---|---|
| Normal | ≤ 08:15 | 08:16–09:59 | ≥ 10:00 |
| `isOffsite: true` | < 09:00 | 09:00–09:59 | ≥ 10:00 |
| `morningLeaveDay` | ≤ 12:30 | 12:31–13:59 | ≥ 14:00 |

Penalty minutes (for late ranking on dashboard) use the same thresholds but `checkInImageURL` present shifts the normal threshold to 09:00 instead of 08:15 (`services/attendance.ts`).

### Approval Flow (Leave & Offsite)

**Leave** (`leaves` collection):
- `approvals[]` array of `{ role, decision, reviewedBy, reviewedAt }`
- Roles in order: `departmentHead` → `hr` (→ `manager` if LPB)
- `status` field is computed from `approvals`: any rejected → `rejected`, all approved → `approved`
- Approval logic: `services/leaves.ts` (`updateLeaveApproval`)

**Offsite** (`workOutside` collection — note: NOT `workOutsideRequests`):
- Same `approvals[]` pattern
- `requiredApprovers` array set at submission time based on `LPB` permission
- Approval handled inline in `app/dashboard/approv/page.tsx`

Data fetched for approvers is scoped by `workLocationUid` (always) + `departmentUid` (only for `approveDepartment`; `approveBranch` skips dept filter).

### Session & Auth

- **Auto-logout:** 2-day inactivity via `ssmi_last_active` key in `localStorage`. Checked on every `onAuthStateChanged` in `lib/auth-context.tsx`. Updated on every app open. Manual logout clears the key.
- Firebase Auth uses `browserLocalPersistence` by default (session survives page refresh indefinitely unless inactive for 2+ days).

### Firebase Collections (Firestore)

Key collections accessed through `services/`:
- `employees` — employee profiles
- `attendance` — check-in/check-out records (fields: `dateKey` YYYY-MM-DD, `status`, `checkInTime` HH:mm, `isOffsite`, `checkInImageURL`, `morningLeaveDay`)
- `leaves` — leave requests + approval status (fields: `leaveUserUuid`, `startDate`, `startPeriod`, `endDate`, `endPeriod`, `status`, `approvals[]`, `workLocationUid`, `departmentUid`)
- `workOutside` — off-site work requests (NOT `workOutsideRequests`)
- `workLocations` — available work locations
- `leavePolicies` — leave policy rules
- `news` — company announcements
- `roles` — role permission sets (linked from `employees.rolesUid`)

### Environment Variables

Firebase config is split across `.env.development` and `.env.production`. For local dev you may also need `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_VAPID_PUBLIC_KEY    # Web push (client)
VAPID_PRIVATE_KEY                # Web push (Cloud Functions only)
```

`NEXT_PUBLIC_DEPLOY_TARGET` is set automatically by `scripts/build.js` during `pnpm deploy` / `pnpm deploy_dev`.

### Cloud Functions

`functions/` is a separate Node 20 package with its own `package.json` and TypeScript config. Functions are defined in `functions/src/index.ts` and handle:
- **`recordCheckIn`** — re-computes check-in status server-side (ignores client's `status` field) to prevent time spoofing
- Sending web push notifications (triggered by Firestore writes)
- Scheduled attendance reminder (Cloud Scheduler)

When modifying Cloud Function logic, edit both `functions/src/index.ts` (TypeScript source) and `functions/lib/index.js` (compiled output) so deployment works without a full recompile step.

Deploy functions separately with `npm run deploy` from inside `functions/`.
