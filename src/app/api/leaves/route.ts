export const dynamic = 'force-dynamic';
export const revalidate = 0;

import fs from 'fs';
import path from 'path';
import os from 'os';
import { NextResponse } from 'next/server';
import {
  getDbData,
  saveDbData,
  getQuarterlyLeaveSummaries,
  getEmployeeAllQuarters,
  getEmployeeLeaveBalanceDetails,
  addNotification,
  logAudit,
  ensureCloudSync,
  getCurrentQuarter,
} from '@/lib/store';
import { LeaveRecord, Employee, mergeLeavesNonRegressive, calculateWorkingDaysCount, getLeaveTimestamp } from '@/lib/types';

export async function GET(request: Request) {
  try {
    await ensureCloudSync();
    const { searchParams } = new URL(request.url);
    const quarter = searchParams.get('quarter') || getCurrentQuarter();
    const department = searchParams.get('department') || 'ALL';
    const employeeDetails = searchParams.get('employeeDetails');

    if (employeeDetails) {
      const detail = getEmployeeAllQuarters(employeeDetails);
      if (!detail) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, detail });
    }

    const db = getDbData();
    let dbModified = false;

    // Auto-purge duplicate record #360 (l-1789898879360) for Mudita on 2026-09-21
    const beforeFilterLen = (db.leaveRecords || []).length;
    db.leaveRecords = (db.leaveRecords || []).filter(l => l.id !== 'l-1789898879360');
    if (db.leaveRecords.length !== beforeFilterLen) {
      dbModified = true;
      logAudit('Delete Duplicate Leave', 'LeaveRecord', 'l-1789898879360', undefined, 'Purged duplicate leave record #360 for Mudita');
    }

    (db.leaveRecords || []).forEach(l => {
      if (
        (l.employeeId === 'emp-13' || l.employeeId === 'SD013' || (l.employeeName && l.employeeName.toLowerCase().includes('shweta'))) &&
        (l.startDate === '2026-09-21' || (l.id && String(l.id).endsWith('012')) || (l.id && String(l.id).endsWith('710')))
      ) {
        if (l.status === 'REJECTED' || l.managerStatus === 'Rejected' || l.hrStatus === 'Rejected') {
          l.status = 'PENDING';
          l.managerStatus = 'Pending';
          l.hrStatus = 'Pending';
          dbModified = true;
        }
      }
    });
    if (dbModified) {
      saveDbData(db);
    }

    const summaries = getQuarterlyLeaveSummaries(quarter, department);
    const sortedRecords = [...(db.leaveRecords || [])].sort((a, b) => getLeaveTimestamp(b) - getLeaveTimestamp(a));

    const employeeId = searchParams.get('employeeId');
    let records = sortedRecords;
    if (employeeId) {
      const cleanEmpId = employeeId.toLowerCase().trim();
      const targetEmp = db.employees.find(e =>
        (e.id && e.id.toLowerCase() === cleanEmpId) ||
        (e.employeeId && e.employeeId.toLowerCase() === cleanEmpId) ||
        (e.name && e.name.toLowerCase() === cleanEmpId)
      );
      const validEmpIds = new Set([
        cleanEmpId,
        ...(targetEmp ? [targetEmp.id.toLowerCase(), (targetEmp.employeeId || '').toLowerCase(), (targetEmp.name || '').toLowerCase()] : [])
      ]);
      records = records.filter(l => {
        const lEmpId = String(l.employeeId || '').toLowerCase().trim();
        const lEmpName = String(l.employeeName || '').toLowerCase().trim();
        return validEmpIds.has(lEmpId) || validEmpIds.has(lEmpName);
      });
    }

    return NextResponse.json({
      quarter,
      department,
      summaries,
      records,
      employees: db.employees || [],
    });
  } catch (err: any) {
    console.error('Error in GET /api/leaves:', err);
    const db = getDbData();
    return NextResponse.json({
      quarter: getCurrentQuarter(),
      department: 'ALL',
      summaries: [],
      records: db.leaveRecords || [],
      employees: db.employees || [],
      error: err.message || 'Internal server error',
    });
  }
}

export async function POST(request: Request) {
  try {
    await ensureCloudSync();
    const body = await request.json();

    // 0a. Delete Single Leave Record Action
    if (body.action === 'delete' || body.action === 'delete_record') {
      const targetId = body.id;
      if (!targetId) {
        return NextResponse.json({ error: 'Missing leave record id to delete' }, { status: 400 });
      }
      const db = getDbData();
      const initialCount = (db.leaveRecords || []).length;
      db.leaveRecords = (db.leaveRecords || []).filter(l => l.id !== targetId);
      if (db.leaveRecords.length !== initialCount) {
        saveDbData(db);
        logAudit('Delete Leave Record', 'LeaveRecord', targetId, undefined, `Deleted leave record ${targetId}`);
      }
      const targetQ = body.quarter || getCurrentQuarter();
      const summaries = getQuarterlyLeaveSummaries(targetQ, 'ALL');
      return NextResponse.json({ success: true, message: `Deleted leave record ${targetId}`, summaries, records: db.leaveRecords });
    }

    // 0. Clear All Leaves Action (for testing & reset)
    if (body.action === 'clear' || body.action === 'clear_all') {
      const db = getDbData();
      const targetQ = body.quarter || getCurrentQuarter();
      db.leaveRecords = [];
      saveDbData(db);

      try {
        const tmpPath = path.join(os.tmpdir(), 'hrm_db.json');
        if (fs.existsSync(tmpPath)) {
          fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2));
        }
      } catch (e) {}

      try {
        await fetch('https://api.restful-api.dev/objects/ff8081819ff5b11001a01eda01715b3e', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'hrm_pilot_leaves',
            data: { leaveRecords: [] },
          }),
        });
      } catch (cloudErr) {
        console.warn('Cloud clear warning:', cloudErr);
      }

      logAudit('Clear All Leaves', 'LeaveRecord', 'all', undefined, 'All leave records cleared by HR');
      const summaries = getQuarterlyLeaveSummaries(targetQ, 'ALL');
      return NextResponse.json({ success: true, message: 'All leave records have been cleared!', summaries, records: [] });
    }

    // 0b. Sync Client Backup Action (restore/merge non-regressively from client backup)
    if (body.action === 'sync_client_backup' && Array.isArray(body.records) && body.records.length > 0) {
      const db = getDbData();
      db.leaveRecords = mergeLeavesNonRegressive(db.leaveRecords || [], body.records);
      saveDbData(db);
      logAudit('Sync Client Backup Leaves', 'LeaveRecord', 'backup', undefined, `Synced ${body.records.length} records from client backup`);
      const targetQ = body.quarter || getCurrentQuarter();
      const summaries = getQuarterlyLeaveSummaries(targetQ, 'ALL');
      return NextResponse.json({ success: true, message: 'Synced leave records from client backup', summaries, records: db.leaveRecords });
    }

    // 1. Manual Numerical Override Action (from EditTrackerModal)
    if (body.action === 'override') {
      const { employeeName, quarter, casualUsed, plannedUsed } = body;
      const db = getDbData();
      const cleanSearch = String(employeeName || '').toLowerCase().trim();
      const emp = db.employees.find(e =>
        e.name.toLowerCase().trim() === cleanSearch ||
        e.id.toLowerCase().trim() === cleanSearch ||
        e.employeeId.toLowerCase().trim() === cleanSearch ||
        (cleanSearch.length >= 3 && e.name.toLowerCase().includes(cleanSearch))
      );
      if (!emp) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }

      // Remove existing approved records for this quarter and create specific override entries
      db.leaveRecords = db.leaveRecords.filter(
        l => !((l.employeeId === emp.id || l.employeeId === emp.employeeId || l.employeeId === emp.name) && l.quarter === quarter && l.status === 'APPROVED')
      );

      const targetQuarter = quarter || getCurrentQuarter();
      let datePrefix = '2026-08-15';
      if (targetQuarter === 'Q1') datePrefix = '2026-02-15';
      else if (targetQuarter === 'Q2') datePrefix = '2026-05-15';
      else if (targetQuarter === 'Q3') datePrefix = '2026-08-15';
      else if (targetQuarter === 'Q4') datePrefix = '2026-11-15';

      if (casualUsed > 0) {
        db.leaveRecords.unshift({
          id: `l-override-cas-${Date.now()}`,
          employeeId: emp.id,
          employeeName: emp.name,
          leaveType: 'Casual Leave',
          dayType: 'full',
          startDate: datePrefix,
          endDate: datePrefix,
          daysCount: Number(casualUsed),
          quarter: targetQuarter,
          year: 2026,
          status: 'APPROVED',
          managerStatus: 'Approved',
          hrStatus: 'Approved',
          note: 'Manual HR Override (Casual Leave Adjustment)',
          createdAt: new Date().toISOString(),
        });
      }

      if (plannedUsed > 0) {
        db.leaveRecords.unshift({
          id: `l-override-pla-${Date.now()}`,
          employeeId: emp.id,
          employeeName: emp.name,
          leaveType: 'Planned Leave',
          dayType: 'full',
          startDate: datePrefix,
          endDate: datePrefix,
          daysCount: Number(plannedUsed),
          quarter: targetQuarter,
          year: 2026,
          status: 'APPROVED',
          managerStatus: 'Approved',
          hrStatus: 'Approved',
          note: 'Manual HR Override (Planned Leave Adjustment)',
          createdAt: new Date().toISOString(),
        });
      }

      logAudit('Override Quarterly Leave', 'LeaveRecord', emp.id, undefined, JSON.stringify({ casualUsed, plannedUsed, quarter }));
      saveDbData(db);

      const summaries = getQuarterlyLeaveSummaries(targetQuarter, 'ALL');
      return NextResponse.json({ success: true, message: 'Quarterly leave updated', summaries });
    }

    // 2. Batch Import Action (from file upload)
    if (body.action === 'import' && Array.isArray(body.records)) {
      const db = getDbData();
      let importedCount = 0;

      // 2a. Import missing employees from employeeMaster if provided
      if (Array.isArray(body.employeeMaster)) {
        body.employeeMaster.forEach((mEmp: any) => {
          if (mEmp.name) {
            const cleanName = String(mEmp.name).trim();
            const exists = db.employees.some(
              e => e.name.toLowerCase().trim() === cleanName.toLowerCase() || e.employeeId === mEmp.employeeId
            );
            if (!exists) {
              const newEmpId = mEmp.employeeId || `EMP${String(db.employees.length + 1).padStart(3, '0')}`;
              db.employees.push({
                id: `emp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                employeeId: newEmpId,
                name: cleanName,
                email: `${cleanName.toLowerCase().replace(/\s+/g, '')}@hrmpilot.com`,
                phone: '+91 98765 00000',
                department: mEmp.department || 'Development',
                designation: 'Staff Member',
                role: 'EMPLOYEE',
                status: 'ACTIVE',
                primaryManager: 'Ravina Khimani',
                monthlySalary: 0,
                dailyWorkingRequirementMinutes: 480,
                weeklyOff: 'Sunday',
                casualAllowance: 2,
                plannedAllowance: 4,
                sickAllowance: 4,
                dateOfJoining: '2024-01-01',
              });
            }
          }
        });
      }

      // 2b. Process leave records
      let targetQuarter = getCurrentQuarter();
      body.records.forEach((row: any) => {
        const empName = row.employeeName || row['Employee Name'] || row['Employee'] || row['Name'];
        const quarter = row.quarter || row['Quarter'] || getCurrentQuarter();
        targetQuarter = quarter;
        const casual = Number(row.casualUsed || row['Casual Leaves Applied'] || row['Casual Leaves'] || row['Casual'] || 0);
        const planned = Number(row.plannedUsed || row['Planned Leaves Applied'] || row['Planned Leaves'] || row['Planned'] || 0);
        const startDate = row.startDate || (quarter === 'Q1' ? '2026-02-15' : quarter === 'Q2' ? '2026-05-15' : quarter === 'Q3' ? '2026-08-15' : '2026-11-15');
        const endDate = row.endDate || startDate;

        if (empName) {
          const cleanName = String(empName).trim().toLowerCase();
          let emp = db.employees.find(
            e => e.name.toLowerCase().trim() === cleanName || e.employeeId.toLowerCase() === cleanName
          );

          // Fallback fuzzy search (e.g. Naman Bangia vs Naman)
          if (!emp) {
            emp = db.employees.find(
              e => e.name.toLowerCase().includes(cleanName) || cleanName.includes(e.name.toLowerCase().split(' ')[0])
            );
          }

          // If still not found, dynamically create employee
          if (!emp) {
            const rawTitleName = String(empName).trim();
            const newCreatedEmp: Employee = {
              id: `emp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              employeeId: `EMP${String(db.employees.length + 1).padStart(3, '0')}`,
              name: rawTitleName,
              email: `${rawTitleName.toLowerCase().replace(/\s+/g, '')}@hrmpilot.com`,
              phone: '+91 98765 00000',
              department: 'Development',
              designation: 'Staff Member',
              role: 'EMPLOYEE',
              status: 'ACTIVE',
              primaryManager: 'Ravina Khimani',
              monthlySalary: 0,
              dailyWorkingRequirementMinutes: 480,
              weeklyOff: 'Sunday',
              casualAllowance: 2,
              plannedAllowance: 4,
              sickAllowance: 4,
              dateOfJoining: '2024-01-01',
            };
            db.employees.push(newCreatedEmp);
            emp = newCreatedEmp;
          }

          if (emp) {
            const empId = emp.id;
            const empCode = emp.employeeId;
            const empNameStr = emp.name;
            // Remove previous imported/override records for this employee & quarter
            db.leaveRecords = db.leaveRecords.filter(
              l => !((l.employeeId === empId || l.employeeId === empCode || l.employeeId === empNameStr) && l.quarter === quarter && l.status === 'APPROVED')
            );

            if (casual > 0) {
              db.leaveRecords.unshift({
                id: `l-imp-cas-${Date.now()}-${Math.random()}`,
                employeeId: emp.id,
                leaveType: 'Casual Leave',
                dayType: 'full',
                startDate,
                endDate,
                daysCount: casual,
                quarter,
                year: 2026,
                status: 'APPROVED',
                note: 'Imported from Leave Policy Tracker',
                createdAt: new Date().toISOString(),
              });
            }

            if (planned > 0) {
              db.leaveRecords.unshift({
                id: `l-imp-pla-${Date.now()}-${Math.random()}`,
                employeeId: emp.id,
                leaveType: 'Planned Leave',
                dayType: 'full',
                startDate,
                endDate,
                daysCount: planned,
                quarter,
                year: 2026,
                status: 'APPROVED',
                note: 'Imported from Leave Policy Tracker',
                createdAt: new Date().toISOString(),
              });
            }
            importedCount++;
          }
        }
      });

      saveDbData(db);
      logAudit('Import Quarterly Leaves', 'LeaveRecord', 'batch', undefined, `Imported ${importedCount} records`);
      const summaries = getQuarterlyLeaveSummaries(targetQuarter, 'ALL');
      return NextResponse.json({ success: true, message: `Successfully imported ${importedCount} employee leave records from spreadsheet!`, summaries });
    }

    // 3. Regular Leave Submission / Record Leave Period
    const employeeId = body.employeeId;
    if (!employeeId) {
      return NextResponse.json({ error: 'Missing employee identification' }, { status: 400 });
    }

    const { leaveType, dayType, startDate, endDate, note, handoverNote, emergencyContact, reason } = body;

    if (!startDate) {
      return NextResponse.json({ error: 'Missing required start date' }, { status: 400 });
    }

    const db = getDbData();
    const cleanId = String(employeeId).trim().toLowerCase();
    const emp = db.employees.find(e =>
      (e.id && e.id.toLowerCase() === cleanId) ||
      (e.employeeId && e.employeeId.toLowerCase() === cleanId) ||
      (body.employeeName && e.name && e.name.toLowerCase().trim() === String(body.employeeName).toLowerCase().trim())
    );

    if (!emp) {
      return NextResponse.json({ error: 'Employee account not found.' }, { status: 404 });
    }

    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : start;

    // Prevent duplicate/overlapping leave applications for the same employee
    const targetStart = startDate;
    const targetEnd = endDate || startDate;
    const hasOverlap = (db.leaveRecords || []).some(l => {
      if (l.employeeId !== emp.id && l.employeeName !== emp.name) return false;
      if (l.status === 'REJECTED' || l.managerStatus === 'Rejected' || l.hrStatus === 'Rejected') return false;
      const lStart = l.startDate;
      const lEnd = l.endDate || l.startDate;
      return targetStart <= lEnd && targetEnd >= lStart;
    });

    if (hasOverlap && !body.allowOverlap && !body.isAdjustment) {
      return NextResponse.json(
        { error: `A leave request for ${emp.name} already exists for ${targetStart}${targetEnd !== targetStart ? ' to ' + targetEnd : ''}. Duplicate leave applications are not permitted.` },
        { status: 400 }
      );
    }

    let daysCount = calculateWorkingDaysCount(startDate, endDate, dayType);
    if (typeof body.daysCount === 'number') {
      daysCount = body.daysCount;
    }

    // Determine quarter
    const month = start.getMonth() + 1;
    let quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4' = body.quarter || 'Q3';
    if (!body.quarter) {
      if (month >= 1 && month <= 3) quarter = 'Q1';
      else if (month >= 4 && month <= 6) quarter = 'Q2';
      else if (month >= 7 && month <= 9) quarter = 'Q3';
      else if (month >= 10 && month <= 12) quarter = 'Q4';
    }

    const isShortHours = Boolean(body.isShortHours || body.status === 'SHORT_HOURS');
    const isHrSubmission = body.isHrSubmission || body.status === 'APPROVED' || body.status === 'SHORT_HOURS' || body.submittedBy === 'HR';
    const managerStatus = body.managerStatus || (isShortHours ? 'Approved (Short Hours)' : isHrSubmission ? 'Approved' : 'Pending');
    const hrStatus = body.hrStatus || (isShortHours ? 'Approved (Short Hours)' : isHrSubmission ? 'Approved' : 'Pending');
    const finalStatus = body.status || (isHrSubmission ? 'APPROVED' : 'PENDING');

    const newRecord: LeaveRecord = {
      id: `l-${Date.now()}`,
      employeeId: emp.id,
      employeeName: emp.name,
      leaveType: leaveType || 'Casual Leave',
      dayType: dayType || 'full',
      startDate,
      endDate: endDate || startDate,
      daysCount,
      quarter,
      year: start.getFullYear(),
      status: finalStatus,
      managerStatus,
      hrStatus,
      isAdjustment: Boolean(body.isAdjustment),
      isShortHours,
      note: note || reason || 'Leave application',
      handoverNote: handoverNote || '',
      emergencyContact: emergencyContact || '',
      createdAt: new Date().toISOString(),
    };

    db.leaveRecords.unshift(newRecord);
    logAudit('Submit Leave Request', 'LeaveRecord', newRecord.id, undefined, JSON.stringify(newRecord));

    const notifSettings = db.settings?.notificationSettings || {
      enabled: true,
      notifyAdminOnLeaveApply: true,
      notifyManagerOnLeaveApply: true,
      notifyEmployeeLeaveBalance: true,
      notifyEmployeeOnStatusUpdate: true,
    };

    if (emp && notifSettings.enabled) {
      // 1. Employee Leave Balance Notification
      if (notifSettings.notifyEmployeeLeaveBalance) {
        const bal = getEmployeeLeaveBalanceDetails(emp.id, startDate);
        let balanceMsg = '';
        if (bal) {
          balanceMsg = `\n📊 Current Balance (${bal.quarter}): Casual: ${bal.casualRemaining}/${bal.casualAllowance} remaining, Planned/Sick: ${bal.plannedRemaining}/${bal.plannedAllowance} remaining (Total Available: ${bal.totalRemaining}/${bal.totalAllowance} days).`;
          if (daysCount > bal.totalRemaining) {
            balanceMsg += `\n⚠️ Note: Requesting ${daysCount} day(s) exceeds remaining quota by ${daysCount - bal.totalRemaining} day(s) and may incur Loss of Pay (LOP) if approved.`;
          }
        }
        addNotification(
          emp.id,
          'leave_submitted',
          'Leave Application Submitted',
          `Your request for ${leaveType} (${startDate} to ${endDate || startDate}, ${daysCount} day${daysCount > 1 ? 's' : ''}) has been submitted for approval.${balanceMsg}`,
          '/employee?tab=leave-history',
          { recordId: newRecord.id, daysCount, leaveType, startDate, endDate: endDate || startDate, balance: bal }
        );
      }

      const notifiedMgrIds = new Set<string>();

      // 2. Manager Notification
      if (notifSettings.notifyManagerOnLeaveApply) {
        const mgrNames = [
          emp.primaryManager,
          emp.secondaryManager,
          emp.reportingManager,
          emp.manager1,
          emp.managerName,
        ]
          .filter(Boolean)
          .map(m => String(m).trim().toLowerCase());

        const targetManagers = db.employees.filter(e => {
          if (e.id === emp.id) return false;
          const isMgrRole = e.role === 'MANAGER' || e.role === 'ADMIN' || e.role === 'SUPER_ADMIN';
          const nameMatch = mgrNames.some(m =>
            e.name.toLowerCase() === m ||
            e.name.toLowerCase().includes(m) ||
            (e.id && e.id.toLowerCase() === m) ||
            (e.employeeId && e.employeeId.toLowerCase() === m)
          );
          return isMgrRole && nameMatch;
        });

        // Fallback: If no direct manager matched by name, notify managers in the same department
        if (targetManagers.length === 0 && emp.department) {
          const deptMgrs = db.employees.filter(
            e => e.role === 'MANAGER' && e.department === emp.department && e.id !== emp.id
          );
          targetManagers.push(...deptMgrs);
        }

        targetManagers.forEach(mgr => {
          notifiedMgrIds.add(mgr.id);
          addNotification(
            mgr.id,
            'leave_applied_manager',
            `New Leave Request: ${emp.name}`,
            `${emp.name} (${emp.employeeId || emp.id}, ${emp.department}) applied for ${daysCount} day(s) ${leaveType} from ${startDate} to ${endDate || startDate}. Reason: "${note || reason || 'No reason provided'}". Please review in Manager Desk.`,
            '/manager',
            { recordId: newRecord.id, employeeId: emp.id, employeeName: emp.name }
          );
        });
      }

      // 3. Admin / HR Notification
      if (notifSettings.notifyAdminOnLeaveApply) {
        const admins = db.employees.filter(
          e => (e.role === 'ADMIN' || e.role === 'SUPER_ADMIN') && e.id !== emp.id && !notifiedMgrIds.has(e.id)
        );
        admins.forEach(admin => {
          addNotification(
            admin.id,
            'leave_applied_admin',
            `New Leave Request: ${emp.name}`,
            `${emp.name} (${emp.employeeId || emp.id}, ${emp.department}) applied for ${daysCount} day(s) ${leaveType} from ${startDate} to ${endDate || startDate}. Reason: "${note || reason || 'No reason provided'}". Action required: Review and HR approval.`,
            '/admin/leave-records',
            { recordId: newRecord.id, employeeId: emp.id, employeeName: emp.name }
          );
        });
      }
    }

    saveDbData(db);

    const summaries = getQuarterlyLeaveSummaries(quarter, 'ALL');

    return NextResponse.json({
      success: true,
      message: 'Leave request submitted successfully',
      record: newRecord,
      summaries,
      records: db.leaveRecords,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await ensureCloudSync();
    const body = await request.json();
    const { id, record, status, approverRole, startDate, endDate, daysCount } = body;

    const db = getDbData();
    const cleanId = id ? String(id).replace(/[^0-9]/g, '') : '';
    
    // Find all matching indices (exact ID, numeric suffix, or record employee+date match)
    let matchingIndices: number[] = [];

    db.leaveRecords.forEach((l, idx) => {
      const isExact = l.id === id;
      const lClean = l.id.replace(/[^0-9]/g, '');
      const isCleanMatch = cleanId.length >= 3 && (lClean.endsWith(cleanId) || cleanId.endsWith(lClean));
      
      if (isExact || isCleanMatch) {
        matchingIndices.push(idx);
      }
    });

    // 3. Robust Auto-Recovery: Insert record with target status if missing from server db
    if (matchingIndices.length === 0) {
      const newHrStatus = status === 'APPROVED' ? 'Approved' : status === 'REJECTED' ? 'Rejected' : 'Pending';
      const newMgrStatus = approverRole === 'MANAGER' ? (status === 'APPROVED' ? 'Approved' : status === 'REJECTED' ? 'Rejected' : 'Pending') : (status === 'APPROVED' ? 'Approved' : 'Pending');
      const fallbackRecord: LeaveRecord = {
        id: id || `l-${Date.now()}`,
        employeeId: record?.employeeId || body.employeeId || 'emp-8',
        leaveType: record?.leaveType || body.leaveType || 'Casual Leave',
        dayType: record?.dayType || 'full',
        startDate: startDate || record?.startDate || '2026-08-15',
        endDate: endDate || record?.endDate || startDate || record?.startDate || '2026-08-15',
        daysCount: daysCount || record?.daysCount || 1,
        quarter: record?.quarter || getCurrentQuarter(),
        year: 2026,
        status: status || 'APPROVED',
        managerStatus: newMgrStatus,
        hrStatus: newHrStatus,
        note: record?.note || 'Leave application',
        createdAt: new Date().toISOString(),
      };
      db.leaveRecords.unshift(fallbackRecord);
      matchingIndices = [0];
    }

    // Update ALL matching records to ensure no duplicate pending entries remain
    let updatedRecord: LeaveRecord = db.leaveRecords[matchingIndices[0]];
    
    matchingIndices.forEach((idx) => {
      const oldVal = JSON.stringify(db.leaveRecords[idx]);
      const current = db.leaveRecords[idx];

      if (startDate) current.startDate = startDate;
      if (endDate) current.endDate = endDate;
      if (typeof daysCount === 'number') current.daysCount = daysCount;

      if (approverRole === 'MANAGER') {
        if (status === 'REJECTED') {
          current.status = 'REJECTED';
          current.managerStatus = 'Rejected';
          current.hrStatus = 'Rejected';
        } else if (status === 'APPROVED') {
          current.managerStatus = 'Approved';
          if (current.hrStatus === 'Approved') {
            current.status = 'APPROVED';
          }
        } else {
          current.status = status;
        }
      } else {
        if (status === 'REJECTED') {
          current.status = 'REJECTED';
          current.managerStatus = current.managerStatus || 'Rejected';
          current.hrStatus = 'Rejected';
        } else if (status === 'MORE_INFO_REQUIRED') {
          current.status = 'MORE_INFO_REQUIRED';
        } else if (status === 'APPROVED') {
          current.status = 'APPROVED';
          current.managerStatus = 'Approved';
          current.hrStatus = 'Approved';
        } else {
          current.status = status;
        }
      }

      logAudit(`Leave Request ${current.status}`, 'LeaveRecord', current.id, oldVal, JSON.stringify(current));

      const notifSettings = db.settings?.notificationSettings || {
        enabled: true,
        notifyAdminOnLeaveApply: true,
        notifyManagerOnLeaveApply: true,
        notifyEmployeeLeaveBalance: true,
        notifyEmployeeOnStatusUpdate: true,
      };

      const emp = db.employees.find(e => e.id === current.employeeId);
      if (emp && notifSettings.enabled) {
        // 1. Employee notification with updated leave balance
        if (notifSettings.notifyEmployeeOnStatusUpdate) {
          const bal = getEmployeeLeaveBalanceDetails(emp.id, current.startDate || current.quarter);
          let balanceMsg = '';
          if (bal) {
            balanceMsg = `\n📊 Updated Balance (${bal.quarter}): Casual: ${bal.casualRemaining}/${bal.casualAllowance} left (Used: ${bal.casualUsed}), Planned/Sick: ${bal.plannedRemaining}/${bal.plannedAllowance} left (Used: ${bal.plannedUsed}). Total Available: ${bal.totalRemaining}/${bal.totalAllowance} days.${bal.extraDeduct > 0 ? ` ⚠️ Excess/LOP: ${bal.extraDeduct} day(s).` : ''}`;
          }
          const statusIcon = current.status === 'APPROVED' ? '✅' : current.status === 'REJECTED' ? '❌' : 'ℹ️';
          addNotification(
            emp.id,
            'leave_status_updated',
            `${statusIcon} Leave Request ${current.status}: ${current.leaveType}`,
            `Your leave request #${current.id} (${current.leaveType}, ${current.startDate} to ${current.endDate || current.startDate}, ${current.daysCount} day(s)) status is now ${current.status}. Manager: ${current.managerStatus || 'Pending'}, HR: ${current.hrStatus || 'Pending'}.${balanceMsg}`,
            '/employee?tab=leave-history',
            { recordId: current.id, status: current.status, balance: bal }
          );
        }

        // 2. Cross-role notification on status change
        if (approverRole === 'MANAGER') {
          const admins = db.employees.filter(e => (e.role === 'ADMIN' || e.role === 'SUPER_ADMIN') && e.id !== emp.id);
          admins.forEach(admin => {
            addNotification(
              admin.id,
              'leave_status_updated_admin',
              `Manager Decision: ${emp.name}'s Leave #${current.id}`,
              `Manager marked ${emp.name}'s request for ${current.leaveType} (${current.daysCount}d) as ${current.managerStatus}. Pending final HR action.`,
              '/admin/leave-records',
              { recordId: current.id, employeeId: emp.id }
            );
          });
        } else {
          const mgrNames = [
            emp.primaryManager,
            emp.secondaryManager,
            emp.reportingManager,
            emp.manager1,
            emp.managerName,
          ]
            .filter(Boolean)
            .map(m => String(m).trim().toLowerCase());

          const targetManagers = db.employees.filter(e => {
            if (e.id === emp.id) return false;
            const isMgr = e.role === 'MANAGER';
            const nameMatch = mgrNames.some(m =>
              e.name.toLowerCase() === m ||
              e.name.toLowerCase().includes(m) ||
              (e.id && e.id.toLowerCase() === m) ||
              (e.employeeId && e.employeeId.toLowerCase() === m)
            );
            return isMgr && nameMatch;
          });

          targetManagers.forEach(mgr => {
            addNotification(
              mgr.id,
              'leave_status_updated_manager',
              `HR Decision: ${emp.name}'s Leave #${current.id}`,
              `HR marked ${emp.name}'s request for ${current.leaveType} (${current.daysCount}d) as ${current.hrStatus}. Overall status: ${current.status}.`,
              '/manager',
              { recordId: current.id, employeeId: emp.id }
            );
          });
        }
      }
      updatedRecord = current;
    });

    await saveDbData(db);

    const targetQuarter = updatedRecord.quarter || getCurrentQuarter();
    const summaries = getQuarterlyLeaveSummaries(targetQuarter, 'ALL');

    return NextResponse.json({
      success: true,
      record: updatedRecord,
      records: db.leaveRecords,
      summaries,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const db = getDbData();

    if (id) {
      const initialCount = (db.leaveRecords || []).length;
      db.leaveRecords = (db.leaveRecords || []).filter(l => l.id !== id);
      if (db.leaveRecords.length !== initialCount) {
        saveDbData(db);
        logAudit('Delete Leave Record', 'LeaveRecord', id, undefined, `Deleted leave record ${id}`);
      }
      return NextResponse.json({ success: true, message: `Leave record ${id} deleted successfully`, records: db.leaveRecords });
    }

    db.leaveRecords = [];
    saveDbData(db);

    try {
      await fetch('https://api.restful-api.dev/objects/ff8081819ff5b11001a01eda01715b3e', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'hrm_pilot_leaves',
          data: { leaveRecords: [] },
        }),
      });
    } catch (cloudErr) {}

    logAudit('Clear All Leaves History', 'LeaveRecord', 'all', undefined, 'All leave records cleared by HR');
    return NextResponse.json({ success: true, message: 'All leave history records cleared successfully', records: [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

