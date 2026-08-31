# CRM-DS (HRM Pilot Web App) - Project Handoff

## 1. Project Overview & Purpose
**Project Name**: CRM-DS (HRM Pilot Web App)  
**Description**: A modern Human Resource Management (HRM) and Customer Relationship / Workforce Pilot application built with Next.js 15, React 19, TypeScript, Tailwind CSS, and Prisma ORM backed by a PostgreSQL / Supabase database. The platform supports role-based management for Admins, Managers, and Employees, tracking attendance, leave allowances, department allocation, holiday calendars, notifications, and audit logging.

---

## 2. Current Project Status
- **Repository Setup**: Project checked, sanitized, and prepared for GitHub upload under repository name **CRM-DS**.
- **Dependencies**: React 19, Next.js 15, Prisma Client v5.22.0, Tailwind CSS v4, Lucide React icons, and XLSX library for data export.
- **Database Schema**: Full Prisma schema configured (`prisma/schema.prisma`) featuring models for `Employee`, `LeaveRecord`, `AttendanceLog`, `CompanySettings`, `Holiday`, `Department`, `Notification`, and `AuditLog`.
- **Security & Hygiene**: `.gitignore` created to sanitize sensitive `.env` secrets, build artifacts (`.next`), node modules, and local database files. `.env.example` created as a clean environment configuration reference.

---

## 3. Key Features & Structure
- **Admin Portal** (`/admin`): Department management, employee provisioning, salary & working hours configuration, company settings, and audit logs.
- **Manager Portal** (`/manager`): Leave request approvals/rejections, attendance tracking, team management, and departmental reports.
- **Employee Portal** (`/employee`): Attendance log views, check-in/check-out interactions, leave allowance metrics (Casual, Planned, Sick), and request submissions.
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
├── postcss.config.mjs    # PostCSS configuration for Tailwind CSS
├── server.js             # Custom production server script
├── tsconfig.json         # TypeScript compiler configuration
├── prisma/
│   └── schema.prisma     # Prisma database schema for Supabase PostgreSQL
└── src/
    ├── app/              # Next.js App Router (admin, manager, employee, login, api)
    ├── components/       # Reusable UI components
    ├── lib/              # Database clients and utility functions
    └── middleware.ts     # Edge middleware for routing & authentication
```

---

## 5. Setup & Execution Instructions

### Prerequisites
- Node.js (v18+ recommended)
- npm or pnpm / yarn
- PostgreSQL database instance (e.g., Supabase)

### Getting Started
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/<your-username>/CRM-DS.git
   cd CRM-DS
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Environment Setup**:
   Copy `.env.example` to `.env` and fill in your Supabase or PostgreSQL credentials:
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

6. **Production Build**:
   ```bash
   npm run build
   npm start
   ```

---

## 6. Next Steps & Pending Tasks
1. Initialize Git repository locally and link to GitHub remote repository (`CRM-DS`).
2. Push `main` branch to GitHub.
3. Configure CI/CD pipelines (e.g., GitHub Actions) or Vercel deployment if desired.
4. Set up production environment variables in the hosting platform.

---

## 7. Known Issues & Risks
- `.env` contains Supabase connection strings; ensure `.env` is **NEVER** committed to version control.
- Verify database migration status using `npx prisma db push` or `npx prisma migrate dev` when setting up a fresh database instance.
