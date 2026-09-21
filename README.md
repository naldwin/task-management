# nalds — Task Management

Simple, practical team task management with spaces, custom workflows, in-app invitations, and deterministic monthly reports.

Project owner (branding): **nalds**. Display names never grant permissions — only space membership roles do.

## Stack

React + TypeScript + Vite · React Router · Supabase (Postgres + Auth) · TanStack Query · Tailwind CSS · React Hook Form + Zod.

## 1) Prerequisites

- Node 18+
- A Supabase project ([supabase.com](https://supabase.com))

## 2) Environment — create your `.env`

Copy the template and fill in real values:

```bash
cp .env.example .env
```

`.env.example`:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
VITE_APP_NAME=nalds — Task Management
VITE_APP_OWNER=nalds
```

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Same page → Project API keys → `anon` `public` key |

> Never put the `service_role` key in frontend code. It bypasses RLS.

## 3) Database setup

Apply migrations (Supabase SQL editor or CLI):

```bash
# SQL editor: paste and run the full file
supabase/migrations/0001_init.sql
```

Or with the CLI:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

What `0001_init.sql` creates: `profiles`, `spaces`, `memberships`, `statuses`, `tasks`, `comments`, `task_activity`, `invitations`, `monthly_reports`, plus RPCs (`create_space`, `create_task`, `update_task`, `invite_user`, `respond_invitation`, `update_member_role`, `remove_member`, `retire_status`, `generate_monthly_report`) and Row Level Security policies. Permissions are enforced in the database — hiding UI buttons is not sufficient.

Regenerate types after schema changes:

```bash
npx supabase gen types typescript --project-id <project-id> > src/lib/database.types.ts
```

(A checked-in `src/lib/database.types.ts` is provided.)

## 4) Supabase dashboard settings (manual)

1. **Auth → Sign In / Providers → Email**: enabled.
2. **Auth → Email confirmation**: **OFF** for the simplest flow (registration logs users in immediately; no confirm-password field by design, one password field with show/hide). If left ON, the app shows a "check your email" screen with resend, and creates the profile on first login.
3. **API**: copy URL + `anon` key into `.env` (see above).

## 5) Monthly reports (manual)

Reports are generated manually — nothing runs on a schedule:

1. Open a space → **Reports**.
2. Select the month (`YYYY-MM`).
3. Click **Generate report**. This gathers the space's task list for that month (using the space's reporting timezone) and saves it as a snapshot you can open, re-generate, and print to PDF.

Generation is idempotent (`UNIQUE(space_id, month_start)`) — re-running a month overwrites that month's snapshot without creating duplicates. Failures are stored in `generation_error` and can be retried.

Month definition: inclusive start → exclusive next-month start.

Validate the database logic locally (no Supabase needed) with:

```bash
npm run verify:sql
```

## 6) Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # focused tests: authz boundaries, invites, statuses, reopening, report dates
npm run build    # typecheck + production build
npm run preview  # preview dist/
```

## 7) Hosting — SPA route fallback (required)

Every route (`/spaces/:spaceId/tasks/:taskId`, etc.) must support direct navigation, refresh, and back/forward. Serve `index.html` for unknown paths:

- **Vercel:** `vercel.json` is included (`rewrites → /index.html`).
- **Netlify:** `public/_redirects` is included (`/* /index.html 200`).
- **Nginx:** `try_files $uri $uri/ /index.html;`
- **Static servers:** enable single-page-app fallback to `index.html`.

Search, filters, sorting, and pagination live in URL query params (e.g. `/spaces/:id/tasks?status=…&assignee=…&blocked=only&overdue=only&page=2`), so filtered views are shareable and survive refresh.

## 8) Invitation assumption (explicit)

For this version, invitation matching uses the account's **registered email without email ownership verification**: an invite to `alice@example.com` becomes visible to whoever registers with that email (normalized: trimmed, case-insensitive). Matching happens server-side (`invite_user`, `respond_invitation`, `handle_new_profile` trigger); the app exposes no searchable user directory. Only the authenticated recipient (session identity, not a submitted email) can accept/decline, and acceptance creates membership transactionally.

## 9) Key behaviors

- Spaces: anyone authenticated can create one and becomes owner. Roles: owner / lead / member / viewer. Last owner cannot be removed. Task assignment restricted to active members of the same space.
- Tasks: atomic per-space numbering (`DEV-001`, never reused), archiving instead of deletion, `Done` records `completed_at`, reopening clears it but preserves the history event. Activity log is append-only.
- Statuses: per-space, mapped to `Not Started / Active / Done / Cancelled` for dashboards. Retiring a status with tasks requires a replacement and migrates in one transaction.
- Reports: manual per-space, per-month generation (select month → Generate report), saved snapshots you can regenerate and print (print CSS + browser print dialog for PDF).
