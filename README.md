# SSMI HRM Portal

A Human Resource Management (HRM) web application (installable PWA) built with **Next.js** and **Firebase**. It supports employee self-service features such as attendance tracking, leave requests, work off-site requests, and approvals.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui + Radix UI |
| Forms | React Hook Form + Zod |
| Data Fetching | TanStack Query v5 |
| Backend / Auth | Firebase (Firestore, Auth, Storage, Hosting) |
| Charts | Recharts |
| Package Manager | pnpm |

---

## Features

- **Authentication** — Login with Firebase Auth
- **Dashboard** — Home overview with working days summary
- **Attendance** — Check-in and attendance history
- **Leave Requests** — Submit and track leave requests
- **Work Off-Site Requests** — Submit and track off-site work requests
- **Approvals** — Manager approval flow for leave and off-site requests
- **Profile** — View and manage employee profile
- **News** — Company announcements
- **AI Assistant** — AI-powered assistant page
- **Dark / Light Theme** — Theme toggle via next-themes

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9+

### Install dependencies

```bash
pnpm install
```

> If you see `ERR_PNPM_IGNORED_BUILDS`, run:
> ```bash
> pnpm approve-builds
> ```
> Select all packages and confirm.

### Run development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm deploy` | Build and deploy to Firebase Hosting (production) |
| `pnpm deploy_dev` | Build and deploy to Firebase Hosting (demo/staging) |
| `pnpm lint` | Run ESLint |

---

## Firebase Hosting

This project is deployed on Firebase Hosting with two sites:

- **Production:** `hrm-portal-ssmi`
- **Demo / Staging:** `ssmi-hrm-demo`

Deploy production:

```bash
pnpm deploy
```

Deploy demo:

```bash
pnpm deploy_dev
```

---

## Project Structure

```
hrm-portal-ssmi/
├── app/                    # Next.js App Router pages
│   ├── dashboard/          # All dashboard pages
│   │   ├── attendance/     # Attendance tracking
│   │   ├── check-in/       # Check-in page
│   │   ├── history/        # Request history
│   │   ├── leave/          # Leave management
│   │   ├── request/        # Submit requests
│   │   ├── approv/         # Approval flows
│   │   ├── profile/        # Employee profile
│   │   ├── news/           # Company news
│   │   └── ai/             # AI assistant
│   ├── login-form.tsx      # Login UI
│   └── page.tsx            # Root page
├── components/             # Shared UI components
│   └── ui/                 # shadcn/ui components
├── services/               # Firebase data services
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities and query client
└── firebase.json           # Firebase configuration
```

---

## Environment Variables

Create a `.env.local` file in the root directory with your Firebase config:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

---

## License

Private — SSMI internal use only.
