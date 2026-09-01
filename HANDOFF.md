# CRM-DS (HRM Pilot Web App) - Project Handoff

## 1. Project Overview & Purpose
**Project Name**: CRM-DS (HRM Pilot Web App)  
**Description**: A modern Human Resource Management (HRM) and Customer Relationship / Workforce Pilot application built with Next.js 15, React 19, TypeScript, Tailwind CSS, and Prisma ORM backed by a PostgreSQL / Supabase database. The platform supports role-based management for Admins, Managers, and Employees, tracking attendance, leave allowances, password management, department allocation, holiday calendars, notifications, and audit logging.

---

## 2. Current Project Status
- **GitHub Repository**: Live and up to date at [https://github.com/harsh12356-44/CRM-DS](https://github.com/harsh12356-44/CRM-DS) (`main` branch).
- **Password Management**: Full password viewing & editing in Admin dashboard, plus employee self-service Change Password functionality with automatic synchronization.
- **Attendance & Working Hours Real-Time Sync**: Real-time auto-updates for attendance grids and working hours across employee dashboards for all days (1 to 31) of the month, with auto-polling and multi-key employee ID normalization (`emp.id`, `emp.employeeId`, `emp.name`).
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
├── postcss.config.mjs    # PostCSS configuration for Tailwind CSS
├── server.js             # Custom production server script
├── tsconfig.json         # TypeScript compiler configuration
├── prisma/
│   └── schema.prisma     # Prisma database schema for Supabase PostgreSQL
└── src/
    ├── app/              # Next.js App Router (admin, manager, employee, login, api)
    ├── components/       # Reusable UI components (EmployeesTab, AttendanceLogTab, etc.)
    ├── lib/              # Database clients, store.ts, and utility functions
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
   git clone https://github.com/harsh12356-44/CRM-DS.git
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
