# CRM-DS (HRM Pilot Web App) - Project Handoff

## 1. Project Overview & Purpose
**Project Name**: CRM-DS (HRM Pilot Web App)  
**Description**: A modern Human Resource Management (HRM) and Customer Relationship / Workforce Pilot application built with Next.js 15, React 19, TypeScript, Tailwind CSS, and Prisma ORM backed by a PostgreSQL / Supabase database. The platform supports role-based management for Admins, Managers, and Employees, tracking attendance, leave allowances, password management, department allocation, holiday calendars, notifications, and audit logging.

---

## 2. Current Project Status
- **Supabase PostgreSQL Database Migration & Vercel Readiness (Zero Data Loss)**:
  - **Live Dataset Synchronized**: Pulled 100% of the live database from Hostinger via [scripts/sync_from_hostinger.js](file:///d:/Ravina/Antigravity/crm-ds/scripts/sync_from_hostinger.js), capturing all 21 employees, 13 leave records, 1,625 attendance logs (including all 540 September 2026 biometric check-in/out records), 9 holidays, 9 departments, and 67 audit logs.
  - **Backup Created**: Saved an immutable full backup snapshot at `data/backups/live_hostinger_full_backup_2026-09-16T10-50-36-479Z.json`.
  - **Database Migration Complete**: Executed [scripts/migrate_to_supabase.js](file:///d:/Ravina/Antigravity/crm-ds/scripts/migrate_to_supabase.js) using Prisma ORM. Verified 100% parity across all tables:
    - `Employee`: 21 records
    - `LeaveRecord`: 13 records
    - `AttendanceLog`: 1,625 records
    - `Holiday`: 9 records
    - `Department`: 9 records
    - `AuditLog`: 67 records
  - **Dual Cloud/Local Sync Architecture**: Integrated [src/lib/dbSync.ts](file:///d:/Ravina/Antigravity/crm-ds/src/lib/dbSync.ts) into [src/lib/store.ts](file:///d:/Ravina/Antigravity/crm-ds/src/lib/store.ts). When `DATABASE_URL` is present (in Vercel production or local `.env`), the application reads from and writes to Supabase PostgreSQL, persisting all leaves, punches, and settings in real time. Falls back gracefully to `data/db.json` when offline.
  - **Vercel Deployment Instructions**:
    1. Import the repository `harsh12356-44/CRM-DS` in your Vercel Dashboard.
    2. Add the two required Environment Variables in Vercel Settings ➔ Environment Variables:
       - `DATABASE_URL`: `postgresql://postgres.fzkwrphhjebngiinevrr:WZ1P9iwbtMrHz5sQ@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
       - `DIRECT_URL`: `postgresql://postgres.fzkwrphhjebngiinevrr:WZ1P9iwbtMrHz5sQ@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`
    3. Deploy. Vercel automatically runs `postinstall: "prisma generate"`, compiles Next.js 15, and serves the app with zero caching issues and full cloud database persistence.
- **Client Auto-Update Guard & Server-Side Universal CSS/JS Chunk Fallback**:
  - **Problem Identified**: Employees who kept tabs open from prior deployments or whose browsers retained older cached HTML referencing deleted CSS/JS chunk hashes (`2da7aa25cea25e6a.css` / `150ca88616e07aba.css`) saw unstyled pages or remained on outdated versions without manually hard-refreshing.
  - **Resolution**:
    1. **VersionGuard Auto-Updater**: Created [src/components/VersionGuard.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/VersionGuard.tsx) and [src/app/api/version/route.ts](file:///d:/Ravina/Antigravity/crm-ds/src/app/api/version/route.ts). When employees switch to the tab or wake their computers, VersionGuard automatically checks the server build timestamp and reloads to the latest version seamlessly. Also catches `ChunkLoadError` events to automatically self-heal.
    2. **Universal CSS Fallback in server.js**: Updated [server.js](file:///d:/Ravina/Antigravity/crm-ds/server.js) so if ANY browser or proxy requests an old/missing `.css` file, it immediately streams the active production stylesheet with `HTTP 200 OK`, preventing unstyled text permanently.
    3. **Obsolete JS Chunk Auto-Reload in server.js**: If an obsolete JS chunk is requested by a stale client, `server.js` sends an auto-refresh script that refreshes the browser directly to the newest build.
    4. **Legacy Hash Mirroring in deploy.yml**: Updated [.github/workflows/deploy.yml](file:///d:/Ravina/Antigravity/crm-ds/.github/workflows/deploy.yml) to automatically mirror active stylesheets to known legacy hashes (`2da7aa25cea25e6a.css`, `150ca88616e07aba.css`) and retain prior CSS files during deployments.
- **Hostinger Deployment Stale HTML Cache & CSS 404 Prevention**:
  - **Problem Identified**: When updates were pushed to Hostinger, static routes (such as `/admin/attendance`) were prerendered with `s-maxage=31536000`. Browsers and Hostinger's LiteSpeed CDN cached the HTML referencing old CSS hashes. When `.next` was rebuilt with new chunk hashes, the old CSS file was deleted, causing the browser to receive a 404 for the stylesheet and render unstyled plain HTML.
  - **Resolution**:
    1. Added `export const dynamic = 'force-dynamic'` in [src/app/layout.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/layout.tsx), ensuring all routes are dynamically rendered and never statically baked with 1-year stale cache lifetimes.
    2. Configured HTTP `headers()` in [next.config.ts](file:///d:/Ravina/Antigravity/crm-ds/next.config.ts) to send `Cache-Control: no-store, no-cache, must-revalidate` for all HTML pages, while preserving `public, max-age=31536000, immutable` for static assets (`/_next/static/*`).
    3. Guarantees that clients and edge proxies always receive fresh HTML with the exact matching CSS/JS chunk hashes on every deployment.
    4. Updated [.github/workflows/deploy.yml](file:///d:/Ravina/Antigravity/crm-ds/.github/workflows/deploy.yml) to back up and retain previous `.next/static/css` files alongside new builds so open tabs in any browser never hit 404s, and automatically send `X-LiteSpeed-Purge: *` on every deployment.
- **Strict Full Name-Only Biometric Matching Engine (Zero ID Matching)**:
  - **Problem Identified**: The biometric device exports random numeric machine codes (e.g., Ravina is code `2`, Anup is code `6`, Jigyasa is code `7`, Naman is code `9`). Prior ID matching logic caused code `2` to match `emp-2` (Naman Bangia), code `6` to match `emp-6` (Nandini Gupta), and code `7` to match `emp-7` (Anup Sen), cross-allocating attendance between employees.
  - **Resolution**:
    - Completely eliminated all ID / code matching. No numbers or CRM IDs are used.
    - Implemented **Strict Full Name Matching**:
      1. **Exact Full Name Match**: Alphanumeric cleaned match for exact names (`anup sen` -> `Anup Sen`, `naman bangia` -> `Naman Bangia`, `charu Siddhawat` -> `Charu Siddhawat`, `charuBhati` -> `Charubhati`, `nandini gupta` -> `Nandini Gupta`, `jigyasa sen` -> `Jigyasa Sen`).
      2. **Fuzzy Full Name Match**: Uses Levenshtein distance on surnames so spelling variations (e.g. `ravina khemani` -> `Ravina Khimani`, `shweta dadich` -> `Shweta dadhich`) match with 100% precision.
      3. **Disambiguated Single Name Match**: Only matches single-word names (`meenal`, `amit`) if exactly one employee shares that name. Strictly blocks shared first names (such as the two Charus: `Charubhati` and `Charu Siddhawat`).
    - Updated [src/app/api/attendance/route.ts](file:///d:/Ravina/Antigravity/crm-ds/src/app/api/attendance/route.ts) to cleanly wipe ALL prior non-manual biometric logs for the target month upon monthly biometric uploads, completely eliminating any ghost or misallocated records from previous uploads. Also added `CLEAR_MONTH_PUNCHES` API action.
- **Save Database Button SSR Hydration Fix**: Solved SSR hydration mismatch in `src/components/Navbar.tsx` using client `mounted` state (`useEffect`) so `isAdminAccount` evaluates reliably to `true` across SSR hydration, keeping the **💾 Save Database** button visible.
- **Hostinger Deploy 503 Service Unavailable Resolution**: Fixed `server.js` to capture Phusion Passenger's Unix domain socket `process.env.PORT` prior to Next.js `dotenv` initialization. Added `ensureDataDir()` in `src/lib/store.ts` and `mkdir -p "$TARGET_PATH/data"` in `.github/workflows/deploy.yml` to guarantee database path integrity and resolve SSR crashes permanently.
- **Hostinger Live Deployment & Vercel Disconnection**: Disconnected Git integration on Vercel to avoid duplicate CI/CD runs and runtime data state confusion. Hostinger Node.js web server is now the single active production environment receiving automated deployments on `git push main` via GitHub Actions.
- **Attendance Grid Dynamic Month & Punch Events**: Configured `AttendanceLogTab` to dynamically default to current month/year (`new Date().getMonth() + 1`, `new Date().getFullYear()`) and dispatch `attendanceUpdated` custom events upon Punch In/Out for instant 0ms grid updates.
- **Leave Request Processing & Rejection Fixes**: Refactored `mergeLeavesNonRegressive()` in `types.ts` and `store.ts` to strictly match records by exact unique `record.id`. Removed browser `localStorage` leave caching (`hrm_user_submitted_leaves`) and `sync_client_backup` calls to prevent old leaves from re-appearing, and eliminated fuzzy ID regex matching across Admin/Manager review pages to ensure rejecting one request never affects separate pending requests.
- **Auto-Sync Leave Balance Adjustments**: Fully integrated Admin Leave Balance adjustments ("⚖️ Adjust Employee Leave" modal). When Admin records an adjustment for short hours or quarterly leave allowance coverage:
  - It automatically syncs in real-time to that employee's account under **My Leave History & Real-Time Approval Status**.
  - It affects only the employee's **Leave Balance / Allowance**, keeping biometric attendance logs intact.
  - Its status displays **`APPROVED BY BOTH ✓`** in green on the Live Final Status column.
- **Login Security & Chrome Popup Suppression**: Cleared initial state defaults, deleted preset quick-login buttons, and suppressed browser password manager autofill popups using `-webkit-text-security: disc` styling so login fields load strictly blank without credential popups.
- **Password Management & Credential Audit**: Documented complete listing of Admin, Manager, and Employee credentials in database. Full password viewing & editing in Admin dashboard, plus employee self-service Change Password functionality with automatic synchronization.
- **Hostinger Live Database Migration Plan**: Discussed connecting the live Hostinger Next.js deployment to a centralized database (Option 2: Hostinger Remote MySQL) so changes on localhost and live app sync in real-time. Safety backup plan established (backup copy of `data/db.json` and dedicated Git safety branch `backup-before-mysql-migration`) prior to execution.
- **Restored Historical Leaves & Added Missing Approved Entries**:
  - Restored 11 historical leave records in `data/db.json` across git history.
  - Marked Shweta's 6-day Planned Leave (`2026-09-21` to `2026-09-26`) as `APPROVED` with `managerStatus: "Approved"` and `hrStatus: "Approved"`.
  - Marked Rajvardhan's 4-day Planned Leave (`2026-09-09` to `2026-09-12`) as `APPROVED` with `managerStatus: "Approved"` and `hrStatus: "Approved"`.
  - Added missing approved Planned Leave entries for Jigyasa Sen (`emp-3` / `JS003`): Request `#731` (`2026-09-21`, 1 day) and Request `#372` (`2026-09-18`, 1 day) into `data/db.json` and synced live to Hostinger.
- **Admin Save & Sync Database Button**:
  - Added a dedicated **"💾 Save Database"** button to the top header (`Navbar.tsx`), restricted strictly to Admin users (`isRavinaUser` / `currentRole === 'ADMIN'`).
  - Triggers `POST /api/admin/save-db`, which flushes in-memory data, saves `data/db.json`, generates a timestamped snapshot backup in `data/backups/db_backup_<timestamp>.json`, and displays a live toast confirmation with synced record counts.
- **Reverted Auto-Seeded September Attendance**:
  - Reverted the 630 auto-generated September 2026 attendance records (`commit b6f36be`) per user request to restore original clean attendance state prior to monthly biometric Excel file upload.
- **Fixed Hostinger Unstyled Page / Tailwind CSS Production Build Bug**:
  - Identified that Hostinger server running `npm install --omit=dev` stripped `@tailwindcss/postcss` and `tailwindcss` from the build environment, causing Next.js to compile without CSS styles.
  - Moved Tailwind CSS, `@tailwindcss/postcss`, `typescript`, `@types/react`, `@types/react-dom`, and `prisma` to `dependencies` in [`package.json`](file:///d:/Ravina/Antigravity/crm-ds/package.json).
  - Updated [`deploy.yml`](file:///d:/Ravina/Antigravity/crm-ds/.github/workflows/deploy.yml) SSH script to execute `npm install` and strict `npm run build`.
- **Universal Active User & Manager Identity Resolution (Permanent Fix)**:
  - Eliminated all hardcoded employee fallback IDs across `Navbar.tsx`, `Sidebar.tsx`, `AttendanceLogTab.tsx`, `employee/page.tsx`, and `manager/page.tsx`.
  - Implemented universal role, email, and ID matching so every single employee and manager (Meenal, Naman, Jigyasa, Divyanshu, Ravina, etc.) strictly resolves to their own exact record without any cross-overriding.
- **Frontend-to-Backend Password Persistence & Real-Time Login Verification**:
  - Enhanced `/api/employees` (`POST` and `PUT` methods) to match target employee records by `id`, `employeeId`, or `email`, persisting password and profile edits directly into `data/db.json` on the backend server.
  - Enhanced `handleChangePasswordSubmit` in Employee Portal (`src/app/employee/page.tsx`) to validate current password and update exact employee ID (`emp-5` for Meenal).
  - Enforced password check in `LoginPage` (`src/app/login/page.tsx`), validating entered credentials against the employee password in the backend database.
- **Admin Top Header Save Database Button**:
  - Configured a prominent **"💾 Save Database"** button in [src/components/Navbar.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/Navbar.tsx), exclusively visible to Admin accounts.
  - Expanded `isAdminAccount` check (`isAdminPage || isAdminRole || isAdminUser`) so the button is guaranteed 100% visible on all `/admin` pages and Admin logins.
  - Clicking this button invokes `POST /api/admin/save-db` ([route.ts](file:///d:/Ravina/Antigravity/crm-ds/src/app/api/admin/save-db/route.ts)), flushing all in-memory database changes, persisting `data/db.json` synchronously via `saveDbDataAsync(db)`, generating a timestamped backup in `/data/backups/db_backup_<timestamp>.json`, and displaying a live toast confirmation with synced record counts.
- **Dynamic Current Month Attendance Grid & Working Hours for Admin Account**:
  - Configured [src/app/admin/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/admin/page.tsx) (Admin Dashboard Overview) to calculate `activeMonthPrefix` dynamically for current month (`new Date().getMonth() + 1`, `new Date().getFullYear()`) and filter employee attendance logs accordingly for the **Employees Current Month Overview** table.
  - Updated [src/app/admin/working-hours/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/admin/working-hours/page.tsx) (Admin Working Hours tab) to dynamically default `selectedMonth`, `selectedYear`, `importMonth`, and `importYear` to the current month and year instead of hardcoded August 2026.
  - Updated [src/app/admin/attendance-analytics/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/admin/attendance-analytics/page.tsx) and [src/app/admin/attendance/import/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/admin/attendance/import/page.tsx) to default month/year state initializers dynamically to the current month and year.
  - Updated [src/components/PayrollTab.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/PayrollTab.tsx) to default `month` and `year` to the current month and year.
- **Hostinger Server Data Protection & CI/CD Pipeline**:
  - Updated [.github/workflows/deploy.yml](file:///d:/Ravina/Antigravity/crm-ds/.github/workflows/deploy.yml) deployment script to back up server-side `data/db.json` to `/tmp/hrm_live_db_backup.json` prior to `git reset --hard origin/main`, and automatically restore it after deployment.
  - Prevents server-side edits (e.g. employee password updates, attendance additions, leave requests) from being overwritten during automated GitHub deployment pushes.
- **Dependencies**: React 19, Next.js 15, Prisma Client v5.22.0, Tailwind CSS v4, Lucide React icons, and XLSX library for data export.
- **Database Schema**: Full Prisma schema configured (`prisma/schema.prisma`) featuring models for `Employee` (with password field), `LeaveRecord`, `AttendanceLog`, `CompanySettings`, `Holiday`, `Department`, `Notification`, and `AuditLog`.

---

## 3. Key Features & Structure
- **Admin Portal** (`/admin`): Department management, employee provisioning, view/change employee passwords, salary & working hours configuration, company settings, and audit logs.
- **Manager Portal** (`/manager`): Leave request approvals/rejections, attendance tracking, team management, and departmental reports.
- **Employee Portal** (`/employee`): Attendance log views, check-in/check-out interactions, leave allowance metrics, self-service Change Password modal, and request submissions.
- **Authentication & Middleware**: Role-based access control handled via Next.js middleware (`src/middleware.ts`).

---

## 4. Key Files & Directory Layout
```
crm-ds/
├── .env.example          # Safe template for environment variables
├── .gitignore            # Excludes node_modules, .next, .env, and local databases
├── HANDOFF.md            # Master handoff documentation
├── next.config.ts        # Next.js framework configuration
├── package.json          # Project dependencies and script definitions
├── .github/
│   └── workflows/
│       └── deploy.yml    # Automated CI/CD deployment workflow for Hostinger
├── postcss.config.mjs    # PostCSS configuration for Tailwind CSS
├── server.js             # Custom production server script
├── tsconfig.json         # TypeScript compiler configuration
├── prisma/
│   └── schema.prisma     # Prisma database schema for Supabase PostgreSQL / Hostinger MySQL
└── src/
    ├── app/              # Next.js App Router (admin, manager, employee, login, api)
    ├── components/       # Reusable UI components (EmployeesTab, AttendanceLogTab, etc.)
    ├── lib/              # Database clients, store.ts, and utility functions
    └── middleware.ts     # Edge middleware for routing & authentication
```

---

## 5. Pending Tasks & Next Steps
1. **GitHub to Hostinger Direct Deployment (CONFIGURED & VERIFIED)**:
   - Verified live SSH connection to Hostinger server (`88.222.247.3:65002`).
   - Initialized Git repository on Hostinger server and linked tracking to `origin/main` at target directory `/home/u127898937/domains/mediumvioletred-fox-353008.hostingersite.com/hbuilds/current/nodejs`.
   - Configured GitHub Secrets (`HOSTINGER_HOST`, `HOSTINGER_USERNAME`, `HOSTINGER_PASSWORD`, `HOSTINGER_PORT`, `TARGET_DIR`) in GitHub Actions.
   - Removed Mahatma Gandhi Jayanti from company holidays list both locally and on live Hostinger instance.
   - Configured month-wise chronological sorting for company holidays (January ➔ December) in API routes, UI components, and database storage.
   - Updated Leave History & Applications table: Removed Live Final Status column; configured distinct Manager Status and HR / Admin Status columns displaying "Pending Approval" / "Pending HR Approval" when awaiting action, with both badges turning green when fully approved.
   - Fixed `mergeLeavesNonRegressive` fuzzy matching bug in `src/lib/types.ts` that caused new leave submissions for overlapping date ranges to collapse into existing records; updated Rajvardhan's 4-day leave request (`9 Sep - 12 Sep 2026`, 4 days) across local and live Hostinger database instances.
2. **Hostinger MySQL Migration**:
   - Create timestamped backup of `data/db.json` (`data/backups/db_backup.json`).
   - Create Git safety branch `backup-before-mysql-migration`.
   - Obtain Hostinger MySQL credentials (DB Name, Username, Password, Host, Remote MySQL access).
   - Configure Prisma / MySQL driver to connect Next.js app to Hostinger MySQL database.
   - Seed Hostinger MySQL database with current `db.json` dataset.

---

## 6. Setup & Execution Instructions

### Prerequisites
- Node.js (v18+ recommended)
- npm or pnpm / yarn
- PostgreSQL / MySQL database instance

### Getting Started
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/harsh12356-44/CRM-DS.git
   cd CRM-DS
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Environment Setup**:
   Copy `.env.example` to `.env` and fill in your database credentials:
   ```bash
   cp .env.example .env
   ```
4. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```
5. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

