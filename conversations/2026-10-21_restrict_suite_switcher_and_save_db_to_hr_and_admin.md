# Conversation Log: Restrict Suite Switcher & Save Database to HR and Super Admin

**Date**: 2026-10-21  
**Project**: CRM-DS (HRM Pilot Web App)  
**Topic**: Role-Based Header Options & Database Save Security

---

## 1. User Request
> "I want these options in the header to be disbaled for all the employees. Only visible to HR TO SWITCH. ALSO THE SAVE DATABASE OPTION SHOULD BE VISIBLE ONLY TO HR and super admin."
> (Included screenshot showing header with `[ HR Admin Suite ] [ Manager Desk ] [ Employee Portal ]` pill switcher, `ROLE: EMPLOYEE` badge, and `[ 💾 Save Database ]` button)

---

## 2. Root Cause Analysis
1. In [src/components/Navbar.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/Navbar.tsx), the suite switcher and the Save Database button were previously gated behind `isRavinaUser` and `isAdminAccount`.
2. `isAdminUser` contained loose email substring matching:
   `storedEmail.includes('digitalsuncity') || storedEmail.includes('harshit')`
3. Because the company name is **Digital Suncity**, employees had company email addresses matching `digitalsuncity`, and employee Nandini Gupta (`NG006`) had email `security@harshitbhootra.com`, which matched `harshit`.
4. As a result, regular employees logging into the employee portal evaluated as `isAdminUser = true` and `isRavinaUser = true`, exposing both:
   - The suite switcher pills (`[ HR Admin Suite ]`, `[ Manager Desk ]`, `[ Employee Portal ]`)
   - The `[ 💾 Save Database ]` button
5. In addition, [src/app/api/admin/save-db/route.ts](file:///d:/Ravina/Antigravity/crm-ds/src/app/api/admin/save-db/route.ts) had no server-side authorization checks, meaning non-HR requests could potentially trigger backups.

---

## 3. Changes Implemented
1. **[src/components/Navbar.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/Navbar.tsx)**:
   - Removed loose email substring matching (`includes('digitalsuncity')`, `includes('harshit')`, `includes('admin')`).
   - Added strict, authoritative role checks:
     - `isSuperAdminUser`: Checks for `SUPER_ADMIN` role, employee ID `emp-1` / `rk001`, or Ravina's exact email (`digitalsuncityoffice@gmail.com` / `ravina@hrmpilot.com`).
     - `isHrUser`: Checks if user is Super Admin, role is `ADMIN`, department is `Human Resources` / `HR`, or designation includes `HR`. Regular employees and regular managers will **never** match this.
   - Strictly restricted the Portal Suite Switcher (`[ HR Admin Suite ]`, `[ Manager Desk ]`, `[ Employee Portal ]`) to `{isHrUser && ( ... )}`.
   - Strictly restricted the `[ 💾 Save Database ]` button to `{isHrUser && ( ... )}`.
   - Updated `setRoleCookie` to honor Super Admin and HR Admin permissions safely.
   - Updated `handleLogout` to cleanly purge authenticated user state (`hrm_auth_user_*` and `hrm_auth_*` cookies).
   - Stored `role` and `department` on `activeUser` state to guarantee real-time reactivity when employee data loads.

2. **[src/app/api/admin/save-db/route.ts](file:///d:/Ravina/Antigravity/crm-ds/src/app/api/admin/save-db/route.ts)**:
   - Added server-side role validation: verifies `hrm_user_role` / `hrm_auth_role` is `SUPER_ADMIN` or `ADMIN`, or `emp-1`.
   - Returns `403 Forbidden` for any unauthorized requests from regular employees or managers.

3. **[src/app/employee/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/employee/page.tsx)**:
   - Gated the "Active Employee View" switcher dropdown strictly to HR / Super Admin users. Regular employees strictly see a static "Active Account: [Name] ([Employee ID])" badge without any switching controls.

4. **[src/app/login/page.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/app/login/page.tsx)** & **[src/app/api/auth/login/route.ts](file:///d:/Ravina/Antigravity/crm-ds/src/app/api/auth/login/route.ts)**:
   - Set persistent `hrm_auth_user_id`, `hrm_auth_user_role`, and `hrm_auth_user_email` in both `localStorage` and cookies on login, ensuring that when HR previews an employee view, their authenticated HR status remains preserved.

5. **[src/components/Sidebar.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/Sidebar.tsx)**:
   - Tightened `isSuperAdmin` and `isRavinaKhimani` logic to eliminate unmounted/empty-user fallback that previously leaked "Return to HR Admin Suite" to unauthenticated or employee sessions.

---

## 4. Verification
- Ran `npx tsc --noEmit`: Exited with code `0`, zero compilation errors.
- Verified that all employees (e.g. Nandini Gupta, Sonu Goswami, Anup Sen, etc.) will have `isHrUser = false`, preventing them from seeing the suite switcher or the Save Database button.
