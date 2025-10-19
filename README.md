# Coffee Craves Admin Platform

An internal analytics and operations workspace for Coffee Craves. The app serves role-based dashboards for admins and super admins, combining survey insights, receipt usage, audit history, and data-quality monitoring on top of a MySQL backend. It runs on the Next.js App Router with React 19, Tailwind CSS 4, and shadcn/Radix UI components.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Getting Started](#getting-started)
4. [Environment Variables](#environment-variables)
5. [Database & Seeding](#database--seeding)
6. [Available Scripts](#available-scripts)
7. [Project Structure](#project-structure)
8. [Authentication & Authorization](#authentication--authorization)
9. [Troubleshooting](#troubleshooting)

---

## Features

- **Role-aware navigation** - Middleware gates `/admin` and `/superadmin` routes, while the sidebar swaps modules, copy, and menu sections based on the signed-in role.
- **Operational dashboards** - KPI tiles, monthly trends, revisit intent, composite satisfaction, funnel, and driver analytics surface through `/api/admin/statistics/**` endpoints.
- **Data quality cockpit** - Super admins monitor completion matrices, required-coverage variance, option balance, and anomaly tracking under `/superadmin/data-quality`.
- **Survey authoring** - Drag-and-drop question builder with unsaved-change protection, bulk duplication, fixed Likert/Yes-No option sets, column visibility presets, and CSV export.
- **Audit trail** - Every privileged operation can log to `audit_logs` and `admin_logins`, with a dedicated super-admin audit log view and export route.
- **Seed and demo tooling** - TypeScript scripts and REST endpoints populate receipts, submissions, answers, and comments, enabling full dashboards in a fresh environment.

---

## Tech Stack

| Layer        | Tooling                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| Framework    | Next.js 15 (App Router, Node runtime)                                   |
| Language     | TypeScript with React 19 (client/server components)                     |
| Styling      | Tailwind CSS 4, CSS variables, shadcn/ui, Radix primitives              |
| State & Data | TanStack Table, react-hook-form, zod, dnd-kit, date-fns                 |
| Charts       | Recharts (trend, funnel, distribution, positive/negative splits, etc.)  |
| Auth         | JWTs via `jose`, HTTP-only cookie helpers, middleware role guards       |
| Backend      | MySQL via `mysql2/promise` pools, REST-style Next.js route handlers     |
| UX Extras    | sonner toasts, next-themes mode toggle, vaul sheets, motion animations  |

---

## Getting Started

> Requirements: Node.js >= 18.18 (or any Node 20+ release), npm 10+ or pnpm 8+, and a reachable MySQL 8 instance.

1. **Install dependencies**

   ```bash
   npm install
   # or pnpm install
   ```

2. **Configure environment**
   - Copy `.env.local` or create a new one with the keys listed below.
   - Ensure the MySQL user can create, read, and write the Coffee Craves schema.

3. **Provision database schema**
   - Apply your schema migrations or adapt the schema reference embedded at the end of `src/app/api/seed/full/route.ts`.
   - The app expects tables such as `admins`, `admin_logins`, `audit_logs`, `surveys`, `questions`, `question_options`, `receipts`, `submissions`, `answers`, and supporting dimension tables.

4. **Seed demo data (optional but recommended)**
   - Run the TypeScript seeder to batch-insert receipts, submissions, and answers:

     ```bash
     pnpm tsx scripts/seed-linked-ddl.ts
     ```

   - Alternatively, call the REST seeders (authentication required):
     - `POST /api/seed/full`
     - `POST /api/seed/submissions`
     - `POST /api/seed/backfill-answers`

5. **Start the dev server**

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000` and sign in with an admin account. The dev server uses Turbopack for fast refresh.

6. **Lint and type-check (optional)**

   ```bash
   npm run lint
   ```

---

## Environment Variables

Create `.env.local` with the keys below (never commit secrets):

```bash
# Core database connection string
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/coffee_crave"

# API base used by client-side fetchers
NEXT_PUBLIC_API_URL="http://localhost:3000/api"

# 32+ byte secret for JWT signing/verification
JWT_SECRET="replace-with-a-64-char-random-hex-string"

# Optional fallback for revisit intent stats
REVISIT_QKEY="revisit"
```

Notes:

- `DATABASE_URL` feeds directly into `mysql.createPool`.
- `JWT_SECRET` must align across auth routes, middleware, and token helpers.
- `REVISIT_QKEY` is only used when the revisit-intent stat endpoint receives no explicit `qkey`.

---

## Database & Seeding

- **Connection pooling** - `src/lib/database.ts` keeps a singleton pool during development to avoid spawning new connections on every hot reload.
- **Seeder script** - `scripts/seed-linked-ddl.ts` mirrors the live schema, inserting receipts, submissions, answers, and comment data in batches. Adjust the constants at the top to fine-tune volumes or distributions.
- **REST seeders** - `/api/seed/**` handlers accept JSON payloads (`dryRun`, `months`, `optionalRate`, etc.) and respond with summary statistics.
- **Audit hooks** - `recordAuditEvent` and `recordAdminLogin` persist relevant actions; ensure `audit_logs` and `admin_logins` tables exist with the expected columns and foreign keys.

---

## Available Scripts

| Script                                | Purpose                                         |
| ------------------------------------- | ----------------------------------------------- |
| `npm run dev`                         | Start the Next.js dev server with Turbopack     |
| `npm run build`                       | Create a production build in `.next/`           |
| `npm run start`                       | Run the production build                        |
| `npm run lint`                        | Lint the project with the Next.js ESLint config |
| `pnpm tsx scripts/seed-linked-ddl.ts` | Seed demo data directly through MySQL inserts   |

---

## Project Structure

```
src/
  app/
    (sidebar)/
      admin/...        # Admin dashboards, analytics, and CRUD views
      superadmin/...   # Governance, audit, data-quality, and user tools
    api/...            # Server route handlers backed by MySQL queries
    auth/...           # Admin sign-in UX
    layout.tsx         # Theme provider, toaster, unsaved-changes context
  components/
    admin/...          # Dashboard tiles, charts, analytics widgets
    shared/...         # Auth forms, quick filters, providers
    sidebar/...        # Sidebar shell, nav items, header, user menu
    tables/...         # TanStack-powered tables with filters and exports
    ui/...             # shadcn wrappers for Radix primitives
  lib/
    api-auth.ts        # Require/admin session helpers
    audit-log.ts       # Audit and login persistence utilities
    auth.ts            # JWT sign/verify helpers
    database.ts        # MySQL pool singleton
    modules.ts         # Role-aware navigation definitions
    session.ts         # HTTP-only cookie helpers
  styles/
    globals.css        # Tailwind base layers and design tokens
scripts/
  seed-linked-ddl.ts   # Database seeder aligned with production schema
middleware.ts          # Role guard for admin and super admin routes
```

---

## Authentication & Authorization

- JWTs are minted on sign-in and stored in an HTTP-only cookie named `auth`.
- `middleware.ts` protects all `/admin/**` and `/superadmin/**` routes, redirecting to `/auth/admins` on missing or expired credentials.
- Super admin sections require `role === "SUPER_ADMIN"`; admin users can access `/admin/**` routes.
- API handlers call `requireAdminSession` to validate requests server-side before executing SQL operations.

---

## Troubleshooting

- **Pool connection errors** - Confirm `DATABASE_URL` is valid, the database is reachable, and the user has required privileges.
- **JWT warnings** - Missing `JWT_SECRET` logs a warning on boot; set it before exercising any protected route or middleware.
- **Seeder collisions** - The seeder generates deterministic receipt numbers (`RCP-YYYY-MM-######`). Drop or truncate target tables before rerunning if you need a fresh dataset.
- **Sidebar cache mismatch** - Clear `localStorage.user` or use the `/api/auth/me` endpoint when switching accounts during development.

---

Happy brewing! ☕️

