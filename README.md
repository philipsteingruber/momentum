# Momentum

A full-stack task management application built with Next.js, featuring recurring task templates, multi-channel daily digests, and a Discord bot integration.

## Tech Stack

- **Framework:** Next.js 16.1 (App Router)
- **Database:** PostgreSQL + Prisma ORM
- **API:** tRPC with TanStack React Query
- **Auth:** Clerk
- **UI:** shadcn/ui + Radix UI + Tailwind CSS 4
- **Email:** Resend + React Email
- **Discord:** HTTP Interactions (webhook-based, no gateway)
- **Forms:** React Hook Form + Zod
- **Logging:** Axiom
- **Background jobs:** Upstash QStash

## Features

- **Task management** — Create, organize, and track tasks with statuses: `PENDING`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `CANCELLED`, `SKIPPED`
- **Kanban board** — Drag-and-drop board view for updating task status
- **Task dependencies** — Block tasks on other tasks to model dependency graphs
- **Task snooze** — Extend a task's due date from the UI or via Discord
- **Task notes** — Attach notes to tasks from the UI or via Discord
- **Categories & tags** — Organize tasks with user-scoped categories and tags
- **Recurring templates** — Auto-generate tasks on daily/weekly/monthly schedules
- **Daily digest** — Email + Discord DM digests grouped by overdue / due today / due this week
- **Discord bot** — Slash commands for listing, creating, completing, snoozing, and annotating tasks
- **Shared access** — Grant read-only access to your task list to other users
- **Admin panel** — Cron job log viewer at `/admin` with filtering and search
- **Internationalization** — English and Swedish supported

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- A PostgreSQL database
- Accounts for: Clerk, Resend, Discord (optional)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql://...

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SIGNING_SECRET=
ADMIN_CLERK_USER_ID=

# Resend (email)
RESEND_API_KEY=

# Cron security
CRON_SECRET=

# Discord Bot (optional)
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_PUBLIC_KEY=
DISCORD_REDIRECT_URI=http://localhost:3000/api/discord/callback

# App
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Seed script (optional, only needed for local dev seeding)
SEED_CLERK_USER_ID=
SEED_USER_EMAIL=
SEED_USER_NAME=
```

### 3. Push the database schema

```bash
pnpm prisma db push
```

### 4. (Optional) Register Discord slash commands

This is a one-time operation that registers `/list` and `/complete` globally with Discord.

```bash
pnpm discord:register
```

### 5. Start the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start the development server |
| `pnpm dev:fresh` | Reset DB, seed, generate Prisma types, then start dev |
| `pnpm build` | Production build |
| `pnpm start` | Start the production server |
| `pnpm lint` | Run ESLint |
| `pnpm email` | Start the React Email preview server |
| `pnpm discord:register` | Register Discord slash commands (one-time) |
| `pnpm test` | Run tests once |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage report |

## Project Structure

```
/src
  /app                        # Next.js App Router pages & API routes
    /admin                    # Cron log viewer (admin only)
    /api
      /cron
        /daily-digest         # Sends email + Discord DM digests
        /generate-tasks       # Creates tasks from recurring templates
      /discord
        /auth                 # Discord OAuth2 initiation
        /callback             # Discord OAuth2 callback
        /interactions         # Discord slash command webhook
      /trpc/[trpc]            # tRPC endpoint
      /webhooks               # Clerk lifecycle webhooks
    /categories               # Category list page
    /category/[categoryId]    # Category detail page
    /settings/discord         # Discord account linking
    /settings/shared-access   # Shared access management
    /shared/[userId]          # Read-only shared task view
    /shared/[userId]/task/[taskId]  # Read-only shared task detail
    /task/[taskId]            # Task detail page
    /templates                # Recurring templates page
    /page.tsx                 # Home (task list)
  /_components                # Shared UI components
  /trpc                       # tRPC routers and client setup
  /lib                        # Utilities (discord, email, prisma, cron)

/prisma
  schema.prisma               # Database schema
  seed.ts                     # Database seed

/scripts
  register-discord-commands.ts

/messages
  en.json                     # English translations
  sv.json                     # Swedish translations
```

## Cron Jobs

Cron jobs are secured with a shared `CRON_SECRET` header and must be triggered externally (e.g., Vercel Cron, GitHub Actions).

| Route | Purpose |
|---|---|
| `POST /api/cron/daily-digest` | Sends daily task digest via email and Discord DM |
| `POST /api/cron/generate-tasks` | Generates tasks from due recurring templates |

All cron activity is logged to the `CronLog` database table and viewable at `/admin`.

## Discord Integration

The Discord bot uses **HTTP Interactions** (no persistent WebSocket gateway), making it compatible with serverless deployments like Vercel.

**Account linking:** Users link their Discord account via OAuth2 at `/settings/discord`. A DM channel is opened at link time for digest delivery.

**Slash commands:**

- `/list [status]` — Lists tasks, optionally filtered by status
- `/today` — Lists tasks due today or overdue
- `/add title [due] [category]` — Creates a new task
- `/complete task_id:<id>` — Marks a task as completed
- `/snooze task days` — Extends a task's due date by 1–7 days
- `/note task content` — Adds a note to a task
