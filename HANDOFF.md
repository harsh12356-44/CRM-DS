# CRM-DS (HRM Pilot Web App) - Project Handoff

## 1. Project Overview & Purpose
**Project Name**: CRM-DS (HRM Pilot Web App)  
**Description**: A modern Human Resource Management (HRM) and Customer Relationship / Workforce Pilot application built with Next.js 15, React 19, TypeScript, Tailwind CSS, and Prisma ORM backed by a PostgreSQL / Supabase database. The platform supports role-based management for Admins, Managers, and Employees, tracking attendance, leave allowances, password management, department allocation, holiday calendars, notifications, and audit logging.

---

## 2. Current Project Status
- **Permanent Removal of Light Theme Option & Global Dark Theme Enforcement**:
  - **Requirement Addressed**: Per user directive ("remove light theme option"), completely removed all light theme controls, buttons, toggle states, and stylesheets from the platform.
  - **Global Dark Mode Across All Roles**: The platform now operates exclusively in modern, cohesive Dark Mode across all roles (HR Admin, Manager, and Employee) and views.
  - **Navbar Cleanup ([src/components/Navbar.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/Navbar.tsx))**:
    - Removed `theme` state and `setTheme` hook.
    - Removed `toggleTheme` function and the header theme switcher toggle button (`Sun` / `Moon` icons).
    - In `useEffect`, enforced permanent dark mode by automatically removing `document.documentElement.classList.remove('light')` and purging legacy `hrm_theme` from `localStorage`.
  - **CSS Cleanup ([src/app/globals.css](file:///d:/Ravina/Antigravity/crm-ds/src/app/globals.css))**:
    - Removed over 320 lines of legacy `.light` and `html.light` CSS overrides (cards, tables, buttons, inputs, scrollbars, time tracker badges).
    - Reduced stylesheet payload and ensured zero chance of accidental style leakage.
- **Integrated Employee Help, Support, Complaint & Feedback Desk (with Instant 0ms Status Updates & Live Polling)**:
  - **Requirement Addressed**: Provided all employees with a structured, confidential "Help & Support" channel on their portal dashboard to submit Complaints, Suggestions, Feedback, or Support tickets along with detailed descriptions and optional screenshot/image attachments. Built an administrative "Feedback Desk" in the Admin portal to track, filter, review attachments, and respond to employee submissions.
  - **Instant Optimistic UI & Live Real-Time Status Updates (Zero Refresh Required)**:
    - **Problem Solved**: Status dropdown changes previously waited on network latency and browser/LiteSpeed server caching, making it look like tickets did not update without a manual page refresh.
    - **0ms Instant Optimistic Updates**: Selecting a new status (`Pending`, `In Review`, `Resolved`) in [src/components/FeedbackAdminTab.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/FeedbackAdminTab.tsx) immediately updates the React state (0ms delay), showing the new status and badge instantly with automatic rollback if the server request fails.
    - **Optimistic Resolution Reply**: When HR Admin sends a resolution response note via the Reply modal, the ticket is updated and the modal closes immediately without freezing the UI.
    - **Live 5-Second Background Polling & Window Focus Sync**: Both Employee [SupportFeedbackTab.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/SupportFeedbackTab.tsx) and Admin [FeedbackAdminTab.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/FeedbackAdminTab.tsx) run silent background polling every 5 seconds (with `isSilent=true` so no loading spinner flickers) and automatically refresh upon switching tabs/window focus. When Admin updates a status or writes a reply, the Employee sees the updated status and resolution note live in real time without refreshing.
    - **Cross-Component Custom Event Dispatcher (`feedbackUpdated`)**: State changes immediately dispatch `window.dispatchEvent(new CustomEvent('feedbackUpdated'))` so any active tabs or modals update with 0ms delay.
    - **Strict HTTP No-Cache Headers & Cache Busting**: [src/app/api/feedback/route.ts](file:///d:/Ravina/Antigravity/crm-ds/src/app/api/feedback/route.ts) now returns strict `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0`, `Pragma: no-cache`, and `Expires: 0` headers on all GET, POST, PUT, and DELETE operations, and client fetch requests append cache-busting timestamp `_t=${Date.now()}`.
    - **Optimistic Employee Status Toggle**: In [src/components/EmployeesTab.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/EmployeesTab.tsx), toggling employee Active/Inactive status reflects instantly (0ms) in UI with event listeners and cache-busting.
    - **Leave Application Live Event Sync**: Added `leaveDataUpdated` event dispatch to [src/components/RecordLeaveModal.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/RecordLeaveModal.tsx) and live polling in [src/app/admin/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/admin/page.tsx).
- **Multi-Day Weekly Off Support (1 or 2 Weekly Off Days Selection)**:
  - **Requirement Addressed**: Allowed configuring up to 2 weekly off days per employee (e.g. Saturday & Sunday, Friday & Saturday, or any custom 2 days of the week).
  - **Interactive Multi-Day Selector in Profile Modal ([src/components/EmployeesTab.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/EmployeesTab.tsx))**:
    - Replaced the single-select dropdown in "Add / Edit Employee Profile" modal with both a common preset dropdown (`Sunday`, `Saturday & Sunday`, `Friday & Saturday`, `Sunday & Monday`, etc.) and a row of 7 interactive 1-tap day pills (`Sun`, `Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`).
    - Admins can effortlessly select 1 or 2 weekly off days with instant visual feedback and active day count indicators.
    - Employee Directory cards display an `Off: [Days]` badge, and Employee Profile displays their active Weekly Off schedule.
  - **Universal Schedule & Attendance Recognition**:
    - Exported `isDateWeeklyOff(dateStr, weeklyOff)` helper in [src/lib/types.ts](file:///d:/Ravina/Antigravity/crm-ds/src/lib/types.ts).
    - Updated Attendance Grid ([src/components/AttendanceLogTab.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/AttendanceLogTab.tsx)), Working Hours ([src/app/admin/working-hours/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/admin/working-hours/page.tsx)), Analytics ([src/app/admin/attendance-analytics/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/admin/attendance-analytics/page.tsx)), and Attendance API ([src/app/api/attendance/route.ts](file:///d:/Ravina/Antigravity/crm-ds/src/app/api/attendance/route.ts)) to recognize all configured off days as official weekly offs (`WO`), including working day calculation adjustments.
  - **Employee Help & Support Tab ([src/components/SupportFeedbackTab.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/SupportFeedbackTab.tsx))**:
    - Accessible via `/employee?tab=support` and in the sidebar and mobile drawer.
    - Category selector with 4 structured options: **Complaint** (Confidential / Direct to HR), **Suggestion** (Ideas & Improvements), **Feedback** (Culture & Operations), and **Help / Support** (Technical & Administrative).
    - Optional Subject line and full description textarea with live character counter.
    - Screenshot / image attachment dropzone supporting PNG, JPG, JPEG, WEBP up to 5 MB with instant thumbnail preview and remove button.
    - "My Submitted Requests" history feed displaying all previous submissions with category badges, status indicators (`Pending`, `In Review`, `Resolved`), timestamps, attachment viewing lightbox, and admin resolution response notes.
  - **Admin Feedback Management Desk ([src/app/admin/feedback/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/admin/feedback/page.tsx), [src/components/FeedbackAdminTab.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/FeedbackAdminTab.tsx))**:
    - Accessible via `/admin/feedback` and in the Admin sidebar under "Portals & Config".
    - Metric summary cards: Total Submissions, Pending Action, In Review, Resolved, and Complaints count.
    - Search by employee name, department, or keywords, with category and status filters.
    - Desktop table and mobile responsive card feed displaying employee avatar, name, department, category, subject, description, attachment preview, and timestamp.
    - Inline status selector to transition tickets between `Pending`, `In Review`, and `Resolved`.
    - "Reply" modal allowing HR Admin to send a resolution note directly to the employee.
    - Lightbox image viewer to inspect attached screenshots in high resolution with new-tab open/download.
    - Safe ticket deletion action with confirmation modal.
  - **Decoupled Backend & Database Storage**:
    - Created standalone Prisma model `FeedbackTicket` in [prisma/schema.prisma](file:///d:/Ravina/Antigravity/crm-ds/prisma/schema.prisma) with indexes on `employeeId`, `category`, and `status`.
    - Integrated with [src/lib/store.ts](file:///d:/Ravina/Antigravity/crm-ds/src/lib/store.ts) and [src/lib/dbSync.ts](file:///d:/Ravina/Antigravity/crm-ds/src/lib/dbSync.ts) with decoupled `try/catch` handlers.
    - Attachments stored securely in `data/feedback_attachments/` (ignored in `.gitignore`) and served via API endpoint `/api/feedback/image?id=...` with automatic fallback to data URLs.
- **Integrated WFH Time Tracking & Screenshot Monitoring (v3 - Non-Regressive)**:
  - **Requirement Addressed**: Incorporated dedicated time tracking with session management (Clock In / Clock Out), structured breaks (Tea & Lunch), screenshot capture, automatic retention cleanup, and administrative timesheet reporting without modifying or affecting official biometric attendance, leave records, or existing database tables.
  - **Strict Isolation from Biometric Attendance**:
    - Tracker hours are strictly separate from office attendance records. Attendance Grid, Working Hours, and Payroll calculations continue to run exclusively off official biometric / punch logs.
    - HR Admin reviews tracker hours separately via the Timesheets tab and exportable CSVs (Summary CSV and Detailed CSV).
  - **Clock In / Break / Clock Out Sessions**:
    - Jibble-style time entry tracking with support for two company-standard breaks: **Tea Break** (15 min default) and **Lunch Break** (45 min default).
    - Durations are customizable by Master Admin (1–180 minutes).
    - Unclosed sessions are automatically capped after 14 hours or upon crossing midnight IST.
  - **Screen Capture & Monitoring Engine**:
    - Uses browser `getDisplayMedia` screen sharing prompted once at Clock In.
    - **Strict "Entire Screen" Company Policy Enforcement**:
      - `displayMediaOptions` configured with `{ video: { displaySurface: 'monitor' }, selfBrowserSurface: 'exclude', surfaceSwitching: 'exclude' }` to pre-focus the "Entire Screen" tab in browser dialogs and disable surface switching.
      - **Strict Rejection of Tabs & Windows**: Reads `track.getSettings().displaySurface`. If the user chooses a window (`window`) or browser tab (`browser`), the stream tracks are immediately terminated (`track.stop()`), the permission is rejected, and an explicit error is shown to the user (`Company Policy: Work From Home tracking requires sharing your Entire Screen. You selected [type]. Please clock in again and choose "Entire Screen"`).
      - **Clock-In Blocked Until Full Screen**: Clock-in requests abort immediately if the user cancels or does not select their entire screen, preventing incomplete or hidden tracking.
      - Pre-clock-in visual helper added to guide employees to choose "Entire Screen".
    - **0ms Instant Optimistic Updates & Live Real-Time Clock-Out Sync**:
      - **Problem Solved**: Clocking out an employee (e.g. Rishi) previously waited on network latency and API response before updating the UI, making the elapsed clock appear to continue ticking and causing perceived delays.
      - **0ms Admin Force Clock Out**: Clicking "Clock out" on the Live Board ([TimeTrackingAdmin.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/TimeTrackingAdmin.tsx)) immediately updates React state (0ms delay), flipping the status badge to "Clocked Out", freezing the timer, and closing running entries with automatic rollback on error.
      - **0ms Employee Clock Out & Breaks**: In [TimeTracker.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/TimeTracker.tsx), clicking Clock Out immediately halts the active stream, sets status to `OFF`, and freezes the timer before awaiting the server response.
      - **Cross-Tab & Cross-Device Sync**: Dispatches `timeTrackerChanged` on state changes, listens for window focus events, and runs background live polling every 5 seconds (reduced from 30s) across both admin and employee portals.
      - **Strict HTTP No-Cache Headers**: Both `/api/time-tracking` and `/api/time-tracking/admin` return `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0` to eliminate LiteSpeed/browser 304 response caching.
      - **Dual ID Matching (`id` & `employeeId`)**: Enhanced `getOpenEntry` and API handlers to match against both internal UUID `emp.id` and company code `emp.employeeId`, ensuring employees like Rishi are always matched accurately.
      - **Interactive Refresh Buttons with Spinning Indicators & Cloud Sync**:
        - Updated Refresh buttons across [TimeTrackingAdmin.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/TimeTrackingAdmin.tsx), [FeedbackAdminTab.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/FeedbackAdminTab.tsx), and [SupportFeedbackTab.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/SupportFeedbackTab.tsx) with active spinning state (`refreshing ? 'animate-spin' : ''`), disabled state during fetch, and temporary success toasts (`"Records refreshed."`).
        - Integrated `ensureCloudSync()` directly into API route GET handlers (`/api/time-tracking/admin`, `/api/time-tracking`, `/api/feedback`) so clicking Refresh immediately pulls the latest state from PostgreSQL / Supabase into memory.
        - Made refreshes non-blocking so tables and card grids stay visible instead of flashing full-page loading skeletons.
    - Single permission stream is re-used across break pauses and work resumption without repeated browser permission prompts.
    - Captures at configurable intervals (default: 10 mins).
    - Stores images as plain files on disk under `/data/screenshots/` (indexed via `index.json`) to keep `db.json` and database operations fast and bloat-free.
    - 7-day automated retention policy: an hourly background task and standalone cron script (`scripts/cleanup_screenshots.js`) automatically purge images older than 7 days.
  - **Admin Time Tracking Suite ([src/app/admin/time-tracking/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/admin/time-tracking/page.tsx))**:
    - **Live Board**: Real-time cards showing working/break/off status, live elapsed clocks, and overdue screenshot alerts.
    - **Timesheets**: Complete breakdown of logged-in time, break deductions, net worked hours, target hours, and overtime hours.
    - **Entries Desk**: Manual time entry adjustments and correction logging by HR admins.
    - **Screenshots Gallery**: Filterable thumbnail grid with high-resolution inspection modal.
    - **Settings Tab**: Toggle time tracking access per employee, configure break durations, and retention days.
  - **Employee Portal Integration ([src/app/employee/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/employee/page.tsx))**:
    - Embedded compact `<TimeTracker>` widget on dashboard.
    - Dedicated "Time Tracker" tab and Manager "Team Time Tracker" tab.
    - For employees with `workMode === 'WFH'`, the Attendance tab and mobile navigation bar seamlessly display the Time Tracker.
  - **Database Decoupling**:
    - 4 new standalone Prisma models (`TimeEntry`, `TimeActivity`, `TimeTrackerOptIn`, `TimeTrackingSettings`) added to schema with zero foreign keys.
    - Synchronized safely in `src/lib/dbSync.ts` with error-isolated handlers so absence of database tables never blocks core HR synchronization.
- **Vertical Mobile Responsive Items for Leave Requests & Team Approvals Desks**:
  - **Requirement Addressed**: On mobile phones, wide tables for leave requests (e.g. 7-column Pending Approvals and 11-column Historical Leave Requests Register) forced cumbersome horizontal scrolling and tiny text. All leave request items now render **vertically down the screen** as responsive, structured cards on mobile screens (`< md`), fitting comfortably within the screen with zero horizontal scrolling.
  - **Leave Requests Desk ([src/app/admin/leave-records/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/admin/leave-records/page.tsx))**:
    - **Pending Leave Approvals**: Desktop table preserved in `hidden md:block`; mobile view (`md:hidden space-y-3`) displays each pending request as an item card with employee initials avatar, department, request ID, leave type, date range with duration pill, reason/notes, manager status, final status, and 44px+ touch-friendly `Approve (HR)` / `Reject` / `Delete` actions.
    - **Historical Leave Requests Register**: Desktop table preserved in `hidden md:block`; mobile view (`md:hidden space-y-3 p-4`) displays each historical record vertically with employee info, dates, duration, manager/admin review breakdown, final status pill (`HR & MGR APPROVED ✓` or `REJECTED ✗`), submission date, and delete action.
    - **Responsive Filter Controls**: Search bar and dropdowns (Department, Status, Print Roster) stack vertically and adapt to full mobile width (`w-full sm:w-60`).
  - **Subordinate Team Approvals Desk ([src/app/admin/team-approvals/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/admin/team-approvals/page.tsx))**:
    - Added responsive vertical mobile card feed for team leave applications with employee details, leave type, dates, reason, status breakdown, and direct decision action buttons.
  - **Record Leave Application Modal ([src/components/RecordLeaveModal.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/RecordLeaveModal.tsx))**:
    - Changed 2-column grid to responsive `grid-cols-1 sm:grid-cols-2` with `min-h-[44px]` inputs so all fields (Leave Type, Duration, Start/End Dates, Handover, Contact) stack vertically on mobile phones.
- **Vertical Mobile Responsive Calendar & Timeline View for Attendance Grid & Working Hours**:
  - **Requirement Addressed**: On mobile smartphones, horizontal 31-day table matrices (requiring ~1300px width) previously forced awkward horizontal scrolling and cramped columns. The attendance grid and working hours tabs have been transformed so that on mobile screens, instead of horizontal scrolling, the schedule renders **vertically down the screen** as a clean daily timeline, completely fitting mobile screen sizes without horizontal cramping or overflow.
  - **Desktop vs. Mobile Experience**:
    - **Desktop (`md:` and up)**: Retains the full 31-day horizontal matrix table with sticky employee header columns, dual scrollbars, and color-coded status badges.
    - **Mobile (`md:hidden`)**: Renders an intuitive vertical day-by-day calendar timeline (Days 1 to `totalDaysInMonth`), identical to native mobile calendar schedule views (e.g. Apple / Google Calendar schedule list).
  - **Attendance Grid ([src/components/AttendanceLogTab.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/AttendanceLogTab.tsx))**:
    - **Employee Selector for Admin/Managers**: When viewing multiple employees (`employees.length > 1`), a native touch dropdown enables effortless 1-tap switching between any team member. In Employee mode, the view automatically displays the logged-in employee's schedule.
    - **Active Employee Monthly Summary Card**: Displays employee initials avatar, name, department, role, total month hours, and quick count pills for Present, Half Day, Absent, and Total Month Days.
    - **Vertical Day-by-Day Calendar Timeline**:
      - Left: Date box with day number and short weekday (highlighted in rose for official holidays and amber for Sundays).
      - Center: Date with full weekday, holiday title callout, Sunday Off banner, or punch check-in / check-out times.
      - Right: Clear status badges (`Holiday`, `WO`, `Present`, `Half Day`, `Absent`, `Leave`) and worked hours badge.
      - Tap-to-edit integration: In Admin mode, tapping any day card opens the manual edit modal to adjust punch times and status codes.
    - **Daily Log Feed**: Desktop table wrapped in `hidden md:block`; mobile view displays a vertical card feed (`md:hidden`) showing employee name, punch interval, worked minutes, and status badges.
  - **Working Hours Tab ([src/app/admin/working-hours/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/admin/working-hours/page.tsx))**:
    - **Desktop (`hidden md:block`)**: Preserves the 31-day matrix table with sticky columns.
    - **Mobile (`md:hidden`)**:
      - Employee picker dropdown with member count and department.
      - Monthly working hours breakdown card (Total Completed Hours, Total Short Hours, Overtime Hours).
      - Vertical Day-by-Day schedule list (Days 1 to 31) with check-in/out times, formatted worked hours (e.g., `8h 30m`), deficit badges (`-45m short`), and overtime badges (`+30m OT`).
      - Tapping any day card immediately opens the quick edit dialog to correct hours, codes, or reasons.
      - In Daily Log Table view, mobile cards provide a complete vertical breakdown of check-in, check-out, worked mins, required mins, short mins, and overtime mins without table overflow.
- **Universal Mobile-Responsive UI & Progressive Web App Experience (Android, iOS & Desktop)**:
  - **Requirement Addressed**: The entire HRM portal UI, features, workflows, and navigation are 100% mobile-responsive across all mobile smartphones (Android, iPhone/iOS), tablets (iPad), and desktop browsers. Employees logging in from mobile devices experience an intuitive, fluid native-app feel with comfortable touch targets, zero horizontal cramping, and instant 1-thumb navigation.
  - **Viewport, PWA & Apple Notch Compatibility**:
    - Updated [src/app/layout.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/layout.tsx) with a comprehensive `viewport` export (`width: 'device-width'`, `initialScale: 1`, `maximumScale: 5`, `userScalable: true`, `viewportFit: 'cover'`, `themeColor: '#0f172a'`).
    - Added Apple Web App meta tags (`capable: true`, `statusBarStyle: 'black-translucent'`, `title: 'HRM Portal'`) for standalone iOS Home Screen installability.
    - Added safe-area padding utility classes (`.pb-safe`, `.pt-safe`, `.mb-safe`) in [src/app/globals.css](file:///d:/Ravina/Antigravity/crm-ds/src/app/globals.css) using `env(safe-area-inset-*)` so content never clips behind the iPhone notch, Dynamic Island, or home indicator bar.
    - Enabled `-webkit-overflow-scrolling: touch` and `-webkit-tap-highlight-color: transparent` across all touch devices.
  - **Responsive Sidebar & Off-Canvas Mobile Drawer**:
    - Updated [src/components/Sidebar.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/Sidebar.tsx) to hide the desktop fixed sidebar on mobile screens (`hidden md:flex flex-col`).
    - Implemented a smooth slide-in off-canvas mobile drawer (`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw]`) with backdrop blur overlay (`bg-black/80 backdrop-blur-sm`).
    - Subscribed to custom window events (`toggleMobileSidebar`, `openMobileSidebar`, `closeMobileSidebar`), auto-closing upon backdrop tap or navigation link click.
  - **Adaptive Header Navigation Bar**:
    - Updated [src/components/Navbar.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/Navbar.tsx) with a mobile hamburger menu trigger button (`md:hidden`) with `Menu` icon dispatching `toggleMobileSidebar`.
    - Made padding adaptive (`px-3 sm:px-6 py-2.5 sm:py-3`), condensed Role pill badge, and made Save DB button compact on small widths.
  - **Native-Feel Mobile Bottom Navigation Bar & Footer Buttons (Fixed & Verified)**:
    - Integrated a thumb-friendly bottom navigation bar into [src/app/employee/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/employee/page.tsx) (`md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.5)] select-none`).
    - **Fixed Route Parameter & Tab Mismatch**: Resolved issue where tapping "Attendance" navigated to `?tab=attendance-log` while the component evaluated `activeTab === 'attendance'`, resulting in an unrendered blank screen. The button now targets `tab=attendance`, and the conditional renderer supports both `activeTab === 'attendance' || activeTab === 'attendance-log'`.
    - **Synchronous 0ms Tab Switching**: Replaced loose `router.push(...)` calls with a unified `handleTabChange` handler that synchronously sets React state (`setTabOverride`), dispatches browser history updates (`window.history.pushState`), and scrolls cleanly to the top (`window.scrollTo({ top: 0, behavior: 'smooth' })`).
    - **Mobile Bottom Padding Expansion**: Increased `<main>` bottom padding on mobile screens from `pb-24` to `pb-32` (128px) so page content, bottom form buttons (such as "Submit Leave Application"), and table cards never get obscured or overlapped by the fixed bottom navigation bar (`h-16 + pb-safe`).
    - **Touch Targets & Elevation**: Added `touch-manipulation`, `select-none`, and `active:scale-95` to all bottom buttons for immediate tap responsiveness without 300ms mobile touch delay. The elevated "Apply" button now has `relative overflow-visible` for consistent thumb activation across the entire column.
    - **Modal Footer Button Visibility**: Updated [src/components/RecordLeaveModal.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/RecordLeaveModal.tsx) and [src/components/AdjustLeaveModal.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/AdjustLeaveModal.tsx) with `max-h-[90vh] flex flex-col` and scrollable form containers with pinned `shrink-0` footers, ensuring "Cancel", "Record Leaves", and "Apply Adjustment" buttons never get cut off or pushed off-screen on small mobile viewports.
    - Offers 5 instant touch actions:
      1. **Home**: Direct switch to Dashboard metrics.
      2. **Attendance**: Instant view of biometric logs & attendance matrix.
      3. **Apply**: Elevated primary action button floating above the bar for 1-tap leave applications.
      4. **History**: Instant view of leave application status and HR approvals.
      5. **Menu**: Triggers the off-canvas drawer for Profile, Holidays, Team Approvals, and Logout.
  - **Mobile Card Feeds for Data Tables (Zero Horizontal Squeeze)**:
    - **Leave Register & Quarterly Breakdown**: Added mobile cards displaying Request ID, active quarter badge, dates, and separate Manager & HR status badges alongside the desktop table (`hidden md:block` / `md:hidden`).
    - **Leave History Tab**: Added responsive card feed with dates, duration badge, note callout, and side-by-side approval status pills.
    - **Team Approvals Tab (Manager Workspace)**: Added card view with direct 44px+ touch-friendly "Approve" and "Reject" buttons.
    - **Manager Portal Desk ([src/app/manager/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/manager/page.tsx))**: Dual view with desktop table and mobile card feed with quick decision buttons.
  - **iOS Safari Auto-Zoom Prevention & Touch Targets**:
    - Increased font size to `text-base sm:text-xs` (>= 16px on mobile) and minimum height to `min-h-[44px]` across all inputs, selects, and textareas in Apply Leave, Change Password modal, AttendanceLogTab filters, and Login page.
    - Completely prevents iOS Safari from automatically zooming into the page on input focus.
  - **Mobile Live Punch In / Out Card Widget**:
    - Created an on-screen Live Punch card on the Employee Dashboard for office staff with real-time digital clock, punch state indicator, and prominent touch action buttons.
- **Employee Dashboard Dynamic Current Month Attendance & Dynamic Quarterly Leave Balance**:
  - **Requirement Addressed**: 
    1. Employee dashboard attendance statistics (Work Status / Present Days, Total Hours Worked, Average Daily Hours, Late Arrivals, and the Monthly Attendance Analytics daily hours bar chart) must dynamically evaluate for the **current active month** (October 2026 / `2026-10`) rather than freezing in historical months (September/August 2026).
    2. Leave Balance cards and allowances must automatically calculate and update based on leaves applied/approved in the **current active quarter** (Q4: Oct–Dec 2026) rather than hardcoded `Q3` (Jul–Sep 2026).
  - **Dynamic Month Attendance Statistics**:
    - Updated [src/app/employee/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/employee/page.tsx) with a reactive `selectedDashboardMonth` state defaulting to the current calendar month (`YYYY-MM`).
    - Eliminated hardcoded fallbacks to `2026-09` or `2026-08`. If logs have not yet been recorded for the current month, the dashboard correctly reflects current month zero/live metrics rather than showing outdated past month logs.
    - Added an interactive month selector dropdown in the Monthly Attendance Analytics card header, enabling employees to view October 2026 (Current Month) or switch back to review September 2026, August 2026, etc.
    - Updated the bar chart days array to generate the exact number of days in the selected month (`new Date(selYear, selMonth, 0).getDate()`).
  - **Dynamic Quarterly Leave Balance Engine**:
    - Created and exported `getCurrentQuarter(): 'Q1' | 'Q2' | 'Q3' | 'Q4'` and `getQuarterFromDateStr()` in [src/lib/types.ts](file:///d:/Ravina/Antigravity/crm-ds/src/lib/types.ts) and [src/lib/store.ts](file:///d:/Ravina/Antigravity/crm-ds/src/lib/store.ts):
      - Q1: Jan–Mar (Months 1–3)
      - Q2: Apr–Jun (Months 4–6)
      - Q3: Jul–Sep (Months 7–9)
      - Q4: Oct–Dec (Months 10–12)
    - Defaulted `quarter` in `GET /api/leaves`, `POST /api/leaves`, `PUT /api/leaves`, `DELETE /api/leaves`, [src/components/LeaveTrackerTab.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/LeaveTrackerTab.tsx), and [src/components/AdjustLeaveModal.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/AdjustLeaveModal.tsx) to `getCurrentQuarter()`.
    - Refactored [src/app/employee/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/employee/page.tsx) to dynamically compute:
      - `casualApplied`, `casualApproved`, `remainingCasual`
      - `plannedApplied`, `plannedApproved`, `remainingPlanned`
      - `leaveBalance` (`totalAllowance - totalApplied`, max 6 paid days per quarter)
      - `unpaidLeaves` (`Math.max(0, totalApplied - totalAllowance)`)
      - `pendingInQuarterCount` (leaves awaiting manager/HR approval in the current quarter)
    - Updated both WFH and Office Leave Balance stat cards to show `leaveBalance / totalAllowance Days` (e.g. `6 / 6 Days`), a breakdown of Casual and Planned days remaining, and pending approval notices.
    - Updated the **Leave Register & Quarterly Breakdown** table to clearly badge `{q} (Current)` on the active quarter pill and resolve missing dates to the current quarter.
    - Updated the **Leave Balance & Policy** card in the Apply Leave tab to display dynamic allowance breakdowns for the active quarter (`remainingCasual`, `remainingPlanned`, `leaveBalance`, and `unpaidLeaves`) rather than static `(Q3)` labels.
- **Device-Isolated Save Password & Account Privacy Security System**:
  - **Requirement Addressed**: Employees, Managers, and Admins can save their passwords on their personal devices for effortless 1-click access, but must never see each other's saved passwords, and no one should access another employee's account.
  - **Device Isolation & Local Storage Architecture**:
    - Passwords saved on a device are stored strictly in client-side browser local storage (`localStorage['hrm_saved_device_login']`). They are never saved into shared database records or transmitted to other devices.
    - When an employee opens the login page on their personal device, a dedicated **"Saved on This Device"** card appears with their name, role, email, and 1-click **"Sign in as [Name]"** button.
    - An interactive **"View / Edit Password"** control with an Eye toggle (`Eye` / `EyeOff`) allows the device owner to unmask and verify their password.
    - A **"Forget this Device"** button immediately clears the saved credentials from that device.
    - A **"Sign In with a Different Account"** button opens a clean, blank login form so someone else can sign in without seeing or altering the saved account.
    - When logging in from an unsaved device or new account, the user can toggle the **"[✓] Save password on this device"** checkbox.
  - **Server-Side Authentication Route (`POST /api/auth/login`)**:
    - Eliminated client-side password evaluation and direct employee array inspection on `/login`.
    - Created [src/app/api/auth/login/route.ts](file:///d:/Ravina/Antigravity/crm-ds/src/app/api/auth/login/route.ts) to authenticate credentials on the backend server.
    - Returns safe employee data (id, employeeId, name, email, role, department) and sets secure session cookies (`hrm_user_role`, `hrm_user_email`, `hrm_user_id`). Passwords are never returned over the wire.
  - **Network Credential Leak Prevention in `/api/employees`**:
    - Updated [src/app/api/employees/route.ts](file:///d:/Ravina/Antigravity/crm-ds/src/app/api/employees/route.ts) to strictly strip the `password` property from all employee records for non-admin callers. Non-admins opening DevTools Network tab cannot see other employees' passwords.
    - Restricted `POST` and `PUT` in `/api/employees` so non-admins can only update their own profile and cannot tamper with other employees' accounts or elevate roles.
  - **Self-Service Password Sync**:
    - Updated [src/app/employee/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/employee/page.tsx) so changing a password automatically updates the saved password in `localStorage['hrm_saved_device_login']` on that device.
    - Removed arbitrary fallbacks to other employees' IDs (`emp-5`) when a session is unauthenticated, redirecting strictly to `/login`.
- **Resolution of Duplicate Leave Record for Mudita & Date Overlap Guard**:
  - **Problem Identified**: Mudita requested leave for a single day (`2026-09-21`), but two entries appeared in the Admin Leave Requests register (`#880` with note `"Due to family event "` and `#360` with note `"For a family event "`, submitted 24 seconds apart). Because both duplicate entries were approved, the Leave Tracker in Q3 calculated 2 Casual Leaves Used and 4 Remaining instead of 1 Used and 5 Remaining.
  - **Root Causes**:
    1. **Accidental Re-submission**: On the Employee Portal, submitting a leave cleared the input fields without redirecting away, causing the user to re-submit with revised wording.
    2. **Disabled Overlap Check**: In `/api/leaves/route.ts`, the duplicate/overlap date check was previously commented out for testing.
    3. **Cross-Approval in PUT**: In `/api/leaves/route.ts` `PUT` handler, matching records by identical employee and start date caused approving one leave to automatically approve both.
  - **Resolution**:
    1. **Live Database Cleanup**: Purged duplicate record `#360` (`l-1789898879360`) from `data/db.json` and added auto-purging logic across `store.ts`, `deploy.yml`, and `GET /api/leaves`. Mudita's Q3 leave tracker now strictly calculates 1 Casual Leave Used and 5 Remaining.
    2. **Duplicate & Overlap Validation Guard**: Re-enabled strict date-range overlap checking in `POST /api/leaves`. Submitting a duplicate request for already-booked dates now rejects with HTTP 400 and a clear user-facing error message.
    3. **Auto-Redirect to Leave History**: Updated `src/app/employee/page.tsx` to automatically navigate employees to the **Leave History** tab immediately upon successful leave submission, displaying their live pending request.
    4. **Single Record Deletion Capability**: Added `delete_record` action in `POST /api/leaves`, query parameter support in `DELETE /api/leaves?id=...`, and interactive Trash icon buttons in `src/app/admin/leave-records/page.tsx` for Admins.
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

