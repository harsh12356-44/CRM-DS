# HRM Pilot (CRM-DS) — Comprehensive Technical Documentation

**Version:** 3.0.0 (Production Release)  
**Last Updated:** October 2026  
**Primary Repository:** `harsh12356-44/CRM-DS`  
**Frameworks:** Next.js 15.1.0, React 19.0.0, TypeScript 5.0, Tailwind CSS v4, Prisma ORM 5.22.0  

---

## 1. System Architecture & High-Level Design

HRM Pilot is designed with an enterprise-grade hybrid architecture combining low-latency in-memory query performance with persistent relational database integrity and real-time client state distribution.

```mermaid
flowchart TB
    subgraph ClientLayer [Client / Browser Layer]
        DesktopWeb[Desktop Browser: Chrome / Safari / Edge]
        MobilePWA[Mobile Touch Device: iOS PWA / Android]
        BC[BroadcastChannel: crm_time_tracker_sync]
        DOMEvents[Window CustomEvents: feedbackUpdated, leaveDataUpdated]
    end

    subgraph EdgeMiddleware [Edge & Routing Layer]
        MW[Edge Middleware: src/middleware.ts]
        AuthCookies[Cookie Verification: hrm_user_role, hrm_auth_id]
    end

    subgraph ApplicationLayer [Next.js 15 Application Server]
        AppRouter[Next.js App Router: /admin, /manager, /employee, /login]
        APIRoutes[Route Handlers: /api/*]
        CaptureEngine[Screen Capture Engine: src/lib/screenCapture.ts]
        VersionGuard[VersionGuard Auto-Reload: src/components/VersionGuard.tsx]
    end

    subgraph DataSyncLayer [Hybrid Data & Store Layer]
        InMemoryCache[In-Memory Runtime Store: src/lib/store.ts]
        DiskJson[Local Disk Storage: data/db.json]
        DiskScreenshots[Screenshot Disk Vault: data/screenshots/]
        DbSync[Prisma Cloud Synchronizer: src/lib/dbSync.ts]
    end

    subgraph RemotePersistence [Cloud Persistence Layer]
        SupabasePg[(Supabase PostgreSQL Database)]
        HostingerNode[Hostinger Production Node.js Server]
    end

    ClientLayer --> MW
    MW --> AppRouter
    MW --> APIRoutes
    AppRouter --> InMemoryCache
    APIRoutes --> InMemoryCache
    InMemoryCache --> DiskJson
    InMemoryCache -. Async Sync .-> DbSync
    DbSync --> SupabasePg
    CaptureEngine --> DiskScreenshots
    BC <--> ClientLayer
    DOMEvents <--> ClientLayer
```

### 1.1 Key Architectural Principles

1. **Non-Blocking Dual Persistence**:
   - The primary data layer is loaded into a validated in-memory store (`src/lib/store.ts`) for instant sub-millisecond response times.
   - All mutations are synchronously committed to `data/db.json` on local disk and asynchronously persisted via `Promise.all` concurrent upserts to **Supabase PostgreSQL** via **Prisma ORM** (`src/lib/dbSync.ts`).
   - If cloud connectivity or migrations are temporarily delayed, local operations proceed uninterrupted with zero downtime or request blocking.

2. **Zero-Regression State Synchronization**:
   - Time tracking sessions, biometric logs, and leave applications use non-regressive state merges (`mergeTimeEntriesNonRegressive`, `mergeLeavesNonRegressive`).
   - Remote database reads never overwrite in-flight client state or revert completed clock-out entries back to open states.

3. **Multi-Tenant Corporate Isolation**:
   - Workspaces are segregated by `Company` entity (`companyId`, `companyName`, `slug`).
   - The master `SUPER_ADMIN` role governs tenant onboarding, while tenant `ADMIN` accounts manage individual branches, rosters, and policies.

4. **Edge Security & Credential Isolation**:
   - Passwords saved on personal devices remain strictly in client `localStorage` and are never broadcast over the network.
   - Non-admin API responses for `/api/employees` actively strip password fields to prevent credential leakage via DevTools.

---

## 2. Technology Stack & Version Matrix

| Layer | Component | Version | Specification / Purpose |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js | `^15.1.0` | App Router, Dynamic Route Handlers, Edge Middleware |
| **UI Library** | React & React DOM | `^19.0.0` | React 19 Server Components, Actions, Optimistic Hooks |
| **Language** | TypeScript | `^5.0.0` | Strict Type Safety, Interfaces, Custom Types |
| **Styling** | Tailwind CSS & PostCSS | `^4.0.0` | Modern Utility Styling, Dynamic Dark Mode, CSS Variables |
| **ORM** | Prisma Client & CLI | `^5.22.0` | PostgreSQL Schema Migration, Type-Safe Query Builder |
| **Database** | PostgreSQL | `15.x` | Hosted on Supabase AWS (Singapore `ap-southeast-1`) |
| **Spreadsheet Engine** | XLSX (SheetJS) | `^0.18.5` | Biometric Excel Import & Timesheet CSV Export |
| **Icons** | Lucide React | `^0.468.0` | Lightweight SVG System Icons |
| **Runtime Environment** | Node.js | `20.x` LTS | Hostinger Phusion Passenger & Local Development |
| **Web Server / Proxy** | Phusion Passenger / LiteSpeed | Production | Reverse proxy handling Unix Domain Sockets |

---

## 3. Codebase Structure & Directory Layout

```
crm-ds/
├── .github/
│   └── workflows/
│       └── deploy.yml              # Automated GitHub Actions deployment to Hostinger SSH
├── data/                           # Local database storage & file uploads (ignored in Git)
│   ├── backups/                    # Timestamped JSON snapshots of db.json
│   ├── feedback_attachments/       # Uploaded complaint & support screenshot images
│   ├── screenshots/                # WFH screen capture JPEG files + index.json
│   ├── uploads/                    # Uploaded corporate branding logos
│   └── db.json                     # Primary runtime JSON database
├── docs/                           # Central Documentation Hub
│   ├── README.md                   # Documentation Index & Quick Start
│   ├── TECHNICAL_DOCUMENTATION.md  # System Architecture, APIs & Schemas (this document)
│   └── NON_TECHNICAL_USER_MANUAL.md # End-User & Administrator Operation Manual
├── prisma/
│   └── schema.prisma               # Prisma relational schema for PostgreSQL / Supabase
├── public/                         # Public static web assets
│   ├── hrm-pilot-preview.html      # Standalone SaaS commercial marketing website
│   └── HRM_PILOT_WEBSITE_DEVELOPER_SPECIFICATION.pdf # Marketing developer blueprint
├── scripts/                        # Operational & maintenance automation scripts
│   ├── cleanup_screenshots.js      # Retention policy cron: purges screenshots > 7 days
│   ├── migrate_to_supabase.js      # Data seed & migration script from JSON to Prisma
│   └── sync_from_hostinger.js      # Hostinger live database backup synchronizer
├── src/
│   ├── app/                        # Next.js App Router routes & API endpoints
│   │   ├── admin/                  # HR Admin Suite pages (17 sub-desks)
│   │   │   ├── attendance/         # Attendance log grid & manual editor
│   │   │   ├── attendance-analytics/ # Attendance stats, late marks, bar charts
│   │   │   ├── audit-logs/         # System change & activity trail
│   │   │   ├── branches/           # Multi-branch management desk (8h vs 9h shifts)
│   │   │   ├── companies/          # Super Admin multi-tenant workspace desk
│   │   │   ├── departments/        # Department roster & head allocation
│   │   │   ├── employees/          # Staff directory & profile management
│   │   │   ├── feedback/           # Employee complaint & support desk
│   │   │   ├── holidays/           # Company holiday calendar configuration
│   │   │   ├── leave-records/      # Leave requests approval register & history
│   │   │   ├── leave-tracker/      # Quarterly leave allowance tracker
│   │   │   ├── managers/           # Manager role management desk
│   │   │   ├── payroll/            # Monthly salary & deduction generator
│   │   │   ├── settings/           # Global rules, shift defaults & logo upload
│   │   │   ├── team-approvals/     # Manager subordinate leave approval desk
│   │   │   ├── time-tracking/      # WFH Live Board, Timesheets, Gallery & Settings
│   │   │   └── working-hours/      # 31-day working hours matrix & overtime desk
│   │   ├── api/                    # 16 Route Handler groups (see Section 5)
│   │   ├── employee/               # Employee Portal dashboard & tabs
│   │   ├── manager/                # Manager Workspace desk
│   │   ├── login/                  # Multi-tenant login page with 1-click device memory
│   │   ├── preview/                # Route redirector to SaaS marketing landing preview
│   │   ├── globals.css             # Dark-mode theme rules, safe-area utilities
│   │   ├── layout.tsx              # Root HTML wrapper, PWA meta tags & VersionGuard
│   │   └── page.tsx                # Root redirector based on authenticated role
│   ├── components/                 # 22 Modular React UI components
│   │   ├── AdjustLeaveModal.tsx    # Admin leave allowance override modal
│   │   ├── AttendanceLogTab.tsx    # Responsive attendance matrix & daily calendar
│   │   ├── AuditLogsTab.tsx        # System audit trail viewer
│   │   ├── BranchesTab.tsx         # Multi-branch configuration desk
│   │   ├── CompaniesTab.tsx        # Super Admin company workspace desk
│   │   ├── DepartmentsTab.tsx      # Department management component
│   │   ├── EditTrackerModal.tsx    # HR manual timesheet correction modal
│   │   ├── EmployeesTab.tsx        # Employee directory, cards, and profile editor
│   │   ├── FeedbackAdminTab.tsx    # HR feedback & complaint response desk
│   │   ├── HolidaysTab.tsx         # Company holiday calendar table & modal
│   │   ├── LeaveTrackerTab.tsx     # Quarterly leave quota visualization
│   │   ├── Navbar.tsx              # Dynamic header, workspace switcher & Save DB button
│   │   ├── PayrollTab.tsx          # Payroll generation & Excel exporter
│   │   ├── RecordLeaveModal.tsx    # Responsive leave application modal
│   │   ├── ScreenshotGallery.tsx   # WFH screenshot thumbnail grid & lightbox
│   │   ├── SettingsTab.tsx         # Company rules, break settings & logo uploader
│   │   ├── Sidebar.tsx             # Desktop sidebar & slide-in mobile off-canvas drawer
│   │   ├── SupportFeedbackTab.tsx  # Employee complaint submission & history tab
│   │   ├── TimeTracker.tsx         # Employee WFH tracker, break controller & live clock
│   │   ├── TimeTrackingAdmin.tsx   # Admin Live Board, Timesheets, and settings tab
│   │   ├── TrackerDetailModal.tsx  # Detailed session & break timeline modal
│   │   └── VersionGuard.tsx        # Automatic client reload & chunk error self-healer
│   ├── lib/                        # Core utilities, types, and database engines
│   │   ├── dbSync.ts               # Prisma PostgreSQL loading & persistence engine
│   │   ├── screenCapture.ts        # Browser getDisplayMedia capture & upload controller
│   │   ├── store.ts                # In-memory database store, normalization & events
│   │   └── types.ts                # TypeScript data interfaces & calculation helpers
│   ├── instrumentation.ts          # Next.js server lifecycle initialization hook
│   ├── instrumentation-node.ts     # Hourly screenshot cleanup scheduler
│   └── middleware.ts               # Edge routing & Role-Based Access Control
├── next.config.ts                  # Next.js config with HTTP no-cache headers
├── package.json                    # Project dependencies & build scripts
├── server.js                       # Production Node.js server with universal CSS fallback
└── tsconfig.json                   # Strict TypeScript compiler options
```

---

## 4. Data Layer & Prisma Database Schema

The relational database is defined in `prisma/schema.prisma` and backed by PostgreSQL (Supabase).

### 4.1 Schema Models & Relationships

```mermaid
erDiagram
    Company ||--o{ Employee : "employs"
    Company ||--o{ Branch : "operates"
    Company ||--o{ Department : "contains"
    Employee ||--o{ LeaveRecord : "submits"
    Employee ||--o{ AttendanceLog : "logs"
    Employee ||--o{ TimeEntry : "records"
    Employee ||--o{ FeedbackTicket : "files"
    Employee ||--o{ Notification : "receives"

    Employee {
        String id PK
        String employeeId UK
        String name
        String email UK
        String role
        String department
        String designation
        String workMode
        Int dailyWorkingRequirementMinutes
        String weeklyOff
        Float monthlySalary
        Int casualAllowance
        Int plannedAllowance
        Int sickAllowance
        String password
        String companyId FK
        String branchId FK
    }

    LeaveRecord {
        String id PK
        String employeeId FK
        String leaveType
        String dayType
        String startDate
        String endDate
        Float daysCount
        String quarter
        Int year
        String status
        String note
        String handoverNote
        String emergencyContact
    }

    AttendanceLog {
        String id PK
        String employeeId FK
        String date
        String attendanceCode
        String checkIn
        String checkOut
        Int workedMinutes
        Int requiredMinutes
        Int shortMinutes
        Int extraMinutes
        Int sundayWorkedMinutes
        Boolean isManual
        String correctionReason
    }

    TimeEntry {
        String id PK
        String employeeId FK
        String date
        DateTime clockIn
        DateTime clockOut
        Json breaks
        String source
        Boolean autoClosed
    }

    FeedbackTicket {
        String id PK
        String employeeId FK
        String employeeName
        String category
        String subject
        String description
        String imageUrl
        String status
        String adminResponse
        DateTime resolvedAt
    }
```

### 4.2 Data Models Breakdown

1. **`Employee`**:
   - Represents staff members, managers, and administrators.
   - Key fields: `role` (`'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE'`), `workMode` (`'OFFICE' | 'WFH'`), `dailyWorkingRequirementMinutes` (`420` for 8h shift or `480` for 9h shift), `weeklyOff` (`"Sunday"` or `"Saturday & Sunday"`), `companyId`, `branchId`.
2. **`LeaveRecord`**:
   - Tracks leave requests and approvals.
   - Fields: `leaveType` (`'Casual Leave' | 'Planned Leave' | 'Sick Leave'`), `dayType` (`'full' | 'first_half' | 'second_half'`), `quarter` (`'Q1' | 'Q2' | 'Q3' | 'Q4'`), `status` (`'APPROVED' | 'PENDING' | 'REJECTED' | 'CANCELLED'`).
3. **`AttendanceLog`**:
   - Stores official biometric and manual office attendance records.
   - Attendance codes: `P` (Present), `HD` (Half Day), `A` (Absent), `PL` (Planned Leave), `UL` (Unpaid Leave), `WO` (Weekly Off), `H` (Holiday), `MP` (Missed Punch).
4. **`TimeEntry`**:
   - Manages Work From Home (WFH) live clock-in sessions, separate from biometric attendance.
   - `breaks`: JSON array containing `{ id, type: 'Tea Break' | 'Lunch Break', start, end, durationMinutes }`.
   - `autoClosed`: Flags sessions automatically terminated at midnight or after 14 hours.
5. **`FeedbackTicket`**:
   - Manages employee complaints, suggestions, help requests, and operational feedback.
   - Status transitions: `Pending` ➔ `In Review` ➔ `Resolved`.
6. **`Company`**:
   - Defines multi-tenant workspace partitions with separate shift defaults and branding.
7. **`Branch`**:
   - Manages company branches (e.g., Main HQ with 8h shift / 1 off vs. SEO Branch with 9h shift / 2 offs).

---

## 5. REST API Reference

All API routes are implemented using Next.js App Router route handlers in `src/app/api/*`. All responses carry strict anti-caching HTTP headers:
```http
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0
Pragma: no-cache
Expires: 0
```

### 5.1 Authentication (`/api/auth`)

#### `POST /api/auth/login`
Authenticates a user via email, employee ID, username prefix, or name.
- **Request Body**:
  ```json
  {
    "identifier": "sonu.digitalsuncity@gmail.com",
    "password": "Sonu@SG012"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "employee": {
      "id": "emp-12",
      "employeeId": "SG012",
      "name": "Sonu Goswami",
      "email": "sonu.digitalsuncity@gmail.com",
      "role": "EMPLOYEE",
      "companyId": "company-main",
      "companyName": "Digital Suncity",
      "department": "SEO",
      "designation": "SEO Executive",
      "status": "ACTIVE"
    }
  }
  ```
- **Cookies Set**: `hrm_user_role`, `hrm_user_email`, `hrm_user_id`, `hrm_user_company` (30 days validity, `SameSite=Lax`).

---

### 5.2 Employees (`/api/employees`)

- **`GET /api/employees`**:
  - Query Params: `companyId` (optional), `role` (optional).
  - Security: Strips `password` from all records for non-admin callers.
- **`POST /api/employees`**:
  - Adds a new employee or performs self-service password update.
  - Body: Complete employee profile object.
- **`PUT /api/employees`**:
  - Updates employee details, role, branch, shift target, or weekly off.
  - Non-admins can only update their own self record (`id === caller.id`).
- **`DELETE /api/employees`**:
  - Query Params: `id=...`
  - Restricts deletion of `SUPER_ADMIN` accounts.

---

### 5.3 Biometric Attendance (`/api/attendance`)

- **`GET /api/attendance`**:
  - Query Params: `employeeId` (optional), `month` (`YYYY-MM`), `companyId`.
  - Returns monthly punch logs, worked minutes, and overtime status.
- **`POST /api/attendance`**:
  - Handles punch in, punch out, and manual corrections.
  - Actions supported in body:
    - `action: "PUNCH_IN"`: Records current timestamp.
    - `action: "PUNCH_OUT"`: Completes daily session.
    - `action: "MANUAL_CORRECTION"`: Admin punch adjustment with audit reason.
    - `action: "CLEAR_MONTH_PUNCHES"`: Purges non-manual biometric records for target month before re-upload.

---

### 5.4 Leave Management (`/api/leaves`)

- **`GET /api/leaves`**:
  - Query Params: `employeeId` (optional), `quarter` (`Q1`–`Q4`), `year` (`2026`).
  - Returns leave applications and active leave balances.
- **`POST /api/leaves`**:
  - Submits a new leave request.
  - Validates: Overlapping date ranges, duplicate submissions, and available quota.
- **`PUT /api/leaves`**:
  - Updates leave approval status by Manager (`managerStatus`) or HR (`hrStatus`).
  - Final status resolves to `APPROVED` only when both required tiers approve.
- **`DELETE /api/leaves`**:
  - Query Params: `id=...`
  - Deletes or cancels a leave record.

---

### 5.5 WFH Time Tracking (`/api/time-tracking`)

- **`GET /api/time-tracking`**:
  - Returns active sessions, today's summary, and break statuses.
- **`POST /api/time-tracking`**:
  - Primary WFH control endpoint.
  - Actions:
    - `action: "CLOCK_IN"`: Initiates session.
    - `action: "START_BREAK"`: Starts `Tea Break` (15m) or `Lunch Break` (45m).
    - `action: "END_BREAK"`: Resumes work session.
    - `action: "CLOCK_OUT"`: Ends session and freezes live clocks.
    - `action: "SET_TRACKING"`: Toggles tracking opt-in for an employee.

---

### 5.6 Screenshot Monitoring (`/api/time-tracking/screenshots`)

- **`POST /api/time-tracking/screenshots`**:
  - Multipart upload (`multipart/form-data`) carrying screen capture image binary.
  - Stores high-resolution JPEG + scaled thumbnail in `data/screenshots/`.
  - Indexes metadata in `data/screenshots/index.json`.
- **`GET /api/time-tracking/screenshots`**:
  - Query Params: `employeeId`, `date` (`YYYY-MM-DD`).
  - Returns list of capture events with timestamps, resolution, and surface type (`monitor`).
- **`GET /api/time-tracking/screenshots/image`**:
  - Query Params: `employeeId`, `filename`, `thumb` (`1` or `0`).
  - Streams binary JPEG with caching headers.
- **`DELETE /api/time-tracking/screenshots`**:
  - Admin removal of specific screenshot captures.

---

### 5.7 Help, Complaints & Support (`/api/feedback`)

- **`GET /api/feedback`**:
  - Query Params: `employeeId` (optional for staff), `category`, `status`.
  - Returns complaint and support ticket register.
- **`POST /api/feedback`**:
  - Submits a ticket with optional screenshot attachment (up to 5 MB).
- **`PUT /api/feedback`**:
  - Admin status transition (`Pending` ➔ `In Review` ➔ `Resolved`) and reply dispatch.
- **`DELETE /api/feedback`**:
  - Removes ticket and unlinks attached image files on disk.

---

### 5.8 Multi-Company Workspaces (`/api/companies`)

- **`GET /api/companies`**: Returns all corporate entities with computed staff count and branch count.
- **`POST /api/companies`**: Onboards a new company with custom slug, shift target, and admin credentials.
- **`PUT /api/companies`**: Edits company policies, branding, or operational status.
- **`DELETE /api/companies`**: Deletes workspace (blocks deletion of default HQ or companies with active staff).

---

### 5.9 Company Branches (`/api/branches`)

- **`GET /api/branches`**: Lists all active branches (Main Branch, SEO Branch, etc.).
- **`POST /api/branches`**: Creates a branch with specific shift duration (8h vs. 9h) and weekly off rules.
- **`PUT /api/branches`**: Updates branch configuration.
- **`DELETE /api/branches`**: Removes branch (guarded against branches with assigned staff).

---

### 5.10 Administration & System (`/api/admin/save-db`, `/api/version`)

- **`POST /api/admin/save-db`**:
  - Restricts execution strictly to `SUPER_ADMIN` and `ADMIN`.
  - Flushes in-memory data, writes `data/db.json`, generates timestamped backup in `data/backups/`, and returns synced record counts.
- **`GET /api/version`**:
  - Returns server build timestamp (`buildTime`) and environment metadata for `VersionGuard`.

---

## 6. Role-Based Access Control (RBAC) & Security Architecture

### 6.1 Role Permission Matrix

| Capability / Resource | EMPLOYEE | MANAGER | ADMIN (HR) | SUPER_ADMIN |
| :--- | :---: | :---: | :---: | :---: |
| Access Employee Portal (`/employee`) | ✅ | ✅ | ✅ | ✅ |
| Punch In / Out (Biometric / Live Card) | ✅ (Self) | ✅ (Self) | ✅ (Self) | ✅ (Self) |
| WFH Time Tracker & Breaks | ✅ (Self) | ✅ (Self) | ✅ (Self) | ✅ (Self) |
| Apply for Leaves | ✅ (Self) | ✅ (Self) | ✅ (Self) | ✅ (Self) |
| Submit Support / Complaint Tickets | ✅ (Self) | ✅ (Self) | ✅ (Self) | ✅ (Self) |
| Change Own Password | ✅ | ✅ | ✅ | ✅ |
| Access Manager Desk (`/manager`) | ❌ | ✅ | ✅ | ✅ |
| Approve / Reject Team Leaves | ❌ | ✅ | ✅ | ✅ |
| View Team Attendance Matrix | ❌ | ✅ | ✅ | ✅ |
| Access HR Admin Suite (`/admin`) | ❌ | ❌ | ✅ | ✅ |
| View / Edit All Passwords | ❌ | ❌ | ✅ | ✅ |
| Import Biometric Attendance (Excel) | ❌ | ❌ | ✅ | ✅ |
| Manual Attendance Corrections | ❌ | ❌ | ✅ | ✅ |
| Manage Staff Directory & Onboarding | ❌ | ❌ | ✅ | ✅ |
| Manage Branches & Shift Matrix | ❌ | ❌ | ✅ | ✅ |
| View Live Board & Employee Screenshots | ❌ | ❌ | ✅ | ✅ |
| Respond to Support / Complaints Desk | ❌ | ❌ | ✅ | ✅ |
| 1-Click Database Save & Backup | ❌ | ❌ | ✅ | ✅ |
| Manage Companies (`/admin/companies`) | ❌ | ❌ | ❌ | ✅ |
| Switch Corporate Workspaces | ❌ | ❌ | ❌ | ✅ |

### 6.2 Edge Middleware Route Protection

Implemented in `src/middleware.ts`:
```typescript
// 1. Unauthenticated redirect to /login
if ((isProtectedAdmin || isProtectedManager || isProtectedEmployee) && !userRole) {
  return NextResponse.redirect(new URL(`/login?redirect=${pathname}`, request.url));
}

// 2. Multi-company tenant desk restricted to SUPER_ADMIN
if (pathname.startsWith('/admin/companies') && userRole !== 'SUPER_ADMIN') {
  return NextResponse.redirect(new URL('/admin', request.url));
}

// 3. Strict Admin protection
if (isProtectedAdmin && !(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN')) {
  return NextResponse.redirect(new URL(userRole === 'MANAGER' ? '/manager' : '/employee', request.url));
}
```

### 6.3 Device-Isolated Password Storage

- When users select **"Save password on this device"**, credentials are saved strictly into `localStorage['hrm_saved_device_login']`.
- Passwords are never sent across tabs or saved in shared database records.
- If another user accesses the login screen, they can choose **"Sign in with a different account"** without exposing the saved password.
- Clicking **"Forget this Device"** immediately clears the device storage.

---

## 7. Real-Time Synchronization & Optimistic UI Engine

To deliver a zero-latency desktop and mobile app experience, HRM Pilot integrates four synchronized real-time layers:

```mermaid
sequenceDiagram
    participant User as Employee Tab
    participant BC as BroadcastChannel (crm_time_tracker_sync)
    participant Admin as Admin Live Board
    participant API as Backend Route Handler
    participant DB as Supabase PostgreSQL

    User->>User: Click [ Clock Out ]
    User->>User: Optimistic UI: Set Status = 'OFF', Freeze Clock (0ms)
    User->>BC: Broadcast { type: 'CLOCK_OUT', employeeId, timestamp }
    BC->>Admin: Receive Broadcast within 0ms
    Admin->>Admin: Update Live Board: Badge = 'Clocked Out', Freeze Live Timer (0ms)
    User->>API: POST /api/time-tracking { action: 'CLOCK_OUT' }
    API->>API: Update In-Memory Store & write db.json (<15ms)
    API-->>User: HTTP 200 OK
    API-)DB: Background Async Prisma Upsert (Non-blocking)
```

1. **BroadcastChannel Engine**:
   - `new BroadcastChannel('crm_time_tracker_sync')` broadcasts clock-in, break start/end, and clock-out events across all browser tabs and windows in **0 milliseconds**.
2. **Window Event Dispatchers**:
   - `window.dispatchEvent(new CustomEvent('feedbackUpdated'))`
   - `window.dispatchEvent(new CustomEvent('leaveDataUpdated'))`
   - `window.dispatchEvent(new CustomEvent('attendanceUpdated'))`
   - Triggers instantaneous component re-renders across active tabs without page refreshes.
3. **Optimistic Updates with Rollback**:
   - Action toggles (such as updating ticket status in `FeedbackAdminTab.tsx` or clocking out in `TimeTracker.tsx`) immediately mutate React state before awaiting the network request, reverting safely if the server responds with an error.
4. **Adaptive Background Polling**:
   - Background polling runs silently (`isSilent=true`, no loading spinners) every 2.5s on the Admin Live Board and every 5s on feedback and leave tabs.
   - Listens to `document.addEventListener('visibilitychange')` to instantly sync state whenever the user returns to the tab.

---

## 8. WFH Time Tracking & Screen Monitoring Subsystem

The Work From Home (WFH) monitoring engine is engineered for rock-solid reliability, strict compliance, and minimal CPU/battery overhead.

### 8.1 Screen Capture Architecture

```mermaid
flowchart TD
    ClockIn[Employee Clicks Clock In] --> MediaReq[Call navigator.mediaDevices.getDisplayMedia]
    MediaReq --> Prompt[Browser Screen Share Dialog]
    Prompt --> CheckSurface{Is displaySurface == 'monitor'?}
    CheckSurface -->|No: window or browser tab| Terminate[Stop Stream & Display Error: Company policy requires Entire Screen]
    CheckSurface -->|Yes: Entire Screen| AttachDOM[Attach Hidden Video Element to DOM with autoplay & muted]
    AttachDOM --> StartSession[Session Started: Set Status = WORKING]
    StartSession --> ScheduleShot[Schedule Next Shot: Random interval between 5-7 mins]
    ScheduleShot --> GrabFrame[Canvas.drawImage from Video Element]
    GrabFrame --> Compress[Export JPEG blob at quality 0.7]
    Compress --> Upload[POST /api/time-tracking/screenshots]
    Upload --> Saved[Save to data/screenshots & update index.json]
    Saved --> ScheduleShot
```

### 8.2 Critical Implementation Safeguards

1. **Entire Screen Enforcement**:
   - Configuration passed: `{ video: { displaySurface: 'monitor' }, selfBrowserSurface: 'exclude', surfaceSwitching: 'exclude' }`.
   - Inspects `track.getSettings().displaySurface`. If the user selects a single window or tab, the stream is immediately terminated with `track.stop()`, and the clock-in is aborted with an explanatory notice.
2. **DOM-Attached Hidden Video Element**:
   - To prevent Chromium and Safari from suspending background video decoders (which causes `videoWidth = 0` when tabs are inactive), the video element is attached directly to the DOM:
     ```css
     position: fixed; z-index: -9999; opacity: 0; pointer-events: none;
     ```
3. **Safe Chrome "Hide" Bar**:
   - When employees click "Hide" on Chrome's native bottom bar, video frames continue decoding without interruption. If a frame capture experiences momentary track muting, capture immediately retries in 5 seconds without failing the session.
4. **Randomized Capture Intervals**:
   - Screenshots are captured unpredictably within a jitter window (default: `5 to 7 minutes`). Employees cannot predict or automate around screenshot timings.
5. **Duration Concealment**:
   - Exact interval countdowns and capture schedules are concealed from the employee portal, while remaining fully configurable by HR in the Admin suite.
6. **7-Day Retention Cleanup**:
   - Automated retention cleans up screenshots older than 7 days (168 hours) from disk and index.
   - Handled via `scripts/cleanup_screenshots.js` running on server startup and hourly via `instrumentation-node.ts`.

---

## 9. Biometric Attendance Ingestion & Calculation Engine

### 9.1 Biometric Name Matching Algorithm

Biometric hardware typically exports numeric IDs that shift between machines or re-enrollments. To guarantee 100% accuracy, HRM Pilot employs a **Strict Full-Name Matching Engine** with zero dependency on hardware ID numbers:

1. **Sanitization**: Names are lowercased and stripped of special characters and redundant whitespace.
2. **Exact Full Name Match**: Matches cleaned strings directly (e.g., `"anup sen"` ➔ `"Anup Sen"`).
3. **Levenshtein Distance Fuzzy Match**: Evaluates surname distance to accommodate spelling variations (e.g., `"ravina khemani"` ➔ `"Ravina Khimani"`).
4. **Disambiguated Single-Name Match**: Matches single-word names (e.g., `"Meenal"`) only if exactly one employee shares that name; ambiguous shared names (e.g., multiple employees named `"Charu"`) are strictly blocked from misallocation.

### 9.2 Daily Shift Targets & Overtime Calculation

- **8-Hour Daily Shift (Main Branch / HQ)**:
  - Daily gross target: 8 hours (480 minutes).
  - Break allowance: 1 hour (45m lunch + 15m tea).
  - **Net required working time**: **7 hours (420 minutes)**.
  - Weekly off: 1 day (Sunday).
- **9-Hour Daily Shift (SEO Branch)**:
  - Daily gross target: 9 hours (540 minutes).
  - Break allowance: 1 hour (45m lunch + 15m tea).
  - **Net required working time**: **8 hours (480 minutes)**.
  - Weekly off: 2 days (Saturday & Sunday).
- **Overtime Formula**:
  $$\text{Net Worked Minutes} = \text{Logged-in Minutes} - \text{Total Break Minutes}$$
  $$\text{Overtime Minutes} = \max(0, \text{Net Worked Minutes} - \text{Daily Required Minutes})$$
  $$\text{Short Minutes} = \max(0, \text{Daily Required Minutes} - \text{Net Worked Minutes})$$

---

## 10. DevOps, Deployment & CI/CD Pipeline

The production system is deployed on **Hostinger Node.js Web Hosting** utilizing Phusion Passenger, with automated CI/CD deployment via GitHub Actions.

### 10.1 Production Server Setup (`server.js`)

In production environments, Phusion Passenger passes a Unix domain socket path in `process.env.PORT`. `server.js` initializes Next.js bound to this socket:
- **Port Capture**: Captures `PORT` before `dotenv` can overwrite it with localhost defaults.
- **Universal CSS Fallback**: If an edge proxy or stale client requests a legacy CSS chunk hash (e.g., `2da7aa25cea25e6a.css`), `server.js` dynamically streams the active stylesheet with `HTTP 200 OK`, permanently preventing unstyled plain HTML.
- **Obsolete JS Chunk Auto-Reload**: Sends an immediate reload script to self-heal stale clients requesting deleted chunk hashes.

### 10.2 Automated GitHub Actions Deployment (`.github/workflows/deploy.yml`)

Pushes to the `main` branch trigger automated zero-downtime deployment:
1. **SSH Connection**: Authenticates securely via `appleboy/ssh-action` to Hostinger SSH (`88.222.247.3:65002`).
2. **Database Backup**: Backs up live server `data/db.json` to `/tmp/hrm_live_db_backup.json`.
3. **Repository Sync**: Executes `git fetch origin main` and `git reset --hard origin/main`.
4. **Database Restoration**: Restores `/tmp/hrm_live_db_backup.json` to ensure user passwords, punch logs, and leaves created on live are never overwritten by Git.
5. **Build & Migration**: Runs `npm install`, `npx prisma generate`, and builds production chunks.
6. **Cache Invalidation**: Triggers LiteSpeed cache purge (`X-LiteSpeed-Purge: *`) and touches `tmp/restart.txt` to trigger Phusion Passenger reload.

### 10.3 Required Environment Variables

```env
# Database Connections (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres.fzkwrphhjebngiinevrr:WZ1P9iwbtMrHz5sQ@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.fzkwrphhjebngiinevrr:WZ1P9iwbtMrHz5sQ@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

# Production Environment
NODE_ENV="production"
PORT=3000
```

---

## 11. Maintenance, Testing & Health Verification

### 11.1 Verification Test Checklist

To verify full system functionality across all layers:
```bash
# 1. Verify TypeScript compilation
npx tsc --noEmit

# 2. Verify Next.js production build
npm run build

# 3. Test Database Sync
npm run db:sync-hostinger

# 4. Verify Screenshot Cleanup Cron
node scripts/cleanup_screenshots.js
```

### 11.2 Emergency Recovery Procedures

1. **Restoring Database from Snapshot**:
   - All backups are located in `data/backups/`.
   - Copy the desired snapshot back to `data/db.json`:
     ```bash
     cp data/backups/db_backup_<timestamp>.json data/db.json
     ```
2. **Prisma Schema Drift**:
   - If Supabase PostgreSQL tables need synchronization:
     ```bash
     npx prisma db push
     ```
