# Conversation: Configurable Daily Target & Shifts (8-Hour vs 9-Hour with 1-Hour Break)
**Date**: October 9, 2026  
**Project**: crm-ds (CRM Design Studio)  
**Conversation ID**: `7d3f762b-acda-45df-a47b-d1f380a8790d`

## User Request
"It says the daily target is 08 hour.. but some of them need to complete 9 hours daily and some 8 hours including the 1 hoours break (45 minutes lunch and 15 minutes tea break)"

## Technical Solution & Calculations
1. **Shift & Break Mathematical Rules**:
   - **9-Hour Daily Shift**: Requires 8 hours of net actual work (480 minutes) + 1 hour total break (45 minutes lunch + 15 minutes tea break). Total gross time elapsed = 9 hours.
   - **8-Hour Daily Shift**: Requires 7 hours of net actual work (420 minutes) + 1 hour total break (45 minutes lunch + 15 minutes tea break). Total gross time elapsed = 8 hours.
   - **Break Deduction Rule**: Break time is deducted from gross logged time to evaluate target completion, short hours, and overtime across all timesheet views.

2. **Per-Employee & Company Default Configuration**:
   - Added `defaultDailyWorkingRequirementMinutes?: number` (480 vs 420) to `TimeTrackingSettings`.
   - Added `SHIFT_OPTIONS` and `shiftLabelFor()` helper in [src/lib/timeTracking.ts](file:///d:/Ravina/Antigravity/crm-ds/src/lib/timeTracking.ts).
   - Added `SET_EMPLOYEE_TARGET` action to [src/app/api/time-tracking/screenshots/settings/route.ts](file:///d:/Ravina/Antigravity/crm-ds/src/app/api/time-tracking/screenshots/settings/route.ts) to allow Master Admin to change an employee's shift requirement with 0ms optimistic UI updates.
   - Updated [src/components/EmployeesTab.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/EmployeesTab.tsx) to allow HR/Admin to assign an 8h or 9h shift directly in the "Add / Edit Employee" modal, with a visible shift badge on employee cards.
   - Updated [src/components/TimeTrackingAdmin.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/TimeTrackingAdmin.tsx) with:
     - Shift label indicators on the Live Board (`(9h shift)` vs `(8h shift)`).
     - Inline shift dropdown selectors for each employee in the Settings Tab employee list.
     - "Default Company Daily Shift" dropdown in the Company Defaults configuration card.
   - Updated [src/components/TimeTracker.tsx](file:///d:/Ravina/Antigravity/crm-ds/src/components/TimeTracker.tsx) hero card to display:
     `Daily target 8h 00m · 9h shift (incl. 1h break)` or `Daily target 7h 00m · 8h shift (incl. 1h break)`.

3. **Seamless Platform Integration**:
   - `Employee.dailyWorkingRequirementMinutes` (480 vs 420) is natively respected by `summarizeDay`, `summarizeRange`, the weekly timeline dotted line indicator, and CSV exports without modifying official biometric punch logs.
