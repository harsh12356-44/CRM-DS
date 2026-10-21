# Conversation Summary: Employee Account Isolation & Cross-Account Access Prevention

**Date**: October 21, 2026  
**User Request**:
> "Each employee should be able to access their own account. for example if its an employee he or she should see their own account and not any other employee or managers account."

---

## 1. Problem Identification & Root Causes
1. **Top Bar Account View Dropdown on `/employee`**:
   - In [src/app/employee/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/employee/page.tsx), a `<select>` dropdown (`Active Employee View:`) allowed any user visiting `/employee` whose browser had retained admin cookies/state to switch their active viewing profile to any employee or manager in the company.
2. **Hardcoded Fallbacks to Other Users**:
   - In [src/app/employee/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/employee/page.tsx):
     - `selectedEmployeeId` was initialized to `'emp-12'` (Sonu Goswami).
     - Punch clock fell back to `'emp-2'` (Naman Bangia - Manager).
     - Leave applications fell back to `'emp-12'` (Sonu Goswami).
     - Profile managers fell back to `'Ravina Khimani'` if unassigned.
   - In [src/components/Navbar.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/Navbar.tsx):
     - `activeUser` was hardcoded to `Ravina Khimani (RK001)` on initial render, causing employees and managers to see Ravina Khimani in their navbar before fetching was complete.
     - Unmatched users fell back to `employeesList[0]` (Ravina Khimani).
   - In [src/components/Sidebar.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/Sidebar.tsx):
     - `empCodeDisplay` was initialized to `'NB002'` (Naman Bangia - Manager).
   - In [src/components/AttendanceLogTab.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/AttendanceLogTab.tsx):
     - If the target employee was not matched, it fell back to `empsList[0]` (Ravina Khimani).
   - In [src/app/api/leaves/route.ts](file:///d:/Ravina/Antigravity/crm-ds/src/app/api/leaves/route.ts):
     - Regular leave submission defaulted missing `employeeId` to `'emp-12'` and unverified employee to `db.employees[0]`.
3. **Loose Name & Email Prefix Matching**:
   - In [src/app/api/auth/login/route.ts](file:///d:/Ravina/Antigravity/crm-ds/src/app/api/auth/login/route.ts) and client data fetching, loose checks like `identifier.includes(eName)` and `e.email.startsWith(identifier)` allowed accounts to be confused.
4. **Manager Workspace Tab Exposure in Employee Portal**:
   - Tabs `team-approvals` and `team-time` were accessible or leaked if `isManager` evaluated loosely.

---

## 2. Changes Made
1. **Strict Exact Matching in Auth Login ([src/app/api/auth/login/route.ts](file:///d:/Ravina/Antigravity/crm-ds/src/app/api/auth/login/route.ts))**:
   - Enforced exact equality matching on email, employeeId, unique id, username prefix, or full name.
   - Removed loose `identifier.includes(eName)` and `startsWith` logic.
2. **Employee Portal Top Bar & Account Locking ([src/app/employee/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/employee/page.tsx))**:
   - Removed the `<select>` employee switching dropdown completely.
   - Replaced it with a static, read-only `Active Account: {employee.name} ({employee.employeeId})` badge.
   - Removed `selectedEmployeeId` default (`'emp-12'`) and replaced all fallbacks (`emp-12`, `emp-2`, `emp-5`) with clean authenticated user resolution.
   - Made `isManager` strict: regular employees (`role === 'EMPLOYEE'`) are never treated as managers.
   - Added clean `Access Restricted` screens with a `Return to My Dashboard` button for `team-approvals` and `team-time` tabs when accessed by non-managers.
3. **Navbar Dynamic Account State ([src/components/Navbar.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/Navbar.tsx))**:
   - Neutralized initial `activeUser` state to prevent rendering Ravina Khimani (`RK001`) during initial load for employees.
   - Removed `employeesList[0]` fallback and hardcoded account checks.
   - Made `isHrUser` strict: regular employees (`role === 'EMPLOYEE'`) can never evaluate to HR.
4. **Sidebar Dynamic Identity ([src/components/Sidebar.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/Sidebar.tsx))**:
   - Neutralized initial employee code state (`'...'` instead of `'NB002'`).
   - Strictly resolved logged-in user and hid `team-approvals` and `team-time` from regular employees.
5. **Attendance Log & Leaves Backend APIs**:
   - In [src/components/AttendanceLogTab.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/AttendanceLogTab.tsx): Removed fallback to `empsList[0]`.
   - In [src/app/api/leaves/route.ts](file:///d:/Ravina/Antigravity/crm-ds/src/app/api/leaves/route.ts): Required strict employee identification; removed `'emp-12'` and `db.employees[0]` fallbacks.
   - In [src/app/api/attendance/route.ts](file:///d:/Ravina/Antigravity/crm-ds/src/app/api/attendance/route.ts): Added support for `employeeId` query parameter filtering.
   - In [src/app/manager/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/manager/page.tsx): Strictly resolved authenticated manager without arbitrary fallbacks.

---

## 3. Verification & Validation
- **TypeScript Check**: `npx tsc --noEmit` exited with code `0` (zero type errors).
- **Next.js Production Build**: `npm run build` completed successfully, compiling all 10 static and dynamic routes.
