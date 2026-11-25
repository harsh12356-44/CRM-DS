# Conversation Log: Inactive Employee Portal Access Restriction

**Date**: 2026-11-25  
**Topic**: Restricting Inactive Employees from Logging in to the HRM Portal  
**Participants**: User (Ravina Khimani), Antigravity AI  

---

## 1. User Request
*"the employee which is marked inactive should not be able to login to HRM portal."*

---

## 2. Problem Analysis
- On the live portal, employee Bulbul (`BB011`, `emp-11`, `bulbulmaheshwari64@gmail.com`) was set to `status: "INACTIVE"`.
- However, when testing login with Bulbul's credentials, the live server returned `HTTP 200 OK` and issued authentication cookies because `src/app/api/auth/login/route.ts` did not inspect `emp.status`.
- Inactive staff could still log in, punch attendance, clock in on time tracking, and apply for leaves.

---

## 3. Implementation
1. **`src/app/api/auth/login/route.ts`**:
   - Added immediate status validation checking `(emp.status || 'ACTIVE').toUpperCase().trim() === 'INACTIVE'`.
   - Rejects inactive accounts with `HTTP 403 Forbidden` and message:
     *"Your account (Employee Name) is marked as Inactive. Access to the HRM portal has been suspended. Please contact HR / Administrator."*
   - Records security audit log for every blocked inactive login attempt.

2. **`src/app/employee/page.tsx` & `src/app/manager/page.tsx`**:
   - If an employee or manager has an active cookie but was later marked `INACTIVE`, the portal clears all auth cookies, purges localStorage, and redirects to `/login?error=inactive`.

3. **`src/app/login/page.tsx`**:
   - Displays clear error message when redirected with `?error=inactive`.

4. **API Action Restrictions**:
   - `src/app/api/attendance/punch/route.ts`: Blocks inactive punch in/out.
   - `src/app/api/time-tracking/route.ts`: Blocks inactive time tracking clock in.
   - `src/app/api/leaves/route.ts`: Blocks inactive leave submissions.
   - `src/app/api/feedback/route.ts`: Blocks inactive complaint submissions.

---

## 4. Verification & Deployment
- Tested login locally: Inactive account (`bulbulmaheshwari64@gmail.com`) returned `HTTP 403 Forbidden`. Active account (`digitalsuncityoffice@gmail.com`) succeeded with `HTTP 200 OK`.
- Production build (`npm run build`) succeeded with zero errors.
- Committed and pushed to `main` to trigger automated deployment to Hostinger.
