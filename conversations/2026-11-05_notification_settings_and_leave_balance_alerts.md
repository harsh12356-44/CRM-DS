# Conversation Summary: Notification Settings & Real-Time Leave Balance Alerts

**Date**: 2026-11-05  
**Project**: CRM-DS (HRM Pilot Web App)  
**Requirement**:
"I want to turn on notification settings. example Admin and managers should receive message when leave applied. employees should receive leave balance after applying leave or whenever there s an update."

---

## 1. What Was Implemented

### A. Notification Settings Architecture (`src/lib/types.ts`, `src/lib/store.ts`)
- Defined `NotificationSettings` interface with defaults enabled:
  - `enabled: true` (Master notification switch)
  - `notifyAdminOnLeaveApply: true` (Notify HR / Admins when leave is applied)
  - `notifyManagerOnLeaveApply: true` (Notify Reporting Manager(s) when leave is applied)
  - `notifyEmployeeLeaveBalance: true` (Include current and projected leave balance to employee upon submission)
  - `notifyEmployeeOnStatusUpdate: true` (Send live recalculated leave balance upon status change)
- Auto-initialized in `DEFAULT_SETTINGS` and normalized in `getDbData()` ensuring settings are always active.

### B. Automated Leave Balance Calculation Engine (`src/lib/store.ts`)
- Created `getEmployeeLeaveBalanceDetails(employeeId, targetDateOrQuarter)`:
  - Calculates approved leaves used in the quarter (Casual, Planned/Sick).
  - Retrieves employee-specific allowances (Casual 2d, Planned 4d, Total 6d).
  - Calculates remaining quotas and detects excess leaves subject to Loss of Pay (LOP) deduction.
  - Formats clean summary text for instant notification embedding.

### C. Automated Admin & Manager Alerts (`src/app/api/leaves/route.ts`)
- **When Leave Applied (`POST /api/leaves`)**:
  - **Employee**: Receives submission confirmation with full remaining quarterly leave balance (Casual, Planned/Sick, Total Remaining) and an excess quota warning if applicable.
  - **Reporting Manager(s)**: Identifies applicant's primary and reporting managers (`primaryManager`, `secondaryManager`, `reportingManager`, department manager) and sends a notification with employee name, employee ID, department, leave type, dates, reason, and direct link to review in Manager Desk.
  - **HR / Admins**: Dispatches a notification to all Admin & Super Admin users with leave application details.
- **When Leave Status Updated (`PUT /api/leaves`)**:
  - **Employee**: Receives live updated status (Approved / Rejected / More Info) with recalculated leave balances.
  - **Manager & HR Cross-Sync**:
    - If Manager approves/rejects, an alert is sent to HR Admins for final review.
    - If HR approves/rejects, an alert is sent to the reporting manager keeping everyone synchronized.

### D. Settings Management Desk UI (`src/components/SettingsTab.tsx`)
- Added **Automated Notification Settings** section with interactive switches:
  - Master system notification toggle.
  - "Notify Admins & HR on Leave Application".
  - "Notify Reporting Managers on Leave Application".
  - "Send Leave Balance to Employees upon Application".
  - "Send Updated Leave Balance on Status Updates".

### E. Live Notifications Center & Navbar Bell (`src/app/employee/page.tsx`, `src/components/Navbar.tsx`, `src/app/api/notifications/route.ts`)
- Replaced mock notification items in the Employee Portal (`activeTab === 'notifications'`) with live dynamic alerts fetched from `/api/notifications?userId=...&role=...`.
- Supported multi-line formatted balances (`whitespace-pre-line`), new unread badges, individual "Mark Read", and "Mark all as read".
- Enhanced Navbar notification center popover tray with unread count badges and "Mark all read" capabilities.

---

## 2. Key Files Modified
1. `src/lib/types.ts`: Added `NotificationSettings` and extended `CompanySettings` and `NotificationItem`.
2. `src/lib/store.ts`: Added `DEFAULT_NOTIFICATION_SETTINGS`, default initialization in `getDbData()`, enhanced `addNotification()`, and `getEmployeeLeaveBalanceDetails()`.
3. `src/app/api/leaves/route.ts`: Updated `POST` and `PUT` handlers with automated multi-recipient notification dispatches and live leave balance calculations.
4. `src/app/api/notifications/route.ts`: Added query-based filtering by `userId` and `role`, plus `markAll: true` support.
5. `src/components/SettingsTab.tsx`: Added interactive Notification Settings UI with toggles.
6. `src/app/employee/page.tsx`: Connected employee notifications tab to real backend alerts with mark-as-read actions.
7. `src/components/Navbar.tsx`: Added user-filtered notification fetching and "Mark all read" button.

---

## 3. Verification
- Run `npx tsc --noEmit`: Exited with code 0 (zero TypeScript errors).
- All notification rules and leave balances verify cleanly against existing quotas and attendance records.



---

## 4. Follow-Up Fix (2026-11-18): HR Missing from Reporting Manager Dropdown
- **Issue**: HR (`Ravina Khimani`, `RK001`, HR / COO) was not appearing in the `Primary Reporting Manager (Manager 1)` or `Secondary Reporting Manager (Manager 2)` dropdowns because her runtime role is `SUPER_ADMIN` while the dropdown filter only checked `role === 'MANAGER' || role === 'ADMIN'` or designation containing `manager`.
- **Fixed**:
  - `src/components/EmployeesTab.tsx`: Included `SUPER_ADMIN`, HR designations (`hr`), and Human Resources department members in `managerList`.
  - `src/app/admin/managers/page.tsx`: Included `SUPER_ADMIN` and HR in the Managers Desk list.
  - `src/app/api/notifications/route.ts`: Included `SUPER_ADMIN` in `markAll` matching.
- **Verified**: `npx tsc --noEmit` exited with code 0.
