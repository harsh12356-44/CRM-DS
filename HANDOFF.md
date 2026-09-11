# CRM-DS (HRM Pilot Web App) - Project Handoff

## 1. Project Overview & Purpose
**Project Name**: CRM-DS (HRM Pilot Web App)  
**Description**: A modern Human Resource Management (HRM) and Customer Relationship / Workforce Pilot application built with Next.js 15, React 19, TypeScript, Tailwind CSS, and Prisma ORM backed by a PostgreSQL / Supabase database. The platform supports role-based management for Admins, Managers, and Employees, tracking attendance, leave allowances, password management, department allocation, holiday calendars, notifications, and audit logging.

---

## 2. Current Project Status
- **GitHub Repository**: Live and up to date at [https://github.com/harsh12356-44/CRM-DS](https://github.com/harsh12356-44/CRM-DS) (`main` branch).
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

